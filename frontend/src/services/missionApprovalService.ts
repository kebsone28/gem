/* eslint-disable @typescript-eslint/no-explicit-any */
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
export const getPendingApprovals = async (
  isArchive = false
): Promise<{ missions: unknown[]; stats: { totalBudgetCertified: number } }> => {
  try {
    const response = await api.get('/missions/approvals/pending', {
      params: { status: isArchive ? 'approuvee' : undefined },
    });
    return response.data; // Renvoie { missions: [], stats: { totalBudgetCertified } }
  } catch (err) {
    logger.error('Failed to fetch approvals:', err);
    return { missions: [], stats: { totalBudgetCertified: 0 } };
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getFilenameFromDisposition = (disposition?: string, fallback = 'Ordre_Mission.pdf') => {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

/**
 * Télécharge le PDF certifié généré côté serveur.
 * C'est la source unique pour le compte connecté et le lien public.
 */
export const downloadCertifiedMissionDocument = async (
  missionId: string,
  fallbackFileName = 'Ordre_Mission_certifie.pdf'
): Promise<void> => {
  const response = await api.get(`/missions/${missionId}/certified-document`, {
    responseType: 'blob',
  });
  const contentType = response.headers?.['content-type'] || '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('Le serveur n’a pas renvoyé un document PDF.');
  }
  const filename = getFilenameFromDisposition(
    response.headers?.['content-disposition'],
    fallbackFileName
  );
  downloadBlob(response.data, filename);
};

/**
 * Approuve une étape du workflow de mission
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
      signature,
    });

    const wf = response.data;
    if (wf.integrityHash) {
      logger.info(
        `🔐 [INTEGRITY] Success. Mission certified with hash: ${wf.integrityHash.substring(0, 16)}...`
      );
    }

    // Notification locale pour l'archivage
    await notificationService.createNotification({
      missionId,
      projectId: wf.projectId,
      type: 'approval',
      title: `Approbation ${role}`,
      message: `Votre mission a été approuvée par ${role}. ${comment ? 'Com: ' + comment : ''}`,
      sender: role,
    });

    logger.log(`✅ Approbation ${role} enregistrée pour mission ${missionId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur d'approbation ${role}:`, err);
    throw err;
  }
};

/**
 * Rejette une mission (alias pour rejectMissionStep pour compatibilité cockpit)
 */
export const rejectMission = async (
  missionId: string,
  role: ApprovalRole,
  reason: string,
  category?: string
): Promise<MissionApprovalWorkflow | null> => {
  return rejectMissionStep(missionId, role, reason, category);
};

/**
 * Rejette une étape du workflow de mission
 */
export const rejectMissionStep = async (
  missionId: string,
  role: ApprovalRole,
  reason: string,
  category = 'AUTRE'
): Promise<MissionApprovalWorkflow | null> => {
  try {
    const response = await api.post(`/missions/${missionId}/reject`, {
      role,
      reason,
      category,
      timestamp: new Date().toISOString(),
    });

    const wf = response.data;
    await notificationService.createNotification({
      missionId,
      projectId: wf.projectId,
      type: 'rejection',
      title: `Rejet de mission`,
      message: `Votre mission a été rejetée par ${role}. Raison: ${reason}`,
      sender: role,
    });

    logger.log(`⛔ Rejet ${role} enregistré pour mission ${missionId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur rejet ${role}:`, err);
    throw err;
  }
};

/**
 * Analyse IA d'une mission (Cockpit DG)
 */
export const analyzeMissionIA = async (missionId: string): Promise<any> => {
  try {
    const response = await api.post(`/missions/${missionId}/analyze-ia`);
    return response.data;
  } catch (err) {
    logger.error('❌ Erreur analyse IA mission:', err);
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
      newOrderNumber,
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
  if (!workflow.steps.length) return 0;
  const approved = workflow.steps.filter((s) => {
    const status = s.status?.toString().toUpperCase();
    return status === 'APPROUVE' || status === 'APPROVED';
  }).length;
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
  const normalizedRole = userRole?.toUpperCase();
  const normalizedStepRole = step.role?.toUpperCase();

  if (!normalizedStepRole) return false;

  const status = step.status?.toString().toUpperCase();
  if (status !== 'EN_ATTENTE' && status !== 'PENDING') return false;

  if (isAdmin && ['DIRECTEUR', 'ADMIN'].includes(normalizedStepRole)) return true;

  if (!normalizedRole) return false;

  if (
    (normalizedRole === 'DIRECTEUR' || normalizedRole === 'DG_PROQUELEC') &&
    normalizedStepRole === 'DIRECTEUR'
  )
    return true;

  return normalizedRole === normalizedStepRole;
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

/**
 * Envoie un document (PDF/Word) généré par email
 */
export const sendDocumentByEmail = async (
  missionId: string,
  documentBlob: Blob,
  recipientEmail: string,
  fileName: string
): Promise<void> => {
  try {
    const formData = new FormData();
    formData.append('document', documentBlob, fileName);
    formData.append('recipientEmail', recipientEmail);

    await api.post(`/missions/${missionId}/send-document-email`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    logger.log(`📧 Document envoyé par email à ${recipientEmail}`);
  } catch (err) {
    logger.error("❌ Erreur lors de l'envoi du document par email:", err);
    throw err;
  }
};
