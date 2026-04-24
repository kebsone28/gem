import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { db } from '../store/db';
import logger from '../utils/logger';
import type { Team } from '../utils/types';
import type { PlanningHousehold } from '../services/planningDomain';

interface HouseholdsResponse {
  households?: PlanningHousehold[];
}

interface TeamsResponse {
  teams?: Team[];
}

type PlanningDataSource = 'server' | 'local' | 'none';

interface UsePlanningDataResult {
  households: PlanningHousehold[];
  teams: Team[];
  isLoading: boolean;
  isRefreshing: boolean;
  dataSource: PlanningDataSource;
  refresh: () => Promise<void>;
}

export function usePlanningData(projectId: string | null): UsePlanningDataResult {
  const [households, setHouseholds] = useState<PlanningHousehold[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<PlanningDataSource>('none');

  const loadProjectData = useCallback(
    async (refreshMode = false) => {
      if (!projectId) {
        setHouseholds([]);
        setTeams([]);
        setDataSource('none');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refreshMode) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [householdsRes, teamsRes] = await Promise.all([
          apiClient.get('/households', { params: { projectId, limit: 10000 } }),
          apiClient.get('/teams', { params: { projectId } }),
        ]);

        setHouseholds(((householdsRes.data as HouseholdsResponse).households || []) as PlanningHousehold[]);
        setTeams(((teamsRes.data as TeamsResponse).teams || []).filter((team: Team) => team.status === 'active'));
        setDataSource('server');
      } catch (error) {
        logger.warn('[PlanningData] Server fetch unavailable, falling back to local data', error);

        const [localHouseholds, localTeams] = await Promise.all([
          db.households
            .where('projectId')
            .equals(projectId)
            .and((household) => household.status !== 'DELETED')
            .toArray(),
          db.teams
            .where('projectId')
            .equals(projectId)
            .and((team) => team.status === 'active')
            .toArray(),
        ]);

        setHouseholds(localHouseholds as PlanningHousehold[]);
        setTeams(localTeams);
        setDataSource(localHouseholds.length > 0 || localTeams.length > 0 ? 'local' : 'none');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadProjectData(false);
  }, [loadProjectData]);

  const refresh = useCallback(async () => {
    await loadProjectData(true);
  }, [loadProjectData]);

  return {
    households,
    teams,
    isLoading,
    isRefreshing,
    dataSource,
    refresh,
  };
}
