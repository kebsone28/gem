 
/**
 * Auth Store (Zustand + persist)
 * Source of truth for authentication state.
 * Interoperates with AuthContext for backward compatibility.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { User, UserRole } from '../utils/types';
import * as safeStorage from '../utils/safeStorage';

import { normalizeRole as canonicalNormalizeRole } from '../core/security/permissions';

export const normalizeRole = (role: string | undefined): UserRole | undefined => {
  if (!role) return undefined;
  return (canonicalNormalizeRole(role) ?? role.toUpperCase()) as UserRole;
};

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  login: (
    email: string,
    role: string,
    name: string,
    organization?: string,
    id?: string,
    permissions?: string[]
  ) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        user: (() => {
          // Rehydrate from safe storage on first load (Optimistic UI)
          const storedUser = safeStorage.getItem('user');
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser) as User;
              if (parsed.role) parsed.role = normalizeRole(parsed.role) as UserRole;
              return parsed;
            } catch {
              return null;
            }
          }
          return null;
        })(),
        isAuthenticated: !!safeStorage.getItem('user'),

        login: (email, role, name, organization, id, permissions) => {
          const newUser: User = {
            id: id ?? `temp-${Date.now()}`,
            email,
            role: normalizeRole(role) as UserRole,
            name,
            organization,
            permissions: Array.isArray(permissions) ? permissions : [],
          };
          safeStorage.setItem('user', JSON.stringify(newUser));
          set({ user: newUser, isAuthenticated: true });
        },

        logout: () => {
          safeStorage.removeItem('user');
          set({ user: null, isAuthenticated: false });
        },

        setUser: (user) => {
          if (user && user.role) user.role = normalizeRole(user.role) as UserRole;
          set({ user, isAuthenticated: !!user });
        },
      }),
      {
        name: 'ged-os-auth-store',
        // Only persist non-sensitive metadata (token stays in safeStorage, not store)
        partialize: (state) => ({ user: state.user }),
      }
    )
  )
);
