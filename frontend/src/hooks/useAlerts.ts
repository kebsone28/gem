/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * Hook useAlerts - Gestion des alertes avec syncing en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import alertsAPI from '../services/alertsAPI';

interface Alert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';
  title: string;
  description?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

interface AlertStats {
  byStatus: Record<string, number>;
  totalCritical: number;
}

export function useAlerts(projectId: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (status?: string) => {
      try {
        setLoading(true);
        setError(null);

        const [alertsData, statsData] = await Promise.all([
          alertsAPI.getProjectAlerts(projectId, { status, limit: 100 }),
          alertsAPI.getAlertStats(projectId),
        ]);

        setAlerts(alertsData || []);
        setStats(statsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('[useAlerts] Error fetching alerts:', err);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    fetchAlerts();

    // Refresh toutes les 30 secondes
    const interval = setInterval(() => fetchAlerts(), 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const acknowledge = useCallback(
    async (alertId: string) => {
      try {
        await alertsAPI.acknowledgeAlert(alertId);
        setAlerts(
          alerts.map((a) => (a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' as const } : a))
        );
        return true;
      } catch (err) {
        console.error('[useAlerts] Error acknowledging alert:', err);
        return false;
      }
    },
    [alerts]
  );

  const resolve = useCallback(
    async (alertId: string, comment?: string) => {
      try {
        await alertsAPI.resolveAlert(alertId, comment);
        setAlerts(
          alerts.map((a) => (a.id === alertId ? { ...a, status: 'RESOLVED' as const } : a))
        );
        return true;
      } catch (err) {
        console.error('[useAlerts] Error resolving alert:', err);
        return false;
      }
    },
    [alerts]
  );

  const create = useCallback(
    async (alert: Omit<Alert, 'id' | 'createdAt'> & { projectId: string }) => {
      try {
        const newAlert = await alertsAPI.createAlert(alert);
        setAlerts([newAlert, ...alerts]);
        return newAlert;
      } catch (err) {
        console.error('[useAlerts] Error creating alert:', err);
        throw err;
      }
    },
    [alerts]
  );

  return {
    alerts,
    stats,
    loading,
    error,
    fetchAlerts,
    acknowledge,
    resolve,
    create,
  };
}
