import apiClient from '../api/client';

export const projectService = {
  getProjects: async () => {
    try {
      const res = await apiClient.get('/projects');
      return res.data;
    } catch (error) {
      console.error('Fetch projects error:', error);
      throw error;
    }
  },

  getProject: async (id: string) => {
    try {
      const res = await apiClient.get(`/projects/${id}`);
      return res.data;
    } catch (error) {
      console.error('Fetch project error:', error);
      throw error;
    }
  },

  updateProject: async (id: string, data: any) => {
    try {
      const res = await apiClient.patch(`/projects/${id}`, data);
      return res.data;
    } catch (error) {
      console.error('Update project error:', error);
      throw error;
    }
  },
};

export default projectService;
