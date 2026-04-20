/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import apiClient from '../api/client';
// import type { Zone } from '../utils/types'; // Removed bad import

export const zoneService = {
  async getZones(projectId?: string): Promise<any[]> {
    const response = await apiClient.get('/zones', { params: { projectId } });
    return response.data.zones || response.data;
  },

  async createZone(zone: any): Promise<any> {
    const response = await apiClient.post('/zones', zone);
    return response.data;
  },

  async deleteZone(id: string): Promise<void> {
    await apiClient.delete(`/zones/${id}`);
  }
};
