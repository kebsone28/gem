import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';

interface AuthContextType {
    user: User | null;
    login: (email: string, role: string, name: string, organization?: string, id?: string, accessToken?: string) => void;
    logout: () => void;
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

    const login = (email: string, role: string, name: string, organization?: string, id?: string, accessToken?: string) => {
        const newUser: User = {
            id: id || 'temp-id-' + Date.now(),
            email,
            role: role as UserRole,
            name,
            organization,
        };

        if (accessToken) {
            safeStorage.setItem('access_token', accessToken);
        }
        safeStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
    };

    const logout = () => {
        safeStorage.removeItem('access_token');
        safeStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
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
