/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import logger from '../utils/logger';

export function usePerformance(projectId?: string) {
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/kpi/${projectId}`);
      setPerformanceData(response.data);
      setError(null);
    } catch (err: any) {
      logger.error('Failed to fetch performance data', err);
      setError(err.response?.data?.error || 'Failed to fetch performance data');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchPerformance();
    }
  }, [fetchPerformance, projectId]);

  return {
    performanceData,
    isLoading,
    error,
    refresh: fetchPerformance,
  };
}
