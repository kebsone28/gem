import { useState, useEffect, useCallback } from 'react';
import type { MissionStats } from '../../../../services/missionStatsService';
import { missionStatsService } from '../../../../services/missionStatsService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../store/db';

export function useMissionStats(user: Record<string, unknown> | null, projectId: string) {
  const [stats, setStats] = useState<MissionStats | null>(null);

  const localMissions =
    useLiveQuery(
      async () => (projectId ? db.missions.where('projectId').equals(projectId).toArray() : []),
      [projectId]
    ) || [];

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const isMaster =
      (user.email as string | undefined) === 'admingem' ||
      (user.role as string | undefined) === 'ADMIN_PROQUELEC';
    const data = isMaster
      ? await missionStatsService.getGlobalStats()
      : await missionStatsService.getUserStats(user.email as string, user.id as string);
    setStats(data);
  }, [user]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadStats = async () => {
      try {
        await fetchStats();
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Failed to fetch stats:', err);
        }
      }
    };

    void loadStats();

    return () => {
      abortController.abort();
    };
  }, [fetchStats]);

  return { stats, missions: localMissions, refresh: fetchStats };
}
