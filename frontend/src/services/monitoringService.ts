/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
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

  async getPerformanceMetrics(): Promise<{ cpu: number; memory: number; requests: number }> {
    const response = await apiClient.get('/monitoring/performance');
    return response.data;
  },

  async getSystemHealth(): Promise<{ status: string; services: Record<string, string> }> {
    const response = await apiClient.get('/monitoring/system-health');
    return response.data;
  }
};
