import { Server } from 'socket.io';
import { config } from '../core/config/config.js';

class SocketService {
    constructor() {
        this.io = null;
        this.socketMeta = new Map();
        this.userSockets = new Map();
    }

    init(httpServer) {
        this.io = new Server(httpServer, {
            cors: config.cors
        });

        this.io.on('connection', (socket) => {
            console.log(`🔌 New client connected: ${socket.id}`);

            // The client explicitly identifies itself
            socket.on('authenticate', (data) => {
                const { userId, role, organizationId } = data || {};
                if (userId) {
                    socket.join(`user_${userId}`);
                    console.log(`👤 Socket ${socket.id} authenticated as user_${userId}`);
                }
                if (role) {
                    socket.join(`role_${role}`);
                }
                if (organizationId) {
                    socket.join(`org_${organizationId}`);
                }
                if (userId) {
                    this.registerPresence(socket.id, { userId, role, organizationId });
                }
            });

            socket.on('join_room', (room) => {
                socket.join(room);
                console.log(`👤 Socket ${socket.id} joined room ${room}`);
            });

            socket.on('disconnect', () => {
                this.unregisterPresence(socket.id);
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

    emitToUser(userId, event, data) {
        if (!this.io) return;
        this.io.to(`user_${userId}`).emit(event, data);
    }

    emitToRole(role, event, data) {
        if (!this.io) return;
        this.io.to(`role_${role}`).emit(event, data);
    }

    registerPresence(socketId, meta) {
        const existing = this.socketMeta.get(socketId);
        if (existing?.organizationId && existing?.userId) {
            this.unregisterPresence(socketId);
        }

        this.socketMeta.set(socketId, meta);

        if (!meta?.userId) {
            return;
        }

        if (!this.userSockets.has(meta.userId)) {
            this.userSockets.set(meta.userId, new Set());
        }

        this.userSockets.get(meta.userId).add(socketId);
        this.broadcastPresence(meta.organizationId);
    }

    unregisterPresence(socketId) {
        const meta = this.socketMeta.get(socketId);
        if (!meta?.userId) {
            this.socketMeta.delete(socketId);
            return;
        }

        const sockets = this.userSockets.get(meta.userId);
        if (sockets) {
            sockets.delete(socketId);
            if (sockets.size === 0) {
                this.userSockets.delete(meta.userId);
            }
        }

        this.socketMeta.delete(socketId);
        this.broadcastPresence(meta.organizationId);
    }

    getOrganizationPresence(organizationId) {
        if (!organizationId) return [];

        const onlineUserIds = new Set();
        for (const meta of this.socketMeta.values()) {
            if (meta?.organizationId === organizationId && meta?.userId) {
                onlineUserIds.add(meta.userId);
            }
        }

        return Array.from(onlineUserIds);
    }

    broadcastPresence(organizationId) {
        if (!this.io || !organizationId) return;

        this.io.to(`org_${organizationId}`).emit('chat:presence', {
            userIds: this.getOrganizationPresence(organizationId),
        });
    }

    close() {
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        this.socketMeta.clear();
        this.userSockets.clear();
    }
}

export const socketService = new SocketService();
