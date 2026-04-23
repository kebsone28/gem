/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { auditService } from '../../../../services/auditService';
import type { AuditLog } from '../../../../utils/types';
import type { Activity } from '../types';

export function useAuditLogs(remoteActivities: any[] = []) {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Fetch logs once on mount. Defer the setState to avoid synchronous setState-in-effect warnings
  useEffect(() => {
    let mounted = true;
    const t = window.setTimeout(() => {
      (async () => {
        try {
          const data = await auditService.getLastLogs(5);
          if (mounted) setLogs(data);
        } catch (e) {
          // non bloquant

          console.error('[audit] fetchLogs error', e);
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
        log.severity === 'critical' ? 'danger' : log.severity === 'warning' ? 'warning' : 'success',
      message: `${log.userName}: ${log.action} - ${log.details}`,
      time: new Date(log.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    if (formattedLogs.length > 0) return formattedLogs;

    // Fallback to monitoring activities if no audit logs
    return remoteActivities.slice(0, 5).map((a, idx) => ({
      id: a.id || `remote-${idx}`,
      type: a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'success',
      message: a.message,
      time: a.timestamp || "À l'instant",
    }));
  }, [logs, remoteActivities]);

  return { feedActivities, refresh: fetchLogs };
}
