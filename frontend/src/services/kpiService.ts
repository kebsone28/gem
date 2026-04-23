 
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
