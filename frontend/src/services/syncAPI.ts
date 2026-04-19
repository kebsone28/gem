import apiClient from '../api/client';

export const importBulkHouseholds = async (data: any): Promise<{ success: boolean; count: number }> => {
  const response = await apiClient.post('/sync/import-bulk', data);
  return response.data;
};

export const clearEntityData = async (entity: string): Promise<{ success: boolean }> => {
  const response = await apiClient.delete(`/sync/clear/${entity}`);
  return response.data;
};
