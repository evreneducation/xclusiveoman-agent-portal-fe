import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, tryRefresh, getAccessToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);

// AUTH-7: /agent and /admin are fully separate auth contexts. The backend's
// /auth/login endpoint is shared across all portals, so this app enforces
// the boundary itself — historically just "no agency_id = internal staff",
// but that alone now also matches a custom-role employee (Employees.jsx's
// Add modal "Other" branch, customRoleEmployees.controller.js) who was
// never meant to see the Admin Console — there's no dashboard built for
// that role yet, and no Access Features/permissions to scope what they
// could do here even if there were. ADMIN_ROLES is the actual allow-list:
// only these roles (mirroring the backend's own requireRole(...) gates
// across admin.routes.js and friends) may authenticate into this app: an
// agency_id-less user whose role isn't one of these gets logged straight
// back out below, same as one who does have an agency_id.
const ADMIN_ROLES = ['ops_admin', 'super_admin', 'sales_marketing', 'support', 'finance'];

function isAdminUser(user) {
  return !user.agencyId && ADMIN_ROLES.includes(user.role);
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

  // On mount, silently try to resume a session via the httpOnly refresh cookie.
  useEffect(() => {
    (async () => {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        setStatus('anonymous');
        return;
      }
      try {
        const { user: me } = await api.get('/auth/me');
        if (!isAdminUser(me)) {
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

  const value = {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isSuperAdmin: user?.role === 'super_admin',
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
