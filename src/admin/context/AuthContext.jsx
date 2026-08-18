import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, tryRefresh, getAccessToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);

// AUTH-7: /agent and /admin are fully separate auth contexts. The backend's
// /auth/login endpoint is shared across both frontends, so this app enforces
// the boundary itself — only users with no agency_id (internal staff) may use
// this console.
function isStaffUser(user) {
  return !user.agencyId;
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
        if (!isStaffUser(me)) {
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
