import apiClient from '../api/client';

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export const monitoringService = {
  async getActivityLogs(): Promise<ActivityLog[]> {
    const response = await apiClient.get('/monitoring/activity');
    return response.data;
  },

  async getPerformanceMetrics(): Promise<{ cpu: number; memory: number; requests: number }> => {
    const response = await apiClient.get('/monitoring/performance');
    return response.data;
  },

  async getSystemHealth(): Promise<{ status: string; services: Record<string, string> }> => {
    const response = await apiClient.get('/monitoring/system-health');
    return response.data;
  }
};
