import { io } from 'socket.io-client';

let socket = null;

// Same VITE_API_PROXY_TARGET used by api/client.js: unset in dev (same-origin,
// proxied by Vite), set to the backend's absolute URL in production.
const API_TARGET = import.meta.env.VITE_API_PROXY_TARGET?.replace(/\/+$/, '');

// Sprint 1 scope: connect + room join only (see backend src/sockets/index.js).
// No business notification events are emitted by the server yet.
export function connectSocket(accessToken) {
  disconnectSocket();

  socket = io(API_TARGET || undefined, {
    path: '/socket.io',
    auth: { token: accessToken },
    autoConnect: true,
    withCredentials: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
