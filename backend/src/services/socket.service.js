import { Server } from 'socket.io';
import { config } from '../core/config/config.js';

class SocketService {
    constructor() {
        this.io = null;
    }

    init(httpServer) {
        this.io = new Server(httpServer, {
            cors: config.cors
        });

        this.io.on('connection', (socket) => {
            console.log(`🔌 New client connected: ${socket.id}`);

            socket.on('join_room', (room) => {
                socket.join(room);
                console.log(`👤 Socket ${socket.id} joined room ${room}`);
            });

            socket.on('disconnect', () => {
                console.log(`🔌 Client disconnected: ${socket.id}`);
            });
        });

        console.log('✅ WebSockets initialized successfully');
    }

    /**
     * Broadcast an event to all connected clients or a specific room
     */
    emit(event, data, room = null) {
        if (!this.io) {
            console.warn('⚠️ Cannot emit event: Socket.io not initialized');
            return;
        }

        if (room) {
            this.io.to(room).emit(event, data);
        } else {
            this.io.emit(event, data);
        }
    }
}

export const socketService = new SocketService();
