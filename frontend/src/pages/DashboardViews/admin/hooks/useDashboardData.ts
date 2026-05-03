/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../store/db';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';
import type { DashboardMetrics } from '../types';
import { getHouseholdDerivedStatus } from '../../../../utils/statusUtils';

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
        logger.warn('Remote dashboard metrics unavailable', err);
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
        performance: remoteMetrics.performance || { avgPerDay: 0, daysWorked: 0, avgcâblePerHouse: 0, efficiencyRate: 0 },
        logistics: remoteMetrics.logistics || { kitPrepared: 0, kitLoaded: 0, gap: 0 },
        technical: remoteMetrics.technical || { totalConsumption: 0 },
        breakdown: remoteMetrics.breakdown || { byZone: [], byTeam: [] }
      };
    }

    const fallbackRemoteMetrics = remoteMetrics as DashboardMetrics | null;
    const total = localHouseholds.length;

    // Utilisation de la logique de statut dérivé pour une cohérence totale
    const nonConformeCount = localHouseholds.filter(h => getHouseholdDerivedStatus(h as any) === 'Non conforme').length;
    const conformeCount = localHouseholds.filter(h => getHouseholdDerivedStatus(h as any) === 'Contrôle conforme').length;
    const problemCount = localHouseholds.filter((h) => h.status === 'Problème').length;

    const done = localHouseholds.filter(
      (h) => h.status === 'Terminé' || h.status === 'Réception: Validée' || getHouseholdDerivedStatus(h as any) === 'Contrôle conforme'
    ).length;

    // Calcul dynamique du pipeline local
    const mursCount = localHouseholds.filter(h => h.constructionData?.mursStatus === 'Terminé' || (h.constructionData as any)?.macon).length;
    const reseauCount = localHouseholds.filter(h => h.constructionData?.reseauStatus === 'Terminé' || (h.constructionData as any)?.reseau).length;
    const interieurCount = localHouseholds.filter(h => h.constructionData?.interieurStatus === 'Terminé' || (h.constructionData as any)?.interieur).length;

    // Calcul dynamique des PV (Procès-Verbaux)
    const pvncCount = nonConformeCount;
    const pvrCount = localHouseholds.filter(h => {
      const status = getHouseholdDerivedStatus(h as any);
      return status === 'Non conforme' && !!(h.constructionData as any)?.interieur;
    }).length;

    // Fusion intelligente : si le serveur dit 0 mais qu'on en a localement, on prend le local
    const finalNonConforme = fallbackRemoteMetrics && fallbackRemoteMetrics.nonConforme > 0 ? fallbackRemoteMetrics.nonConforme : nonConformeCount;
    const finalConforme = fallbackRemoteMetrics && fallbackRemoteMetrics.conforme > 0 ? fallbackRemoteMetrics.conforme : conformeCount;

    return {
      totalHouseholds: fallbackRemoteMetrics?.totalHouseholds || total,
      electrifiedHouseholds: fallbackRemoteMetrics?.electrifiedHouseholds || done,
      progressPercent: (fallbackRemoteMetrics?.totalHouseholds || total) > 0
        ? Math.round(((fallbackRemoteMetrics?.electrifiedHouseholds || done) / (fallbackRemoteMetrics?.totalHouseholds || total)) * 100)
        : 0,
      igppScore: fallbackRemoteMetrics?.igppScore || 0,
      problemHouseholds: fallbackRemoteMetrics?.problemHouseholds || problemCount,
      incidentsHSE: fallbackRemoteMetrics?.incidentsHSE || 0,
      pvRetard: fallbackRemoteMetrics?.pvRetard || 0,
      totalPV: fallbackRemoteMetrics?.totalPV || (done + nonConformeCount),
      totalArchived: fallbackRemoteMetrics?.totalArchived || 0,
      pvnc: fallbackRemoteMetrics && fallbackRemoteMetrics.pvnc > 0 ? fallbackRemoteMetrics.pvnc : pvncCount,
      pvr: fallbackRemoteMetrics && fallbackRemoteMetrics.pvr > 0 ? fallbackRemoteMetrics.pvr : pvrCount,
      pvhse: fallbackRemoteMetrics?.pvhse || 0,
      nonConforme: finalNonConforme,
      conforme: finalConforme,
      actionRequired: fallbackRemoteMetrics?.actionRequired || (problemCount + nonConformeCount),
      syncHealth: fallbackRemoteMetrics?.syncHealth || 'healthy',
      pipeline: {
        murs: fallbackRemoteMetrics?.pipeline?.murs || mursCount,
        reseau: fallbackRemoteMetrics?.pipeline?.reseau || reseauCount,
        interieur: fallbackRemoteMetrics?.pipeline?.interieur || interieurCount,
        validated: fallbackRemoteMetrics?.pipeline?.validated || done
      },
      performance: fallbackRemoteMetrics?.performance || {
        avgPerDay: 0,
        daysWorked: 0,
        avgcâblePerHouse: 0,
        efficiencyRate: 0
      },
      logistics: fallbackRemoteMetrics?.logistics || { kitPrepared: 0, kitLoaded: 0, gap: 0 },
      technical: fallbackRemoteMetrics?.technical || { totalConsumption: 0 },
      breakdown: fallbackRemoteMetrics?.breakdown || { byZone: [], byTeam: [] },
      nonComplianceBreakdown: fallbackRemoteMetrics?.nonComplianceBreakdown || {
        grounding: localHouseholds.filter(h => Number((h.constructionData as any)?.audit?.resistance_terre) > 1500).length,
        installation: localHouseholds.filter(h => !!(h.constructionData as any)?.interieur?.problemes_installation).length,
        branchement: localHouseholds.filter(h => !!(h.constructionData as any)?.reseau?.problemes_branchement).length,
        other: localHouseholds.filter(h => {
          const status = getHouseholdDerivedStatus(h as any);
          const hasKnownIssue = Number((h.constructionData as any)?.audit?.resistance_terre) > 1500 ||
                              !!(h.constructionData as any)?.interieur?.problemes_installation ||
                              !!(h.constructionData as any)?.reseau?.problemes_branchement;
          return status === 'Non conforme' && !hasKnownIssue;
        }).length
      }
    };
  }, [remoteMetrics, localHouseholds]);

  return { metrics, isLoading, error, refresh: fetchMetrics, localZonesCount, localHouseholds };
}
