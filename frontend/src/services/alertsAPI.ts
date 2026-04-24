/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Service Alertes Frontend
 * Gère les appels à l'API des alertes
 */

import apiClient from '../api/client';
import logger from '../utils/logger';

export const alertsAPI = {
  /**
   * Récupère toutes les alertes d'un projet
   */
  async getProjectAlerts(projectId: string, params: Record<string, any> = {}) {
    try {
      const response = await apiClient.get(`/alerts/${projectId}`, { params });
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error fetching alerts', err);
      throw err;
    }
  },

  /**
   * Crée une nouvelle alerte
   */
  async createAlert(payload: Record<string, unknown>) {
    try {
      const response = await apiClient.post('/alerts', payload);
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error creating alert', err);
      throw err;
    }
  },

  /**
   * Reconnaît une alerte (mark as acknowledged)
   */
  async acknowledgeAlert(alertId: string) {
    try {
      const response = await apiClient.patch(`/alerts/${alertId}/acknowledge`);
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error acknowledging alert', err);
      throw err;
    }
  },

  /**
   * Résout une alerte
   */
  async resolveAlert(alertId: string, comment?: string) {
    try {
      const response = await apiClient.patch(`/alerts/${alertId}/resolve`, { comment });
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error resolving alert', err);
      throw err;
    }
  },

  /**
   * Récupère les statistiques d'alertes
   */
  async getAlertStats(projectId: string) {
    try {
      const response = await apiClient.get(`/alerts/${projectId}/stats`);
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error fetching stats', err);
      throw err;
    }
  },

  /**
   * Récupère la configuration d'alertes de l'organisation
   */
  async getAlertConfig() {
    try {
      const response = await apiClient.get('/alerts/config/organization');
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error fetching config', err);
      throw err;
    }
  },

  /**
   * Met à jour la configuration d'alertes
   */
  async updateAlertConfig(updates: Record<string, unknown>) {
    try {
      const response = await apiClient.patch('/alerts/config/organization', updates);
      return response.data.data;
    } catch (err) {
      logger.error('[ALERTS API] Error updating config', err);
      throw err;
    }
  },
};

export default alertsAPI;
