import apiClient from '../api/client';
import type { Zone } from '../utils/types';

export const zoneService = {
  async getZones(projectId?: string): Promise<Zone[]> {
    const response = await apiClient.get('/zones', { params: { projectId } });
    return response.data.zones || response.data;
  },

  async createZone(zone: Partial<Zone>): Promise<Zone> {
    const response = await apiClient.post('/zones', zone);
    return response.data;
  },

  async deleteZone(id: string): Promise<void> {
    await apiClient.delete(`/zones/${id}`);
  }
};
