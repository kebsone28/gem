/* eslint-disable @typescript-eslint/no-explicit-any */
import apiClient from '../api/client';
import type { Team } from '../utils/types';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface TeamWithMembers extends Team {
  members?: TeamMember[];
}

export const teamService = {
  async getTeams(): Promise<Team[]> {
    const response = await apiClient.get('/teams');
    return response.data;
  },

  async getTeamsTree(): Promise<{ id: string; name: string; children?: unknown[] }[]> {
    const response = await apiClient.get('/teams/tree');
    return response.data;
  },

  async getRegions(): Promise<string[]> {
    const response = await apiClient.get('/teams/regions');
    return response.data;
  },

  async getGrappes(): Promise<{ id: string; name: string; region?: string }[]> {
    const response = await apiClient.get('/teams/grappes');
    return response.data;
  },

  async getTeamPositions(): Promise<any[]> {
    const response = await apiClient.get('/teams/positions');
    return response.data;
  },

  async syncGrappes(): Promise<{ success: boolean; count: number }> {
    const response = await apiClient.post('/teams/grappes/sync');
    return response.data;
  },

  async createTeam(team: Partial<Team>): Promise<Team> {
    const response = await apiClient.post('/teams', team);
    return response.data;
  },

  async updateTeam(id: string, team: Partial<Team>): Promise<Team> {
    const response = await apiClient.patch(`/teams/${id}`, team);
    return response.data;
  },

  async deleteTeam(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async assignTeamToZone(teamId: string, zoneId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/teams/${teamId}/assign`, { zoneId });
    return response.data;
  },
};
