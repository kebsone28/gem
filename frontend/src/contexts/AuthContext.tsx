import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';

interface AuthContextType {
    user: User | null;
    login: (email: string, role: string, name: string, organization?: string, id?: string, accessToken?: string, organizationConfig?: any) => void;
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

    const login = (email: string, role: string, name: string, organization?: string, id?: string, accessToken?: string, organizationConfig?: any) => {
        const newUser: User = {
            id: id || 'temp-id-' + Date.now(),
            email,
            role: role as UserRole,
            name,
            organization,
            organizationConfig: organizationConfig || {}
        };

        if (accessToken) {
            safeStorage.setItem('access_token', accessToken);
            // Auto-resolve and cache the real server project ID on login
            fetch('/api/projects', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            .then(r => r.json())
            .then(data => {
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
        // Clear simulation state if any
        safeStorage.removeItem('impersonated_user');
        setUser(null);
    };

    /**
     * 🎭 Impersonate: Adopt another user's role temporarily
     */
    const impersonate = (targetUser: User) => {
        if (!user || (user.role !== 'ADMIN_PROQUELEC' && user.email !== 'admingem')) return;

        const originalUser = { ...user };
        const simUser: User = {
            ...targetUser,
            impersonatedBy: originalUser.id,
            originalRole: originalUser.role
        };

        safeStorage.setItem('impersonated_user', JSON.stringify(originalUser));
        safeStorage.setItem('user', JSON.stringify(simUser));
        setUser(simUser);
        logger.log(`🎭 [AUTH] Impersonation started: simulating ${targetUser.name}`);
    };

    /**
     * 🔙 Stop Impersonation: Return to Admin identity
     */
    const stopImpersonation = () => {
        const storedOriginal = safeStorage.getItem('impersonated_user');
        if (!storedOriginal) return;

        const originalUser = JSON.parse(storedOriginal);
        safeStorage.setItem('user', JSON.stringify(originalUser));
        safeStorage.removeItem('impersonated_user');
        setUser(originalUser);
        logger.log('🔙 [AUTH] Impersonation stopped: returned to admin');
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
