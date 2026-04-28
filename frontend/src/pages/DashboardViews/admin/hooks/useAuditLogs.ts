/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';
import type { AuditLog } from '../../../../utils/types';
import type { Activity } from '../types';

function inferSeverity(activity: any): AuditLog['severity'] {
  const action = String(activity?.action || '').toLowerCase();
  const details =
    typeof activity?.details === 'string'
      ? activity.details.toLowerCase()
      : JSON.stringify(activity?.details || {}).toLowerCase();

  if (
    action.includes('delete') ||
    action.includes('suppression') ||
    action.includes('reset') ||
    details.includes('critical')
  ) {
    return 'critical';
  }

  if (
    action.includes('warning') ||
    action.includes('block') ||
    action.includes('reject') ||
    details.includes('warning')
  ) {
    return 'warning';
  }

  return 'info';
}

function mapActivityToAuditLog(activity: any, index: number): AuditLog {
  const rawDetails = activity?.details;
  const details =
    typeof rawDetails === 'string'
      ? rawDetails
      : rawDetails && Object.keys(rawDetails).length > 0
        ? JSON.stringify(rawDetails)
        : activity?.resourceId || '';

  return {
    id: activity?.id || `${activity?.timestamp || 'activity'}-${index}`,
    userId: activity?.userId || activity?.user?.id || 'system',
    userName: activity?.user?.name || activity?.userName || 'Système',
    action: activity?.action || 'ACTIVITE',
    module: activity?.resource || activity?.module || 'SYSTEME',
    details,
    timestamp: activity?.timestamp || new Date().toISOString(),
    severity: inferSeverity(activity),
  };
}

export function useAuditLogs(remoteActivities: any[] = []) {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await apiClient.get('/monitoring/activity');
      const activities = response.data?.activities || [];
      setLogs(activities.slice(0, 5).map(mapActivityToAuditLog));
    } catch (e) {
      logger.warn('[audit] server feed unavailable', e);
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const t = window.setTimeout(() => {
      (async () => {
        try {
          const response = await apiClient.get('/monitoring/activity');
          const activities = response.data?.activities || [];
          if (mounted) setLogs(activities.slice(0, 5).map(mapActivityToAuditLog));
        } catch (e) {
          logger.warn('[audit] server feed unavailable', e);
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

  return { feedActivities, refresh: fetchLogs, auditLogs: logs };
}
