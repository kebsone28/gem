/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { auditService } from '../../../../services/auditService';
import logger from '../../../../utils/logger';
import type { AuditLog } from '../../../../utils/types';
import type { Activity } from '../types';

export function useAuditLogs(remoteActivities: any[] = []) {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchLogs = useCallback(async () => {
    const data = await auditService.getLastLogs(5);
    setLogs(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const t = window.setTimeout(() => {
      (async () => {
        try {
          const data = await auditService.getLastLogs(5);
          if (mounted) setLogs(data);
        } catch (e) {
          logger.warn('[audit] feed unavailable', e);
        }
      })();
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);

  const feedActivities = useMemo((): Activity[] => {
    const formattedLogs: Activity[] = logs.map((log) => ({
      id: log.id,
      type:
        log.severity === 'critical'
          ? 'danger'
          : log.severity === 'warning'
            ? 'warning'
            : 'success',
      message: `${log.userName}: ${log.action} - ${log.details}`,
      time: new Date(log.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    if (formattedLogs.length > 0) {
      return formattedLogs;
    }

    return remoteActivities.slice(0, 5).map((activity, idx) => ({
      id: activity.id || `remote-${idx}`,
      type:
        activity.type === 'error'
          ? 'danger'
          : activity.type === 'warning'
            ? 'warning'
            : 'success',
      message: activity.message,
      time: activity.timestamp || "À l'instant",
    }));
  }, [logs, remoteActivities]);

  return { feedActivities, refresh: fetchLogs };
}
