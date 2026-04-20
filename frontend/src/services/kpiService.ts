/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import apiClient from '../api/client';

export interface KPISummary {
  totalHouseholds: number;
  validatedHouseholds: number;
  totalMissions: number;
  completedMissions: number;
  budgetUsed: number;
}

export const getKPISummary = async (): Promise<KPISummary> => {
  const response = await apiClient.get('/kpi/summary');
  return response.data;
};

export interface ProjectKPI {
  projectId: string;
  totalHouseholds: number;
  validatedHouseholds: number;
  totalMissions: number;
  completedMissions: number;
  budgetUsed: number;
}

export const getProjectKPI = async (projectId: string): Promise<ProjectKPI> => {
  const response = await apiClient.get(`/kpi/${projectId}`);
  return response.data;
};

export const kpiService = {
  getSummary: getKPISummary,
  getProjectKPI,
};
