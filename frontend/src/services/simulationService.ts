import apiClient from '../api/client';

export const simulationService = {
  async lancerSimulation(params: { households: number; region?: string }): Promise<{ success: boolean; jobId: string }> {
    const response = await apiClient.post('/simulation/lancer', params);
    return response.data;
  },

  async getSimulationStatus(jobId: string): Promise<{ status: string; progress?: number; results?: unknown }> => {
    const response = await apiClient.get(`/simulation/status/${jobId}`);
    return response.data;
  }
};
