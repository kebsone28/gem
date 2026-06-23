import apiClient from '@/api/client';

export interface ProjectTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  client: string;
  defaultModules: string[];
  defaultUsers: string[];
  defaultSettings: Record<string, any>;
  icon: string;
  category: string;
}

export const templateService = {
  async list(): Promise<ProjectTemplate[]> {
    const { data } = await apiClient.get('/project-templates');
    return data;
  },

  async getById(id: string): Promise<ProjectTemplate> {
    const { data } = await apiClient.get(`/project-templates/${id}`);
    return data;
  },

  async create(template: {
    key: string;
    name: string;
    description?: string;
    config?: Record<string, any>;
    modules?: string[];
  }): Promise<ProjectTemplate> {
    const { data } = await apiClient.post('/project-templates', template);
    return data;
  },

  async update(id: string, updates: Partial<ProjectTemplate>): Promise<ProjectTemplate> {
    const { data } = await apiClient.patch(`/project-templates/${id}`, updates);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/project-templates/${id}`);
  },
};
