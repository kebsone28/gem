import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';
import logger from '../utils/logger';

export interface PlanningAuditLog {
  action: string;
  details: string;
  userName: string;
  timestamp: string;
  severity?: string;
}

export function usePlanningAuditHistory(showAudit: boolean) {
  const [historyLogs, setHistoryLogs] = useState<PlanningAuditLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const refreshHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get('/audit-logs', {
        params: { module: 'PLANNING', limit: 20 },
      });
      setHistoryLogs(response.data.logs || []);
    } catch (error) {
      logger.warn('[PlanningAuditHistory] Audit history unavailable', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!showAudit) return;
    void refreshHistory();
  }, [showAudit, refreshHistory]);

  return {
    historyLogs,
    isLoadingHistory,
    refreshHistory,
  };
}
