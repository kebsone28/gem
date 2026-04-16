import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../store/db';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';
import { DashboardMetrics } from '../types';

export function useDashboardData(projectId: string, canViewReports: boolean) {
  const [remoteMetrics, setRemoteMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local Data Fetching via Dexie
  const localHouseholds = useLiveQuery(
    async () => (projectId ? db.households.where('projectId').equals(projectId).toArray() : []),
    [projectId]
  ) || [];

  const localZonesCount = useLiveQuery(async () => db.zones.count(), []) || 0;

  const fetchMetrics = useCallback(async () => {
    if (!projectId || !canViewReports) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.get(`kpi/${projectId}`);
      if (response.status === 200 && response.data?.metrics) {
        setRemoteMetrics(response.data.metrics);
        setError(null);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        logger.error('Failed to fetch remote metrics', err);
        setError('Erreur lors de la récupération des données cloud');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, canViewReports]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const metrics = useMemo((): DashboardMetrics => {
    if (remoteMetrics) return remoteMetrics;

    const total = localHouseholds.length;
    const done = localHouseholds.filter(
      (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
    ).length;

    return {
      totalHouseholds: total,
      electrifiedHouseholds: done,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
      igppScore: 0,
      problemHouseholds: localHouseholds.filter((h) => h.status === 'Problème').length,
      incidentsHSE: 0,
      pvRetard: 0,
      totalPV: 0,
      totalArchived: 0,
      pvnc: 0,
      pvr: 0,
      pvhse: 0,
      nonConforme: 0,
      conforme: 0,
      actionRequired: 0,
      syncHealth: 'healthy',
      pipeline: { murs: 0, reseau: 0, interieur: 0, validated: done },
      performance: { avgPerDay: 0, daysWorked: 0, avgCablePerHouse: 0, efficiencyRate: 0 },
      logistics: { kitPrepared: 0, kitLoaded: 0, gap: 0 },
      technical: { totalConsumption: 0 },
      breakdown: { byZone: [], byTeam: [] },
    };
  }, [remoteMetrics, localHouseholds]);

  return { metrics, isLoading, error, refresh: fetchMetrics, localZonesCount };
}
