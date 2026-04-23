 
/**
 * Auth Store (Zustand + persist)
 * Source of truth for authentication state.
 * Interoperates with AuthContext for backward compatibility.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { User, UserRole } from '../utils/types';
import * as safeStorage from '../utils/safeStorage';

const ROLE_ALIASES: Record<string, string> = {
  'CP':                  'CHEF_PROJET',
  'CHEF_PROJET':         'CHEF_PROJET',
  'CHEF_DE_PROJET':      'CHEF_PROJET',
  'CHEF DE PROJET':      'CHEF_PROJET',
  'CHEF PROJET':         'CHEF_PROJET',
  'DG':                  'DIRECTEUR',
  'DG_PROQUELEC':        'DIRECTEUR',
  'DIRECTEUR_GENERAL':   'DIRECTEUR',
  'DIRECTEUR GENERAL':   'DIRECTEUR',
  'DIR_GEN':             'DIRECTEUR',
  'DIRECTEUR':           'DIRECTEUR',
  'ADMIN':               'ADMIN_PROQUELEC',
  'ADMIN_PROQUELEC':     'ADMIN_PROQUELEC',
};

export const normalizeRole = (role: string | undefined): UserRole | undefined => {
  if (!role) return undefined;
  const upper = role.toUpperCase();
  return (ROLE_ALIASES[upper] || upper) as UserRole;
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
    accessToken?: string
  ) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        user: (() => {
          // Rehydrate from safe storage on first load
          const storedUser = safeStorage.getItem('user');
          const token = safeStorage.getItem('access_token');
          if (storedUser && token) {
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
        isAuthenticated: !!safeStorage.getItem('access_token'),

        login: (email, role, name, organization, id, accessToken) => {
          const newUser: User = {
            id: id ?? `temp-${Date.now()}`,
            email,
            role: normalizeRole(role) as UserRole,
            name,
            organization,
          };
          if (accessToken) safeStorage.setItem('access_token', accessToken);
          safeStorage.setItem('user', JSON.stringify(newUser));
          set({ user: newUser, isAuthenticated: true });
        },

        logout: () => {
          safeStorage.removeItem('access_token');
          safeStorage.removeItem('user');
          set({ user: null, isAuthenticated: false });
        },

        setUser: (user) => {
          if (user && user.role) user.role = normalizeRole(user.role) as UserRole;
          set({ user, isAuthenticated: !!user });
        },
      }),
      {
        name: 'gem-auth-store',
        // Only persist non-sensitive metadata (token stays in safeStorage, not store)
        partialize: (state) => ({ user: state.user }),
      }
    )
  )
);
