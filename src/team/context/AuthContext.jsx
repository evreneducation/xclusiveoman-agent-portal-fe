import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, tryRefresh, getAccessToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);

// /team is its own auth boundary, same "each portal enforces its own
// boundary itself" posture as admin/context/AuthContext.jsx#isStaffUser
// (AUTH-7) — only sales_manager/relationship_manager may use this portal.
// An ops_admin/super_admin (or an agency user) who somehow lands here is
// signed back out rather than let in with an empty/undefined permissions
// set — this portal has nothing sensible to show them.
const TEAM_ROLES = ['sales_manager', 'relationship_manager'];

function isTeamUser(user) {
  return TEAM_ROLES.includes(user.role);
}

// Caches the last-known /auth/me response (permissions included) in
// sessionStorage — survives an in-SPA route change or a tab reopen within
// the same browser session, but never outlives it (sessionStorage, not
// localStorage) and is explicitly wiped on logout (clearSession below), so
// it can never leak into a next, different login on the same machine. This
// is a convenience layer only, never the source of truth: hasFeature always
// reads live `user` state, and every write here is paired with the real
// /auth/me response that produced it, never invented client-side.
const USER_CACHE_KEY = 'team.auth.user';

function readCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Private-browsing/storage-full — the cache is a convenience only, so a
    // failed write here just means the next mount re-fetches from the API
    // instead of hydrating instantly, never a functional break.
  }
}

function clearCachedUser() {
  try {
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Nothing to clean up if storage was never writable to begin with.
  }
}

export function AuthProvider({ children }) {
  // Hydrated from the cache immediately (so the sidebar doesn't flash empty
  // while the real /auth/me call below is in flight) — always overwritten by
  // that real call moments later, never trusted on its own past that point.
  const [user, setUser] = useState(readCachedUser);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const wireSocket = useCallback((accessToken) => {
    disconnectSocket();
    setSocketConnected(false);
    const socket = connectSocket(accessToken);
    socketRef.current = socket;
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    disconnectSocket();
    setSocketConnected(false);
    clearCachedUser();
  }, []);

  // The one real fetch — GET /auth/me, re-verified server-side (requireAuth
  // re-fetches the user's row fresh from the DB on every request, never
  // trusting stale JWT claims) so this always reflects whatever an admin
  // most recently checked/unchecked on this account's Access Features. Both
  // the initial mount effect below and any later manual/opportunistic
  // refresh (the window-focus effect further down) funnel through this one
  // function, so "how permissions get (re)loaded" only has one implementation.
  const fetchUser = useCallback(async () => {
    const { user: me } = await api.get('/auth/me');
    if (!isTeamUser(me)) {
      await api.post('/auth/logout').catch(() => {});
      clearSession();
      return null;
    }
    setUser(me);
    writeCachedUser(me);
    return me;
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    (async () => {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        setStatus('anonymous');
        clearCachedUser();
        return;
      }
      try {
        const me = await fetchUser();
        if (!me) return; // fetchUser already logged out a non-team account
        setStatus('authenticated');
        wireSocket(getAccessToken());
      } catch {
        clearSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSession, wireSocket]);

  // Re-syncs permissions when this tab regains focus (an admin flipping an
  // Access Feature checkbox while this LM/RM already has the portal open in
  // another tab is exactly the case a one-time-on-mount fetch alone can't
  // catch — see requireFeature's own 403 on the backend, which always
  // re-checks fresh regardless of what this tab's cached `user` still
  // thinks). Only fires once actually authenticated — a background tab
  // still on the login screen has nothing to refresh yet.
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    function onFocus() {
      fetchUser().catch(() => {});
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [status, fetchUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Access Features (backend config/accessFeatures.js) — the fixed boolean
  // map an admin set on this account (Employees.jsx). `hasFeature` is the
  // one place every sidebar item/route guard in this portal reads from, so
  // "what's checked" can never drift between the nav and the actual route
  // guard (routes/RequireFeature.jsx).
  const hasFeature = useCallback((key) => user?.permissions?.[key] === true, [user]);

  const value = {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isLeadManager: user?.role === 'sales_manager',
    isRelationshipManager: user?.role === 'relationship_manager',
    hasFeature,
    socketConnected,
    logout,
    // Manual escape hatch alongside the automatic window-focus refresh above
    // — e.g. a "Refresh access" action (TeamLayout.jsx) for "an admin just
    // told me they updated it, but I haven't switched tabs to trigger the
    // focus listener yet".
    refreshUser: fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
