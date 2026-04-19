import apiClient from '../api/client';

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  createdAt: string;
}

export const monitoringService = {
  async getActivityLogs(): Promise<ActivityLog[]> {
    const response = await apiClient.get('/monitoring/activity');
    return response.data;
  },

  async getPerformanceMetrics(): Promise<any> {
    const response = await apiClient.get('/monitoring/performance');
    return response.data;
  },

  async getSystemHealth(): Promise<any> {
    const response = await apiClient.get('/monitoring/system-health');
    return response.data;
  }
};
