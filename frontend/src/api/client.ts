/* eslint-disable @typescript-eslint/no-unused-vars */
import axios from 'axios';
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

let refreshPromise: Promise<string> | null = null;
let logoutTriggered = false;

function isPublicAuthRoute(url = ''): boolean {
  return (
    url.includes('auth/login') ||
    url.includes('auth/register') ||
    url.includes('auth/verify-2fa') ||
    url.includes('auth/reset-password')
  );
}

function isRefreshRoute(url = ''): boolean {
  return url.includes('auth/refresh');
}

function resetRefreshState() {
  refreshPromise = null;
}

function triggerSingleLogout(isAlreadyAtLogin: boolean) {
  safeStorage.removeItem('access_token');
  safeStorage.removeItem('user');

  if (logoutTriggered || isAlreadyAtLogin) return;

  logoutTriggered = true;
  window.dispatchEvent(new CustomEvent('auth:logout'));
  setTimeout(() => {
    window.location.href = '/login';
  }, 100);
}

async function performTokenRefresh(): Promise<string> {
  if (refreshPromise) {
    logger.debug('🔐 [AUTH] Refresh already in progress. Waiting for shared refresh promise...');
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const hasToken = !!safeStorage.getItem('access_token');
    if (!hasToken) {
      logger.error('❌ [AUTH] No access token found in storage. Refresh cancelled.');
      throw new Error('No token to refresh');
    }

    try {
      try {
        console.debug('[AUTH-REFRESH] document.cookie length=', (document.cookie || '').length);
      } catch {
        // Cookie inspection is diagnostic only.
      }

      const { data } = await apiClient.post('auth/refresh');
      if (!data?.accessToken) {
        logger.error('❌ [AUTH] Refresh response missing accessToken');
        throw new Error('No token in refresh response');
      }

      logger.log('✅ [AUTH] Token refreshed successfully');
      safeStorage.setItem('access_token', data.accessToken);
      window.dispatchEvent(
        new CustomEvent('auth:token-refreshed', {
          detail: { accessToken: data.accessToken, user: data.user },
        })
      );
      logoutTriggered = false;
      return data.accessToken as string;
    } finally {
      resetRefreshState();
    }
  })();

  return refreshPromise;
}

// Request Interceptor: Add Auth Token & Project Context
apiClient.interceptors.request.use(
  (config) => {
    const token = safeStorage.getItem('access_token');
    const activeProjectId = safeStorage.getItem('active_project_id');
    const url = config.url || '';
    const publicAuthRoute = isPublicAuthRoute(url);
    const refreshRoute = isRefreshRoute(url);

    if (token && !refreshRoute) {
      if (token === 'undefined' || token === 'null') {
        logger.warn('API-CLIENT', `Found invalid token string in storage: "${token}". Removing.`);
        safeStorage.removeItem('access_token');
      } else {
        config.headers.Authorization = `Bearer ${token}`;
        // Diagnostic: confirm header presence (masked)
        console.debug('[API-CLIENT] Authorization header set (masked)');
        // logger.debug('API-CLIENT', `Request to ${config.url} with token: ${token.substring(0, 10)}...`);
      }
    } else if (!publicAuthRoute && !refreshRoute) {
      logger.debug('API-CLIENT', `Request to ${config.url} sent WITHOUT token`);
    }

    if (activeProjectId) {
      config.headers['X-Project-Id'] = activeProjectId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh. Mutations are server-only:
// no fake offline success and no local workflow queue for official data.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 1. Handle Token Refresh (401)
    // ✅ Use flexible matching - URL may be 'auth/login' OR '/auth/login' depending on context
    const url = originalRequest.url || '';
    const publicAuthRoute = isPublicAuthRoute(url);
    const refreshRoute = isRefreshRoute(url);
    const isAlreadyAtLogin = window.location.pathname === '/login';

    if (error.response?.status === 401 && !originalRequest._retry && !publicAuthRoute && !refreshRoute) {
      originalRequest._retry = true;
      logger.debug(`🔐 [AUTH] 401 detected on ${url}. Attempting token refresh...`);

      try {
        const refreshedAccessToken = await performTokenRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshedAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError: unknown) {
        const refreshMessage = (refreshError as { message?: string })?.message;
        logger.error(`❌ [AUTH] Token refresh failed while replaying ${url}: ${refreshMessage || 'unknown error'}`);
        triggerSingleLogout(isAlreadyAtLogin);
        return Promise.reject(refreshError);
      }
    }

    // 2. Server-first mutations: reject network errors instead of creating local official state.
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      originalRequest.method?.toUpperCase() || ''
    );
    const isNetworkError = !error.response;

    if (isNetworkError && isMutation && !originalRequest.url?.includes('/auth/')) {
      logger.warn(`📡 [SERVER-FIRST] Mutation refusée hors-ligne: ${originalRequest.url}`);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
