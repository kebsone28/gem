/* eslint-disable @typescript-eslint/no-unused-vars */
import axios from 'axios';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';

const apiClient = axios.create({
  // Use relative URL. Vite dev proxies /api/* to GEM_API_PORT, defaulting to Docker on 5009.
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
    try {
      const { data } = await apiClient.post('auth/refresh');
      // No need to check for accessToken in body, it's in the HttpOnly cookie now.
      
      logger.log('✅ [AUTH] Token refreshed successfully via cookie');
      window.dispatchEvent(
        new CustomEvent('auth:token-refreshed', {
          detail: { user: data.user },
        })
      );
      logoutTriggered = false;
      return 'refreshed'; // Dummy return value
    } finally {
      resetRefreshState();
    }
  })();


  return refreshPromise;
}

// Request Interceptor: Add Auth Token & Project Context
apiClient.interceptors.request.use(
  (config) => {
    const activeProjectId = safeStorage.getItem('active_project_id');
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
        await performTokenRefresh();
        // Cookie is automatically sent now
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
