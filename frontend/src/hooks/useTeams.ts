/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import type { Team } from '../utils/types';
import logger from '../utils/logger';
import { db } from '../store/db';

export function useTeams(projectId?: string) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamTree, setTeamTree] = useState<Team[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [grappes, setGrappes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/teams?projectId=${projectId}`);
      setTeams(response.data.teams);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch teams');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchTeamTree = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/teams/tree?projectId=${projectId}`);
      const serverTree = response.data.tree || [];

      try {
        const allLocalTeams = await (
          db as any
        ).teams.toArray();
        const localOfflineTeams = allLocalTeams.filter(
          (t: any) => t.syncStatus === 'pending' && t.projectId === projectId
        );

        if (localOfflineTeams.length > 0) {
          // Build proper tree structure for offline teams
          const offlineParents = localOfflineTeams.filter(
            (t: Record<string, unknown>) => !t.parentTeamId
          );
          const offlineChildren = localOfflineTeams.filter(
            (t: Record<string, unknown>) => !!t.parentTeamId
          );
          offlineParents.forEach((parent: Record<string, unknown>) => {
            (parent as Record<string, any>).children = offlineChildren.filter(
              (c: Record<string, unknown>) => c.parentTeamId === parent.id
            );
          });
          setTeamTree([...serverTree, ...offlineParents]);
        } else {
          setTeamTree(serverTree);
        }
      } catch (dbErr) {
        setTeamTree(serverTree);
      }
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch team tree');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchRegions = useCallback(async () => {
    try {
      const response = await apiClient.get('/teams/regions');
      setRegions(response.data.regions || []);
    } catch (err) {
      logger.error('Fetch regions error', err);
    }
  }, []);

  const fetchGrappes = useCallback(async (regionId?: string) => {
    try {
      const url = regionId ? `/teams/grappes?regionId=${regionId}` : '/teams/grappes';
      const response = await apiClient.get(url);
      setGrappes(response.data.grappes || []);
    } catch (err) {
      logger.error('Fetch grappes error', err);
    }
  }, []);

  const refreshLocalState = useCallback(async () => {
    await Promise.all([fetchTeams(), fetchTeamTree()]);
  }, [fetchTeams, fetchTeamTree]);

  const createTeam = async (data: Partial<Team>) => {
    try {
      const response = await apiClient.post('/teams', { ...data, projectId });
      if (response.data?._offline) {
        const newLocalId = crypto.randomUUID();
        const newLocalTeam = {
          ...data,
          projectId,
          id: newLocalId,
          organizationId: 'org-offline',
          level: data.parentTeamId ? 1 : 0,
          status: 'active',
          syncStatus: 'pending',
          path: data.parentTeamId ? `${data.parentTeamId}/${newLocalId}` : newLocalId,
        };
        await (db as unknown as { teams: { add: (item: unknown) => Promise<void> } }).teams.add(
          newLocalTeam
        );
        setTeams((prev) => [...prev, newLocalTeam as any]);
        await fetchTeamTree();
        return newLocalTeam;
      }

      const newTeam = response.data;

      await refreshLocalState();
      return newTeam;
    } catch (err: any) {
      logger.error('Create team error', err);
      throw err;
    }
  };

  const updateTeam = async (id: string, data: Partial<Team>) => {
    try {
      const response = await apiClient.patch(`/teams/${id}`, data);
      if (response.data?._offline) {
        logger.warn('Update offline: patching Dexie locally', id);
        await (
          db as unknown as { teams: { update: (id: unknown, item: unknown) => Promise<void> } }
        ).teams.update(id, { ...data, syncStatus: 'pending' });
        setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } as any : t)));
        await fetchTeamTree();
        return { id, ...data };
      }

      const updated = response.data;
      await refreshLocalState();
      return updated;
    } catch (err: any) {
      if (err.response?.status === 404) {
        logger.warn('Update offline: patching Dexie locally', id);
        try {
          await (
            db as unknown as { teams: { update: (id: unknown, item: unknown) => Promise<void> } }
          ).teams.update(id, { ...data, syncStatus: 'pending' });
          setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } as any : t)));
          await fetchTeamTree();
          return { id, ...data };
        } catch (dbErr) {
          logger.error('Update team local error', dbErr);
        }
      }
      logger.error('Update team error', err);
      throw err;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const response = await apiClient.delete(`/teams/${id}`);
      if (response.data?._offline) {
        await (
          db as unknown as { teams: { delete: (id: unknown) => Promise<void> } }
        ).teams.delete(id);
        setTeams((prev) => prev.filter((t) => t.id !== id));
        await fetchTeamTree();
        return;
      }

      await refreshLocalState();
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        logger.warn('Delete offline: removing from Dexie only', id);
        try {
          await (
            db as unknown as { teams: { delete: (id: unknown) => Promise<void> } }
          ).teams.delete(id);
          setTeams((prev) => prev.filter((t) => t.id !== id));
          await fetchTeamTree();
          return;
        } catch (dbErr) {
          logger.error('Delete team local error', dbErr);
        }
      }
      logger.error('Delete team error', err);
      throw err;
    }
  };

  return {
    teams,
    teamTree,
    regions,
    grappes,
    isLoading,
    error,
    fetchTeams,
    fetchTeamTree,
    fetchRegions,
    fetchGrappes,
    createTeam,
    updateTeam,
    deleteTeam,
  };
}
