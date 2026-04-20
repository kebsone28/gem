import axios from 'axios';
import { db } from '../store/db';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';

const apiClient = axios.create({
  // Use relative URL - Vite proxy forwards /api/* → http://localhost:5005/api/*
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request Interceptor: Add Auth Token & Project Context
apiClient.interceptors.request.use(
  (config) => {
    const token = safeStorage.getItem('access_token');
    const activeProjectId = safeStorage.getItem('active_project_id');

    if (token) {
      if (token === 'undefined' || token === 'null') {
        logger.warn('API-CLIENT', `Found invalid token string in storage: "${token}". Removing.`);
        safeStorage.removeItem('access_token');
      } else {
        config.headers.Authorization = `Bearer ${token}`;
        // logger.debug('API-CLIENT', `Request to ${config.url} with token: ${token.substring(0, 10)}...`);
      }
    } else {
      logger.warn('API-CLIENT', `Request to ${config.url} sent WITHOUT token`);
    }

    if (activeProjectId) {
      config.headers['X-Project-Id'] = activeProjectId;
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
    // ✅ Use flexible matching - URL may be 'auth/login' OR '/auth/login' depending on context
    const url = originalRequest.url || '';
    const isAuthRoute =
      url.includes('auth/login') ||
      url.includes('auth/register') ||
      url.includes('auth/refresh') ||
      url.includes('auth/verify');
    const isAlreadyAtLogin = window.location.pathname === '/login';

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      logger.warn(`🔐 [AUTH] 401 detected on ${url}. Attempting token refresh...`);

      try {
        const hasToken = !!safeStorage.getItem('access_token');
        if (!hasToken) {
          logger.error('❌ [AUTH] No access token found in storage. Redirecting...');
          throw new Error('No token to refresh');
        }

        // Call refresh endpoint
        const { data } = await apiClient.post('auth/refresh');

        if (data.accessToken) {
          logger.log('✅ [AUTH] Token refreshed successfully');
          safeStorage.setItem('access_token', data.accessToken);

          // Force update the original request header
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

          // Re-set global store if needed (CustomEvent to update AuthStore if not done automatically)
          window.dispatchEvent(
            new CustomEvent('auth:token-refreshed', { detail: data.accessToken })
          );

          return apiClient(originalRequest);
        } else {
          logger.error('❌ [AUTH] Refresh response missing accessToken');
          throw new Error('No token in refresh response');
        }
      } catch (refreshError: unknown) {
        const error = refreshError as { message?: string };
        safeStorage.removeItem('access_token');
        safeStorage.removeItem('user');

        // Only notify logout if NOT already on login page (avoid event loops)
        if (!isAlreadyAtLogin) {
          window.dispatchEvent(new CustomEvent('auth:logout'));
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
        return Promise.reject(refreshError);
      }
    }

    // 2. Handle Offline Support (Network Error & Mutation Methods)
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      originalRequest.method?.toUpperCase() || ''
    );
    const isNetworkError = !error.response;

    if (isNetworkError && isMutation && !originalRequest.url?.includes('/auth/')) {
      logger.warn(
        "📡 [OFFLINE] Erreur réseau détectée sur une mutation. Mise en file d'attente..."
      );

      try {
        await db.syncOutbox.add({
          action: `Mutation: ${originalRequest.url}`,
          endpoint: originalRequest.url || '',
          method:
            (originalRequest.method?.toUpperCase() as 'POST' | 'PUT' | 'DELETE' | 'PATCH') ||
            'POST',
          payload: JSON.parse(originalRequest.data || '{}'),
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
        });

        // On renvoie une réponse "fictive" de succès pour ne pas bloquer l'UI
        return Promise.resolve({
          data: { _offline: true, message: 'Action mémorisée hors-ligne' },
          status: 202,
        });
      } catch (dbError) {
        logger.error("❌ Impossible de mettre en file d'attente :", dbError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
