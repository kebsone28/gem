import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';

export function useMonitoring(canViewReports: boolean) {
  const [activities, setActivities] = useState<any[]>([]);

  const fetchMonitoring = useCallback(async () => {
    if (!canViewReports) return;
    try {
      const response = await apiClient.get('monitoring/activity');
      if (response.data?.activities) {
        setActivities(response.data.activities);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        logger.error('Failed to fetch monitoring data', err);
      }
    }
  }, [canViewReports]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  return { activities, refresh: fetchMonitoring };
}
