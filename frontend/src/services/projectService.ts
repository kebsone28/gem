import apiClient from '../api/client';
import type { Project } from '../utils/types';

export const projectService = {
  getProjects: async (): Promise<Project[]> => {
    const res = await apiClient.get('/projects');
    return res.data;
  },

  getProject: async (id: string): Promise<Project> => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data;
  },

  createProject: async (data: Partial<Project>): Promise<Project> => {
    const res = await apiClient.post('/projects', data);
    return res.data;
  },

  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    const res = await apiClient.patch(`/projects/${id}`, data);
    return res.data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  getProjectBordereau: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/projects/${id}/bordereau`);
    return res.data;
  },

  recalculateGrappes: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post(`/projects/${id}/recalculate-grappes`);
    return res.data;
  },

  resetProjectData: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post(`/projects/${id}/reset-data`);
    return res.data;
  },

  deployServerUpdate: async (): Promise<any> => {
    const res = await apiClient.post('/projects/system/deploy');
    return res.data;
  },

  dbMaintenance: async (): Promise<any> => {
    const res = await apiClient.post('/projects/system/db-maintenance');
    return res.data;
  }
};

export default projectService;
