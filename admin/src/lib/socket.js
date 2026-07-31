import { io } from 'socket.io-client';

let socket = null;

// Sprint 1 scope: connect + room join only (see backend src/sockets/index.js).
// No business notification events are emitted by the server yet.
export function connectSocket(accessToken) {
  disconnectSocket();

  socket = io({
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
