/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import apiClient from '../api/client';
import type { User, UserRole } from '../utils/types';

export interface ManagedUser extends User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  requires2FA: boolean;
  teamId?: string;
  createdAt: string;
}

export const userService = {
  async getUsers(): Promise<ManagedUser[]> {
    const response = await apiClient.get('/users');
    return response.data.users;
  },

  async createUser(user: Partial<ManagedUser> & { password?: string }): Promise<ManagedUser> {
    const response = await apiClient.post('/users', user);
    return response.data;
  },

  async updateUser(
    id: string,
    user: Partial<ManagedUser> & { password?: string }
  ): Promise<ManagedUser> {
    console.debug(`[USER_SERVICE] Updating user ${id}:`, user);
    const response = await apiClient.patch(`/users/${id}`, user);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};
