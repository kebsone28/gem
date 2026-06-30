/* eslint-disable @typescript-eslint/no-explicit-any */
import api from '../api/client';
import logger from '../utils/logger';

export interface Mission {
  id: string;
  projectId?: string | null;
  title?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  status: string;
  orderNumber?: string;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/**
 * Récupère toutes les missions d'un projet
 */
export const getMissions = async (params?: {
  projectId?: string;
  search?: string;
  status?: string;
  limit?: number;
}): Promise<Mission[]> => {
  try {
    const response = await api.get('/missions', { params });
    return response.data.missions || [];
  } catch (err) {
    logger.error('Failed to fetch missions:', err);
    throw err; // Let caller handle error
  }
};

/**
 * Récupère une mission spécifique par son ID
 */
export const getMission = async (id: string): Promise<Mission | null> => {
  try {
    const response = await api.get(`/missions/${id}`);
    return response.data;
  } catch (err) {
    logger.error(`Failed to fetch mission ${id}:`, err);
    throw err; // Let caller handle error
  }
};

/**
 * Crée une nouvelle mission sur le serveur
 */
export const createMission = async (missionData: Partial<Mission>): Promise<Mission | null> => {
  try {
    logger.debug('🚀 [API] PAYLOAD SENT (CREATE):', missionData);
    const response = await api.post('/missions', missionData);
    return response.data;
  } catch (err: any) {
    logger.error('❌ [API] Failed to create mission:', err);
    logger.error('❌ FULL BACKEND ERROR:', err.response?.data);
    logger.error('❌ STATUS:', err.response?.status);
    if (err.response?.status === 403 || err.response?.status === 401) {
      throw new Error('Permission refusee: votre role (N/A) ne permet pas de creer des missions.');
    }
    throw err; // Let caller handle error
  }
};

/**
 * Met à jour une mission sur le serveur
 */
export const updateMission = async (
  id: string,
  missionData: Partial<Mission>
): Promise<Mission | { error: number } | null> => {
  try {
    logger.debug(`🚀 [API] PAYLOAD SENT (UPDATE ${id}):`, missionData);
    const response = await api.patch(`/missions/${id}`, missionData);
    return response.data;
  } catch (err: any) {
    logger.error(`❌ [API] Failed to update mission ${id}:`, err);
    logger.error('❌ FULL BACKEND ERROR:', err.response?.data);
    if (err.response?.status === 404) {
      return { error: 404 };
    }
    throw err; // Let caller handle error
  }
};

/**
 * Supprime une mission sur le serveur
 */
export const deleteMission = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/missions/${id}`);
    return true;
  } catch (err) {
    logger.error(`Failed to delete mission ${id}:`, err);
    throw err; // Let caller handle error
  }
};

/**
 * Duplique une mission existante
 */
export const duplicateMission = async (id: string): Promise<Mission | null> => {
  try {
    const response = await api.post(`/missions/${id}/duplicate`);
    return response.data;
  } catch (err) {
    logger.error(`Failed to duplicate mission ${id}:`, err);
    throw err; // Let caller handle error
  }
};

/**
 * Purge toutes les missions du serveur (Admin seulement)
 */
export const purgeAllMissions = async (): Promise<{ success: boolean; count: number }> => {
  try {
    const response = await api.delete('/missions/purge/all');
    return {
      success: true,
      count: response.data.count || 0,
    };
  } catch (err: any) {
    logger.error('Failed to purge missions:', err);
    throw new Error(err.response?.data?.error || 'Erreur lors de la purge des missions');
  }
};

/**
 * Vérifie publiquement une mission via son identifiant unique
 */
export const verifyMission = async (identifier: string): Promise<Mission | null> => {
  try {
    const response = await api.get(`/missions/verify/${identifier}`);
    return response.data;
  } catch (err) {
    logger.error(`Failed to verify mission ${identifier}:`, err);
    throw err; // Let caller handle error
  }
};

/**
 * Assigne une mission à un projet (liaison indépendante)
 */
export const assignMissionToProject = async (
  missionId: string,
  projectId: string
): Promise<Mission | null> => {
  try {
    logger.debug('🚀 [API] ASSIGN MISSION TO PROJECT:', { missionId, projectId });
    const response = await api.patch(`/missions/${missionId}/assign-project`, { projectId });
    logger.debug('✅ Mission assigned successfully:', response.data);
    return response.data.mission || response.data;
  } catch (err: any) {
    logger.error('❌ Failed to assign mission to project:', err);
    logger.error('❌ FULL ERROR:', err.response?.data);
    throw err; // Let caller handle error
  }
};
