import axios from 'axios';
import { db } from '../store/db';

const apiClient = axios.create({
    // Use relative URL - Vite proxy forwards /api/* → http://localhost:5005/api/*
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Request Interceptor: Add Auth Token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh & Offline Queue
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 1. Handle Token Refresh (401)
        const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
        const isAlreadyAtLogin = window.location.pathname === '/login';

        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
            originalRequest._retry = true;
            try {
                // Only try refresh if we have a token (or at least we think we do)
                const hasToken = !!localStorage.getItem('access_token');
                if (!hasToken) throw new Error('No token to refresh');

                const { data } = await apiClient.post('/auth/refresh');
                localStorage.setItem('access_token', data.accessToken);
                return apiClient(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('access_token');

                // CRITICAL: Avoid redirection loop if already at login
                if (!isAlreadyAtLogin) {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        // 2. Handle Offline Support (Network Error & Mutation Methods)
        const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(originalRequest.method?.toUpperCase() || '');
        const isNetworkError = !error.response;

        if (isNetworkError && isMutation && !originalRequest.url?.includes('/auth/')) {
            console.warn('📡 [OFFLINE] Erreur réseau détectée sur une mutation. Mise en file d\'attente...');

            try {
                await db.syncOutbox.add({
                    action: `Mutation: ${originalRequest.url}`,
                    endpoint: originalRequest.url || '',
                    method: originalRequest.method?.toUpperCase() as any,
                    payload: JSON.parse(originalRequest.data || '{}'),
                    timestamp: Date.now(),
                    status: 'pending',
                    retryCount: 0
                });

                // On renvoie une réponse "fictive" de succès pour ne pas bloquer l'UI
                return Promise.resolve({ data: { _offline: true, message: 'Action mémorisée hors-ligne' }, status: 202 });
            } catch (dbError) {
                console.error('❌ Impossible de mettre en file d\'attente :', dbError);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
