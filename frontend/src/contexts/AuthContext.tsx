import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../utils/types';

interface AuthContextType {
    user: User | null;
    login: (username: string, role: UserRole, name: string, teamId?: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Restore session from localStorage if present
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse stored user', e);
                localStorage.removeItem('user');
            }
        }
    }, []);

    const login = (username: string, role: UserRole, name: string, teamId?: string) => {
        const newUser: User = {
            id: 'mock-id-' + Date.now(),
            email: username, // 'email' field reused for username (backward compat)
            role,
            name,
            teamId,
        };

        localStorage.setItem('access_token', 'demo-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
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
