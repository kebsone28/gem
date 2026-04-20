/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';
import { syncEventBus } from '../utils/syncEventBus';

let socketInstance: Socket | null = null;

export const useWebSockets = () => {
  const { user } = useAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    // 1. Cleanup if user logs out
    if (!user) {
      if (socketInstance) {
        logger.log('🧹 Nettoyage WebSocket (Déconnexion utilisateur)...');
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    // 2. Prevent double listener initialization in Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 3. Robust URL resolution (Vite dev -> local proxy base, Prod -> direct URL)
    const BASE_URL = import.meta.env.PROD
      ? import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || window.location.origin
      : window.location.origin;

    if (!socketInstance) {
      logger.log('🚀 Initialisation du WebSocket Singleton...');
      socketInstance = io(BASE_URL, {
        withCredentials: true,
        // ✅ CRITICAL: Start with polling so Vite's HTTP proxy can handle the handshake,
        // then Socket.io will automatically upgrade to WebSocket (ws transport)
        transports: ['polling', 'websocket'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
      });
    }

    const socket = socketInstance;

    socket.on('connect_error', (error) => {
      logger.error('❌ Erreur de connexion WebSocket:', error.message);
    });

    socket.on('connect', () => {
      logger.log('✅ Connecté aux WebSockets (Status: ONLINE)');
      syncEventBus.initSocket(socket);

      // S'authentifier auprès du backend pour rejoindre ses Salles (Rooms)
      socket.emit('authenticate', {
        userId: user?.id,
        role: user?.role,
      });
    });

    // Handle generic real-time notifications via standard event bus
    socket.on('notification', (data: Record<string, unknown>) => {
      // Ignorer les notifications destinées à UN AUTRE utilisateur spécifiquement
      if (data?.data?.user && data.data.user !== user?.id) {
        return;
      }

      // Propager proprement au système de notification React (NotificationCenter / Toaster)
      syncEventBus.emit('notification', data);
    });

    socket.on('disconnect', () => {
      logger.log('🔌 Déconnecté des WebSockets');
    });

    // Nettoyage strict des LISTENERS au démontage
    // (Le composant est démonté, on enlève SES écouteurs pour éviter les doublons au prochain mount)
    return () => {
      initializedRef.current = false;
      if (socket) {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('notification');
        socket.off('disconnect');
      }
    };
  }, [user]);

  return socketInstance;
};
