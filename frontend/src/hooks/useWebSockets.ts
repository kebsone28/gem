import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export const useWebSockets = () => {
    const { user } = useAuth();
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!user) return;

        // Connect via Vite proxy: /socket.io is proxied to localhost:5000
        // This eliminates WebSocket CORS issues for any Vite port.
        const BASE_URL = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
            : window.location.origin; // Use Vite's own origin → proxy handles the rest

        socketRef.current = io(BASE_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        const socket = socketRef.current;

        socket.on('connect_error', (error) => {
            console.error('❌ Erreur de connexion WebSocket:', error.message);
        });

        socket.on('connect', () => {
            console.log('✅ Connecté aux WebSockets (Status: ONLINE)');
        });

        // Handle generic real-time notifications
        socket.on('notification', (data: any) => {
            // Allow SYNC notifications even for self to confirm operation success
            if (data?.type !== 'SYNC' && data?.data?.user && data.data.user === user?.id) {
                return;
            }

            // Simple DOM-based toast for immediate MVP impact
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 right-4 z-[9999] bg-indigo-600/95 backdrop-blur-xl border border-indigo-400/30 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 transition-all duration-300 transform translate-y-10 opacity-0';
            toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            toast.innerHTML = `
                <div class="px-3 py-2 bg-white/20 rounded-xl text-xl shrink-0">📡</div>
                <div>
                   <h4 class="font-black text-sm tracking-tight">${data.message || 'Mise à jour entrante'}</h4>
                   <p class="text-[11px] text-indigo-100 mt-0.5 font-medium leading-tight">${data.type === 'SYNC' ? 'Données synchronisées depuis le cloud.' : 'Alerte temps réel reçue.'}</p>
                </div>
            `;

            document.body.appendChild(toast);

            // Pop in
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
            });

            // Pop out after 5s
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 400);
            }, 5000);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Déconnecté des WebSockets');
        });

        return () => {
            if (socket) {
                console.log('🧹 Nettoyage WebSocket...');
                socket.off('connect');
                socket.off('notification');
                socket.off('disconnect');
                socket.off('connect_error');
                if (socket.connected) {
                    socket.disconnect();
                }
            }
        };
    }, [user?.id]);

    return socketRef.current;
};
