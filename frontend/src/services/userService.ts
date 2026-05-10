 
import apiClient from '../api/client';
import type { User, UserRole } from '../utils/types';
import logger from '../utils/logger';

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
    try {
      const response = await apiClient.post('/users', user);
      return response.data;
    } catch (error: any) {
      console.error('❌ [USER_SERVICE] Create User Error Details:', error.response?.data);
      throw error;
    }
  },

  async updateUser(
    id: string,
    user: Partial<ManagedUser> & { password?: string }
  ): Promise<ManagedUser> {
    try {
      logger.debug(`[USER_SERVICE] Updating user ${id}:`, user);
      const response = await apiClient.patch(`/users/${id}`, user);
      return response.data;
    } catch (error: any) {
      console.error('❌ [USER_SERVICE] Update User Error Details:', error.response?.data);
      throw error;
    }
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};
