/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import apiClient from '../api/client';

export const importBulkHouseholds = async (data: {
  households: unknown[];
}): Promise<{ success: boolean; count: number }> => {
  const response = await apiClient.post('/sync/import-bulk', data);
  return response.data;
};

export const clearEntityData = async (entity: string): Promise<{ success: boolean }> => {
  const response = await apiClient.delete(`/sync/clear/${entity}`);
  return response.data;
};
