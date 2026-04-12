import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    accessToken?: string,
    organizationConfig?: any
  ) => void;
  logout: () => void;
  impersonate: (targetUser: User) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = safeStorage.getItem('user');
    const token = safeStorage.getItem('access_token');
    if (storedUser && token) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        logger.error('Failed to parse stored user', e);
        safeStorage.removeItem('user');
        safeStorage.removeItem('access_token');
        return null;
      }
    }
    return null;
  });

  // Listen for forced logout events dispatched by apiClient when token refresh fails.
  // This breaks the stale-auth sync loop without needing AuthContext inside interceptors.
  useEffect(() => {
    const handleForceLogout = () => {
      logger.warn('🔐 [AUTH] Force logout: token refresh failed, clearing session');
      safeStorage.removeItem('access_token');
      safeStorage.removeItem('user');
      setUser(null);
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    accessToken?: string,
    organizationConfig?: any
  ) => {
    const newUser: User = {
      id: id || 'temp-id-' + Date.now(),
      email,
      role: role as UserRole,
      name,
      organization,
      organizationConfig: organizationConfig || {},
    };

    if (accessToken) {
      safeStorage.setItem('access_token', accessToken);
      // Auto-resolve and cache the real server project ID on login
      fetch('/api/projects', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const projects = data.projects || data || [];
          if (projects[0]?.id && !projects[0].id.startsWith('proj_')) {
            safeStorage.setItem('active_project_id', projects[0].id);
          }
        })
        .catch(() => {}); // Silent fail - useProject hook handles fallback
    }
    safeStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    safeStorage.removeItem('access_token');
    safeStorage.removeItem('user');
    // Nettoyage complet des états de simulation
    safeStorage.removeItem('admin_access_token');
    safeStorage.removeItem('admin_user_data');
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
