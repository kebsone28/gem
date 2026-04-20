/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { auditService } from '../../../../services/auditService';
import type { AuditLog } from '../../../../utils/types';
import type { Activity } from '../types';

export function useAuditLogs(remoteActivities: any[] = []) {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchLogs = useCallback(async () => {
    const data = await auditService.getLastLogs(5);
    setLogs(data);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const feedActivities = useMemo((): Activity[] => {
    const formattedLogs: Activity[] = logs.map((log) => ({
      id: log.id,
      type: log.severity === 'critical' ? 'danger' : log.severity === 'warning' ? 'warning' : 'success',
      message: `${log.userName}: ${log.action} - ${log.details}`,
      time: new Date(log.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    if (formattedLogs.length > 0) return formattedLogs;

    // Fallback to monitoring activities if no audit logs
    return remoteActivities.slice(0, 5).map((a) => ({
      id: a.id || Math.random().toString(),
      type: a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'success',
      message: a.message,
      time: a.timestamp || "À l'instant",
    }));
  }, [logs, remoteActivities]);

  return { feedActivities, refresh: fetchLogs };
}
