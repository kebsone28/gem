import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../api/client';
import logger from '../../../../utils/logger';
import type { AuditLog, Household, Team } from '../../../../utils/types';
import type { RegionalSummary } from '../../../../services/ai/MissionSageService';

const DONE_HOUSEHOLD_STATUSES = new Set([
  'Terminé',
  'Réception: Validée',
  'Conforme',
  'Contrôle conforme',
]);

const HOUSEHOLD_PAGE_SIZE = 5000;

const normalizeRegionName = (value?: string | null) => (value || '').trim().toLowerCase();

const getHouseholdRegion = (household: Household) =>
  household.region ||
  household.koboSync?.region ||
  (household.koboData?.region as string | undefined) ||
  '';

const getTeamRegionName = (team: Team) => team.region?.name || team.regionId || '';

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

async function fetchAllHouseholds(projectId: string): Promise<Household[]> {
  const households: Household[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get('/households', {
      params: { projectId, limit: HOUSEHOLD_PAGE_SIZE, page },
    });
    const batch = response.data?.households || [];
    households.push(...batch);

    if (batch.length < HOUSEHOLD_PAGE_SIZE || response.data?.hasMore === false) {
      break;
    }

    page += 1;
  }

  return households;
}

function buildRegionalSummaries(households: Household[], teams: Team[]): RegionalSummary[] {
  const regionNames = new Map<string, string>();

  households.forEach((household) => {
    const region = getHouseholdRegion(household);
    const normalizedRegion = normalizeRegionName(region);
    if (normalizedRegion) {
      regionNames.set(normalizedRegion, region.trim());
    }
  });

  teams.forEach((team) => {
    const region = getTeamRegionName(team);
    const normalizedRegion = normalizeRegionName(region);
    if (normalizedRegion && !regionNames.has(normalizedRegion)) {
      regionNames.set(normalizedRegion, region.trim());
    }
  });

  return Array.from(regionNames.entries()).map(([normalizedRegion, displayRegion]) => {
    const householdsInRegion = households.filter(
      (household) => normalizeRegionName(getHouseholdRegion(household)) === normalizedRegion
    );
    const teamsAssigned = teams.reduce<Record<string, number>>((acc, team) => {
      if (normalizeRegionName(getTeamRegionName(team)) !== normalizedRegion) return acc;
      const teamKey = team.tradeKey || team.role || 'unknown';
      acc[teamKey] = (acc[teamKey] || 0) + 1;
      return acc;
    }, {});

    return {
      region: displayRegion,
      totalHouseholds: householdsInRegion.length,
      delayedHouseholds: householdsInRegion.filter(
        (household) => !DONE_HOUSEHOLD_STATUSES.has(household.status)
      ).length,
      teamsAssigned,
    };
  });
}

export function useServerAIContext(projectId: string, enabled: boolean) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !projectId) {
      setHouseholds([]);
      setTeams([]);
      setAuditLogs([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [serverHouseholds, teamsRes, activityRes] = await Promise.all([
        fetchAllHouseholds(projectId),
        apiClient.get('/teams', { params: { projectId } }),
        apiClient.get('/monitoring/activity'),
      ]);

      setHouseholds(serverHouseholds);
      setTeams(((teamsRes.data?.teams || []) as Team[]).filter((team) => !team.deletedAt));
      setAuditLogs(((activityRes.data?.activities || []) as any[]).slice(0, 25).map(mapActivityToAuditLog));
    } catch (err: any) {
      logger.warn('[ServerAIContext] Unable to fetch server truth AI context', err);
      setHouseholds([]);
      setTeams([]);
      setAuditLogs([]);
      setError(err?.message || 'Impossible de charger le contexte IA depuis le serveur.');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const regionalSummaries = useMemo(
    () => buildRegionalSummaries(households, teams),
    [households, teams]
  );

  return {
    households,
    teams,
    auditLogs,
    regionalSummaries,
    isLoading,
    error,
    refresh,
  };
}
