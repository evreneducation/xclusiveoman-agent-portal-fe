import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, tryRefresh, getAccessToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);

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
        setUser(me);
        setStatus('authenticated');
        wireSocket(getAccessToken());
      } catch {
        clearSession();
      }
    })();
  }, [clearSession, wireSocket]);

  const register = useCallback(async (payload) => {
    return api.post('/auth/register', payload, { skipAuth: true });
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return api.post('/auth/forgot-password', { email }, { skipAuth: true });
  }, []);

  const resetPassword = useCallback(async ({ token, password }) => {
    return api.post('/auth/reset-password', { token, password }, { skipAuth: true });
  }, []);

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
    socketConnected,
    register,
    forgotPassword,
    resetPassword,
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
