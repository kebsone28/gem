import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../store/db';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';
import type { DashboardMetrics } from '../types';

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
    // Si on a des données distantes, on les complète avec des valeurs par défaut pour éviter les crashs
    if (remoteMetrics) {
      return {
        ...remoteMetrics,
        pipeline: remoteMetrics.pipeline || { murs: 0, reseau: 0, interieur: 0, validated: 0 },
        performance: remoteMetrics.performance || { avgPerDay: 0, daysWorked: 0, avgCablePerHouse: 0, efficiencyRate: 0 },
        logistics: remoteMetrics.logistics || { kitPrepared: 0, kitLoaded: 0, gap: 0 },
        technical: remoteMetrics.technical || { totalConsumption: 0 },
        breakdown: remoteMetrics.breakdown || { byZone: [], byTeam: [] }
      };
    }

    const total = localHouseholds.length;
    const done = localHouseholds.filter(
      (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
    ).length;

    // Calcul dynamique du pipeline local
    const mursCount = localHouseholds.filter(h => h.constructionData?.mursStatus === 'Terminé').length;
    const reseauCount = localHouseholds.filter(h => h.constructionData?.reseauStatus === 'Terminé').length;
    const interieurCount = localHouseholds.filter(h => h.constructionData?.interieurStatus === 'Terminé').length;

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
      conforme: Math.max(0, done - localHouseholds.filter(h => h.status === 'Problème').length),
      actionRequired: localHouseholds.filter(h => h.status === 'Problème').length,
      syncHealth: 'healthy',
      pipeline: { 
        murs: mursCount, 
        reseau: reseauCount, 
        interieur: interieurCount, 
        validated: done 
      },
      performance: { 
        avgPerDay: 0, 
        daysWorked: 0, 
        avgCablePerHouse: 0, 
        efficiencyRate: 0 
      },
      logistics: { kitPrepared: 0, kitLoaded: 0, gap: 0 },
      technical: { totalConsumption: 0 },
      breakdown: { byZone: [], byTeam: [] },
    };
  }, [remoteMetrics, localHouseholds]);

  return { metrics, isLoading, error, refresh: fetchMetrics, localZonesCount };
}
