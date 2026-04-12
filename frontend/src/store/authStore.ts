/**
 * Auth Store (Zustand + persist)
 * Source of truth for authentication state.
 * Interoperates with AuthContext for backward compatibility.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { User, UserRole } from '../utils/types';
import * as safeStorage from '../utils/safeStorage';

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
              return JSON.parse(storedUser) as User;
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
            role: role as UserRole,
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
