/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import apiClient from '../api/client';

export const organizationService = {
  /**
   * Récupère la configuration globale de l'organisation
   */
  getConfig: async () => {
    try {
      const res = await apiClient.get('/organization/config');
      return res.data;
    } catch (error) {
      console.error('Fetch org config error:', error);
      throw error;
    }
  },

  /**
   * Met à jour la configuration
   */
  updateConfig: async (config: Record<string, unknown>) => {
    try {
      const res = await apiClient.patch('/organization/config', { config });
      return res.data;
    } catch (error) {
      console.error('Update org config error:', error);
      throw error;
    }
  },
};
