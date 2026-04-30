/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import { useAuthStore, normalizeRole } from '../store/authStore';
import apiClient from '../api/client';

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    accessToken?: string,
    organizationConfig?: any,
    permissions?: string[]
  ) => void;
  logout: () => void;
  impersonate: (targetUser: User) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeSessionUser = (rawUser: any): User => ({
  id: rawUser.id || `temp-id-${Date.now()}`,
  email: rawUser.email,
  role: (normalizeRole(rawUser.role) as UserRole) || (rawUser.role as UserRole),
  name: rawUser.name,
  organization: rawUser.organization || rawUser.organizationName,
  organizationConfig: rawUser.organizationConfig || {},
  permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = safeStorage.getItem('user');
    const token = safeStorage.getItem('access_token');
    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser);
        // 🛠️ Auto-réparation du rôle corrompu
        if (parsed && parsed.email === 'admingem' && !parsed.role) {
          parsed.role = 'ADMIN_PROQUELEC';
          safeStorage.setItem('user', JSON.stringify(parsed));
          logger.log('🛠️ [AUTH] Rôle Admin restauré pour admingem');
        }
        return parsed;
      } catch (e) {
        logger.error('Failed to parse stored user', e);
        safeStorage.removeItem('user');
        safeStorage.removeItem('access_token');
        return null;
      }
    }
    return null;
  });

  const applySessionUser = (nextUser: User) => {
    setUser(nextUser);
    useAuthStore.getState().setUser(nextUser);
    safeStorage.setItem('user', JSON.stringify(nextUser));
  };

  const refreshSession = async () => {
    if (!safeStorage.getItem('access_token')) return;
    try {
      const { data } = await apiClient.post('auth/refresh');
      if (data?.accessToken) {
        safeStorage.setItem('access_token', data.accessToken);
      }
      if (data?.user) {
        applySessionUser(normalizeSessionUser(data.user));
      }
    } catch (err) {
      logger.warn('[AUTH] Session refresh skipped/failed', err);
    }
  };

  // Listen for forced logout events dispatched by apiClient when token refresh fails.
  // This breaks the stale-auth sync loop without needing AuthContext inside interceptors.
  useEffect(() => {
    const handleForceLogout = () => {
      logger.warn('🔐 [AUTH] Force logout: token refresh failed, clearing session');
      safeStorage.removeItem('access_token');
      safeStorage.removeItem('user');
      safeStorage.removeItem('active_project_id');
      safeStorage.removeItem('last_sync_timestamp');
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
  }, []);

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
  }, [user?.id]);

  const login = (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    accessToken?: string,
    organizationConfig?: any,
    permissions?: string[]
  ) => {
    logger.info(`[AUTH-CONTEXT] Login called for ${email}. AccessToken provided: ${accessToken ? 'YES' : 'NO'}`);
    
    if (accessToken && (accessToken === 'undefined' || accessToken === 'null')) {
      logger.error('[AUTH-CONTEXT] Received invalid token string:', accessToken);
      accessToken = undefined;
    }

    const newUser: User = {
      id: id || 'temp-id-' + Date.now(),
      email,
      role: normalizeRole(role) as UserRole || role as UserRole,
      name,
      organization,
      organizationConfig: organizationConfig || {},
      permissions: Array.isArray(permissions) ? permissions : [],
    };

    applySessionUser(newUser);
    
    // Update GLOBAL store
    useAuthStore.getState().login(email, role, name, organization, id, accessToken, permissions);

    if (accessToken) {
      safeStorage.setItem('access_token', accessToken);
    }

    // Clear stale project/session-specific pointers. ProjectContext will repopulate them from the server.
    safeStorage.removeItem('active_project_id');
    safeStorage.removeItem('last_sync_timestamp');
  };

  const logout = () => {
    useAuthStore.getState().logout();
    safeStorage.removeItem('access_token');
    safeStorage.removeItem('user');
    safeStorage.removeItem('admin_access_token');
    safeStorage.removeItem('admin_user_data');
    safeStorage.removeItem('active_project_id');
    safeStorage.removeItem('last_sync_timestamp');
    setUser(null);
  };

  /**
   * 🎭 Impersonate: Adopt another user's role via Backend Security
   */
  const impersonate = async (targetUser: User) => {
    if (!user || (user.role !== 'ADMIN_PROQUELEC' && user.email !== 'admingem')) {
      logger.warn("🚫 Tentative d'impersonation non autorisée bloquée côté client");
      return;
    }

    try {
      const currentToken = safeStorage.getItem('access_token');
      const response = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ targetUserId: targetUser.id, reason: 'Support Administratif' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'impersonation");
      }

      const data = await response.json();

      // 💾 SAUVEGARDE DE L'IDENTITÉ ADMIN REELLE
      safeStorage.setItem('admin_access_token', currentToken!);
      safeStorage.setItem('admin_user_data', JSON.stringify(user));

      // 🔄 SWITCH VERS L'IDENTITÉ SIMULÉE
      safeStorage.setItem('access_token', data.accessToken);
      safeStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      logger.log(`🎭 [AUTH] Simulation active : ${targetUser.name}`);

      // Recharger la page pour réinitialiser tous les états de l'app avec le nouveau token
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
      const currentToken = safeStorage.getItem('access_token');
      const response = await fetch('/api/auth/stop-impersonation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'arrêt de la simulation");
      }

      const data = await response.json();

      // 🔄 RESTAURATION DE L'IDENTITÉ ADMIN (Token neuf reçu du serveur)
      safeStorage.setItem('access_token', data.accessToken);
      safeStorage.setItem('user', JSON.stringify(data.user));

      // 🧹 NETTOYAGE DES ÉTATS TEMPORAIRES (Si présents)
      safeStorage.removeItem('admin_access_token');
      safeStorage.removeItem('admin_user_data');

      logger.log('🔙 [AUTH] Sessions simulée fermée, retour admin validé');

      // Recharger pour réinitialiser l'application
      window.location.reload();
    } catch (error: any) {
      logger.error('❌ Stop impersonation failed:', error);
      // Fallback de sécurité si l'API échoue : on déconnecte tout
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, impersonate, stopImpersonation }}>
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
