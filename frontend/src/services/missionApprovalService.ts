import api from '../api/client';
import logger from '../utils/logger';
import type { ApprovalRole, MissionApprovalWorkflow } from '../constants/approvalConstants';
import * as notificationService from './notificationService';

export { type MissionApprovalWorkflow };

export interface MissionApprovalStep {
  role: ApprovalRole;
  status: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE' | 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
}

/**
 * Récupère l'historique d'approbation d'une mission
 */
export const getMissionApprovalHistory = async (
  missionId: string
): Promise<MissionApprovalWorkflow | null> => {
  try {
    const response = await api.get(`/missions/${missionId}/approval-history`);
    return response.data;
  } catch (err) {
    logger.error('Failed to fetch mission approval history:', err);
    return null;
  }
};

/**
 * Récupère toutes les missions en attente d'approbation ou archivées
 */
export const getPendingApprovals = async (isArchive = false): Promise<any[]> => {
  try {
    const response = await api.get('/missions/approvals/pending', {
      params: { status: isArchive ? 'approuvee' : undefined }
    });
    return response.data.missions || [];
  } catch (err) {
    logger.error('Failed to fetch approvals:', err);
    return [];
  }
};

/**
 * Approuve une étape du workflow de mission
 * @param missionId ID de la mission
 * @param role Rôle qui approuve (CHEF_PROJET, COMPTABLE, ADMIN, DIRECTEUR)
 * @param comments Commentaires optionnels
 */
export const approveMissionStep = async (
  missionId: string,
  role: ApprovalRole,
  comment?: string,
  signature?: string
): Promise<MissionApprovalWorkflow | null> => {
  try {
    const response = await api.post(`/missions/${missionId}/approve`, {
      role: role.toUpperCase(),
      comment,
      signature
    });
    
    // Notification locale pour l'archivage
    const wf = response.data;
    await notificationService.createNotification({
      missionId,
      projectId: wf.projectId,
      type: 'approval',
      title: `Approbation ${role}`,
      message: `Votre mission a été approuvée par ${role}. ${comment ? 'Com: ' + comment : ''}`,
      sender: role
    });

    logger.log(`✅ Approbation ${role} enregistrée pour mission ${missionId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur d'approbation ${role}:`, err);
    throw err;
  }
};

/**
 * Rejette une étape du workflow de mission
 */
export const rejectMissionStep = async (
  missionId: string,
  role: ApprovalRole,
  reason: string
): Promise<MissionApprovalWorkflow | null> => {
  try {
    const response = await api.post(`/missions/${missionId}/reject`, {
      role,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Notification locale pour l'archivage
    const wf = response.data;
    await notificationService.createNotification({
      missionId,
      projectId: wf.projectId,
      type: 'rejection',
      title: `Rejet de mission`,
      message: `Votre mission a été rejetée par ${role}. Raison: ${reason}`,
      sender: role
    });

    logger.log(`⛔ Rejet ${role} enregistré pour mission ${missionId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur rejet ${role}:`, err);
    throw err;
  }
};

/**
 * Remplacer le numéro de mission (admin seulement)
 */
export const overrideMissionOrderNumber = async (
  missionId: string,
  newOrderNumber: string
): Promise<MissionApprovalWorkflow | null> => {
  try {
    const response = await api.post(`/missions/${missionId}/override-order-number`, {
      newOrderNumber
    });
    logger.log(`✅ Numéro de mission remplacé pour ${missionId}`);
    return response.data;
  } catch (err) {
    logger.error('❌ Erreur lors de la modification du numéro de mission :', err);
    throw err;
  }
};

/**
 * Calcule le % de complétion du workflow
 */
export const calculateMissionApprovalProgress = (workflow: MissionApprovalWorkflow): number => {
  const approved = workflow.steps.filter((s) => s.status === 'approved').length;
  return (approved / workflow.steps.length) * 100;
};

/**
 * Vérifie si l'utilisateur peut approuver une étape
 */
export const canApproveMissionStep = (
  userRole: string | undefined,
  step: MissionApprovalStep,
  isAdmin: boolean
): boolean => {
  // Admin peut tout approuver
  if (isAdmin && ['DIRECTEUR', 'ADMIN'].includes(step.role)) {
    return true;
  }

  const normalizedRole = userRole?.toUpperCase();
  const normalizedStepRole = step.role?.toUpperCase();

  if (!normalizedRole || !normalizedStepRole) {
    return false;
  }

  // Validation de statut
  const status = step.status?.toString().toUpperCase();
  if (status !== 'EN_ATTENTE' && status !== 'PENDING') {
    return false;
  }

  // Seul le DG ou DG_PROQUELEC peut approuver l'étape DIRECTEUR
  if ((normalizedRole === 'DIRECTEUR' || normalizedRole === 'DG_PROQUELEC') && normalizedStepRole === 'DIRECTEUR') return true;

  return false;
};

/**
 * Supprime définitivement une mission (admin seulement)
 */
export const deleteMission = async (missionId: string): Promise<void> => {
  try {
    await api.delete(`/missions/${missionId}`);
    logger.log(`🗑️ Mission ${missionId} supprimée de l'approbation`);
  } catch (err) {
    logger.error('❌ Erreur lors de la suppression de la mission :', err);
    throw err;
  }
};
