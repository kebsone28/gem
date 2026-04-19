import apiClient from '../api/client';

export const simulationService = {
  async lancerSimulation(params: any): Promise<{ success: boolean; jobId: string }> {
    const response = await apiClient.post('/simulation/lancer', params);
    return response.data;
  },

  async getSimulationStatus(jobId: string): Promise<any> {
    const response = await apiClient.get(`/simulation/status/${jobId}`);
    return response.data;
  }
};
