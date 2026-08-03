import { io } from 'socket.io-client';

// Factory instead of a module-level singleton — see createApiClient.js for why:
// agent and admin each need their own isolated socket connection.
export function createSocketClient() {
  let socket = null;

  // Same VITE_API_PROXY_TARGET used by createApiClient.js: unset in dev (same-origin,
  // proxied by Vite), set to the backend's absolute URL in production.
  const API_TARGET = import.meta.env.VITE_API_PROXY_TARGET?.replace(/\/+$/, '');

  // Sprint 1 scope: connect + room join only (see backend src/sockets/index.js).
  // No business notification events are emitted by the server yet.
  function connectSocket(accessToken) {
    disconnectSocket();

    socket = io(API_TARGET || undefined, {
      path: '/socket.io',
      auth: { token: accessToken },
      autoConnect: true,
      withCredentials: true,
    });

    return socket;
  }

  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function getSocket() {
    return socket;
  }

  return { connectSocket, disconnectSocket, getSocket };
}
