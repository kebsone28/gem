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
        const allLocalTeams = await (db as any).teams.toArray();
        const localOfflineTeams = allLocalTeams.filter((t: any) => t.syncStatus === 'pending' && t.projectId === projectId);
        
        if (localOfflineTeams.length > 0) {
           setTeamTree([...serverTree, ...localOfflineTeams]);
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

  const createTeam = async (data: Partial<Team>) => {
    try {
      // Optimistic UI could be implemented here
      const response = await apiClient.post('/teams', { ...data, projectId });
      const newTeam = response.data;

      setTeams((prev) => [...prev, newTeam]);
      // Refresh tree or insert manually
      await fetchTeamTree();
      return newTeam;
    } catch (err: any) {
      logger.warn('API indisponible ou erreur (400), création locale de secours', err);
      try {
        const newLocalId = crypto.randomUUID();
        const newLocalTeam = {
          ...data,
          projectId,
          id: newLocalId,
          organizationId: 'org-offline',
          level: data.parentTeamId ? 1 : 0,
          status: 'active',
          syncStatus: 'pending',
          path: data.parentTeamId ? `${data.parentTeamId}/${newLocalId}` : newLocalId
        };
        await (db as any).teams.add(newLocalTeam);
        setTeams((prev) => [...prev, newLocalTeam as any]);
        await fetchTeamTree();
        return newLocalTeam;
      } catch (dbErr) {
        logger.error('Erreur lors de la création locale (fallback):', dbErr);
        throw err;
      }
    }
  };

  const updateTeam = async (id: string, data: Partial<Team>) => {
    try {
      const response = await apiClient.patch(`/teams/${id}`, data);
      const updated = response.data;

      setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)));
      await fetchTeamTree();
      return updated;
    } catch (err: any) {
      logger.error('Update team error', err);
      throw err;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await apiClient.delete(`/teams/${id}`);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      await fetchTeamTree();
    } catch (err: any) {
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
