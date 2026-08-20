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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    (async () => {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        setStatus('anonymous');
        return;
      }
      try {
        const { user: me } = await api.get('/auth/me');
        if (!isTeamUser(me)) {
          await api.post('/auth/logout').catch(() => {});
          clearSession();
          return;
        }
        setUser(me);
        setStatus('authenticated');
        wireSocket(getAccessToken());
      } catch {
        clearSession();
      }
    })();
  }, [clearSession, wireSocket]);

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
