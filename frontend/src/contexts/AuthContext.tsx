import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import { useAuthStore, normalizeRole } from '../store/authStore';
import apiClient from '../api/client';
import { isMasterAdminEmail, isAdminRole } from '../core/security/roleUtils';

interface RawUser {
  id?: string;
  email: string;
  role: string;
  name: string;
  organization?: string;
  organizationName?: string;
  organizationConfig?: Record<string, unknown>;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    organizationConfig?: Record<string, unknown>,
    permissions?: string[]
  ) => void;
  logout: () => void;
  impersonate: (targetUser: User) => void;
  stopImpersonation: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeSessionUser = (rawUser: RawUser): User => ({
  id: rawUser.id || `temp-id-${Date.now()}`,
  email: rawUser.email,
  role: (normalizeRole(rawUser.role) as UserRole) || (rawUser.role as UserRole),
  name: rawUser.name,
  organization: rawUser.organization || rawUser.organizationName,
  organizationConfig: rawUser.organizationConfig || {},
  permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  const isRefreshingRef = useRef(false);

  const applySessionUser = useCallback((nextUser: User) => {
    setUser(nextUser);
    useAuthStore.getState().setUser(nextUser);
    safeStorage.setItem('user', JSON.stringify(nextUser));
  }, []);

  const verifySession = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('auth/me');
      if (data) {
        applySessionUser(normalizeSessionUser(data));
      }
    } catch (err) {
      logger.debug('[AUTH] No active session found on startup');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [applySessionUser]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const refreshSession = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const { data } = await apiClient.post('auth/refresh');
      if (data?.user) {
        applySessionUser(normalizeSessionUser(data.user));
      }
    } catch (err) {
      logger.warn('[AUTH] Session refresh skipped/failed', err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [applySessionUser]);


  // Listen for forced logout events dispatched by apiClient when token refresh fails.
  // This breaks the stale-auth sync loop without needing AuthContext inside interceptors.
  useEffect(() => {
    const handleForceLogout = () => {
      logger.warn('🔐 [AUTH] Force logout: token refresh failed, clearing session');
      safeStorage.removeItem('access_token');
      safeStorage.removeItem('user');
      safeStorage.removeItem('active_project_id');
      safeStorage.removeItem('last_sync_timestamp');
      useAuthStore.getState().logout();
      setUser(null);
    };
    const handleTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ accessToken?: string; user?: User }>).detail;
      if (detail?.user) {
        applySessionUser(normalizeSessionUser(detail.user));
      }
    };

    window.addEventListener('auth:logout', handleForceLogout);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);
    return () => {
      window.removeEventListener('auth:logout', handleForceLogout);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);
    };
  }, [applySessionUser]);

  useEffect(() => {
    if (!user) return;

    const handleFocus = () => {
      void refreshSession();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    const interval = window.setInterval(() => {
      void refreshSession();
    }, 60_000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshSession, user]);

  const login = (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    organizationConfig?: any,
    permissions?: string[]
  ) => {
    logger.info(`[AUTH-CONTEXT] Login successful for ${email}.`);

    const newUser: User = {
      id: id || 'temp-id-' + Date.now(),
      email,
      role: (normalizeRole(role) as UserRole) || (role as UserRole),
      name,
      organization,
      organizationConfig: organizationConfig || {},
      permissions: Array.isArray(permissions) ? permissions : [],
    };

    applySessionUser(newUser);

    // Clear stale project/session-specific pointers. ProjectContext will repopulate them from the server.
    safeStorage.removeItem('active_project_id');
    safeStorage.removeItem('last_sync_timestamp');
  };


  const logout = () => {
    useAuthStore.getState().logout();
    safeStorage.removeItem('user');
    safeStorage.removeItem('admin_user_data');
    safeStorage.removeItem('active_project_id');
    safeStorage.removeItem('last_sync_timestamp');
    setUser(null);
    
    // Explicitly call backend logout to clear cookies
    apiClient.post('auth/logout').catch(() => {
      // Ignore errors during logout
    });
  };


  /**
   * 🎭 Impersonate: Adopt another user's role via Backend Security
   */
  const impersonate = async (targetUser: User) => {
    if (!user || (!isAdminRole(user.role) && !isMasterAdminEmail(user.email))) {
      logger.warn(`🚫 Tentative d'impersonation bloquée. User: ${user?.email}, Role: ${user?.role}`);
      return;
    }

    try {
      const { data } = await apiClient.post('auth/impersonate', {
        targetUserId: targetUser.id,
        reason: 'Support Administratif',
      });

      // 💾 SAUVEGARDE DE L'IDENTITÉ ADMIN REELLE
      safeStorage.setItem('admin_user_data', JSON.stringify(user));

      // 🔄 SWITCH VERS L'IDENTITÉ SIMULÉE
      safeStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      logger.log(`🎭 [AUTH] Simulation active : ${targetUser.name}`);

      // Rechargement conservé temporairement pour garantir un état applicatif propre.
      window.location.reload();
    } catch (error: any) {
      logger.error('❌ Impersonation failed:', error);
      alert(`Erreur: ${error.message}`);
    }
  };


  /**
   * 🔙 Stop Impersonation: Return to Admin identity via Backend Validation
   */
  const stopImpersonation = async () => {
    try {
      const { data } = await apiClient.post('auth/stop-impersonation');

      // 🔄 RESTAURATION DE L'IDENTITÉ ADMIN
      safeStorage.setItem('user', JSON.stringify(data.user));

      // 🧹 NETTOYAGE DES ÉTATS TEMPORAIRES
      safeStorage.removeItem('admin_user_data');

      logger.log('🔙 [AUTH] Sessions simulée fermée, retour admin validé');

      window.location.reload();
    } catch (error: any) {
      logger.error('❌ Stop impersonation failed:', error);
      // Fallback de sécurité si l'API échoue : on déconnecte tout
      logout();
    }
  };


  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, impersonate, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
