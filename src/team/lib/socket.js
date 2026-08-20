import { createSocketClient } from '../../shared/socket/createSocketClient.js';

export const { connectSocket, disconnectSocket, getSocket } = createSocketClient();
