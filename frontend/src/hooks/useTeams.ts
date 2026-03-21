import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import type { Team } from '../utils/types';
import logger from '../utils/logger';

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
            setTeamTree(response.data.tree);
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
            
            setTeams(prev => [...prev, newTeam]);
            // Refresh tree or insert manually
            await fetchTeamTree();
            return newTeam;
        } catch (err: any) {
            logger.error('Create team error', err);
            throw err;
        }
    };

    const updateTeam = async (id: string, data: Partial<Team>) => {
        try {
            const response = await apiClient.patch(`/teams/${id}`, data);
            const updated = response.data;
            
            setTeams(prev => prev.map(t => t.id === id ? updated : t));
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
            setTeams(prev => prev.filter(t => t.id !== id));
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
        deleteTeam
    };
}
