import apiClient from '../api/client';
import type { Household } from '../utils/types';

export const householdService = {
  async getHouseholds(params?: Record<string, string | number | boolean>): Promise<Household[]> {
    const response = await apiClient.get('/households', { params });
    return response.data;
  },

  async getHouseholdsCount(): Promise<number> {
    const response = await apiClient.get('/households/count');
    return response.data.count;
  },

  async getHouseholdByNumero(numeroordre: string): Promise<Household> {
    const response = await apiClient.get(`/households/by-numero/${numeroordre}`);
    return response.data;
  },

  async getHouseholdById(id: string): Promise<Household> {
    const response = await apiClient.get(`/households/${id}`);
    return response.data;
  },

  async createHousehold(household: Partial<Household>): Promise<Household> {
    const response = await apiClient.post('/households', household);
    return response.data;
  },

  async updateHousehold(id: string, household: Partial<Household>): Promise<Household> {
    const response = await apiClient.patch(`/households/${id}`, household);
    return response.data;
  },
};
