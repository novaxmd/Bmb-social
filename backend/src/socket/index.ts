import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer, frontendUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [frontendUrl, 'http://localhost:3000'],
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { id: socket.id });

    socket.on('subscribe:download', (downloadId: string) => {
      socket.join(`download:${downloadId}`);
    });

    socket.on('disconnect', () => {
      logger.debug('WebSocket client disconnected', { id: socket.id });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}
