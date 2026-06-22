 
import apiClient from '../api/client';
import type { Project } from '../utils/types';

export const projectService = {
  getProjects: async (limit?: number): Promise<Project[]> => {
    const params = limit ? { limit } : {};
    const res = await apiClient.get('/projects', { params });
    return res.data.projects || res.data;
  },

  getAllProjects: async (): Promise<Project[]> => {
    const res = await apiClient.get('/projects', { params: { limit: 100 } });
    const data = res.data.projects || res.data;
    if (Array.isArray(data)) return data;
    if (data?.pagination?.totalPages > 1) {
      const all: Project[] = [...(data.projects || [])];
      for (let page = 2; page <= data.pagination.totalPages; page++) {
        const res2 = await apiClient.get('/projects', { params: { limit: 100, page } });
        const pageData = res2.data.projects || [];
        if (Array.isArray(pageData)) all.push(...pageData);
      }
      return all;
    }
    return Array.isArray(data) ? data : [];
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

  setUserAssignments: async (userId: string, projectIds: string[]): Promise<void> => {
    await apiClient.post('/projects/assign-user', { userId, projectIds });
  },

  deleteProject: async (id: string, password?: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`, { data: { password } });
  },

  getProjectBordereau: async (id: string): Promise<{ households: unknown[]; summary: unknown }> => {
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

  deployServerUpdate: async (): Promise<{ success: boolean; message?: string }> => {
    const res = await apiClient.post('/projects/system/deploy');
    return res.data;
  },

  dbMaintenance: async (): Promise<{ success: boolean; message?: string }> => {
    const res = await apiClient.post('/projects/system/db-maintenance');
    return res.data;
  },
};

export default projectService;
