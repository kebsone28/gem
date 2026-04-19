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
  data: any;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/**
 * Récupère toutes les missions d'un projet
 */
export const getMissions = async (projectId?: string): Promise<Mission[]> => {
  try {
    const response = await api.get('/missions', { params: { projectId } });
    return response.data.missions || [];
  } catch (err) {
    logger.error('Failed to fetch missions:', err);
    return [];
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
    return null;
  }
};

/**
 * Crée une nouvelle mission sur le serveur
 */
export const createMission = async (missionData: Partial<Mission>): Promise<Mission | null> => {
  try {
    console.log('🚀 [API] PAYLOAD SENT (CREATE):', missionData);
    const response = await api.post('/missions', missionData);
    return response.data;
  } catch (err: any) {
    logger.error('❌ [API] Failed to create mission:', err);
    console.error('❌ FULL BACKEND ERROR:', err.response?.data);
    return null;
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
    console.log(`🚀 [API] PAYLOAD SENT (UPDATE ${id}):`, missionData);
    const response = await api.patch(`/missions/${id}`, missionData);
    return response.data;
  } catch (err: any) {
    logger.error(`❌ [API] Failed to update mission ${id}:`, err);
    console.error('❌ FULL BACKEND ERROR:', err.response?.data);
    if (err.response?.status === 404) {
      return { error: 404 };
    }
    return null;
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
    return false;
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
    return null;
  }
};

/**
 * Vérifie publiquement une mission via son identifiant unique
 */
export const verifyMission = async (identifier: string): Promise<any> => {
  try {
    const response = await api.get(`/missions/verify/${identifier}`);
    return response.data;
  } catch (err) {
    logger.error(`Failed to verify mission ${identifier}:`, err);
    return null;
  }
};
