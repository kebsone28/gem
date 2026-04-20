/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import api from '../api/client';
import logger from '../utils/logger';

export interface ApprovalStep {
  role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR';
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
}

export interface HouseholdApprovalHistory {
  householdId: string;
  steps: ApprovalStep[];
  overallStatus: 'pending' | 'approved' | 'rejected' | 'in_progress';
  createdAt: string;
  updatedAt: string;
}

/**
 * Récupère l'historique d'approbation d'un ménage
 */
export const getApprovalHistory = async (
  householdId: string
): Promise<HouseholdApprovalHistory | null> => {
  try {
    const response = await api.get(`/households/${householdId}/approval-history`);
    return response.data;
  } catch (err: any) {
    // 404 = workflow pas encore créé pour ce ménage → comportement normal, pas d'erreur
    if (err?.response?.status === 404) {
      return null;
    }
    logger.error('Failed to fetch approval history:', err);
    return null;
  }
};

/**
 * Approuve une étape du workflow de ménage
 * @param householdId ID du ménage
 * @param role Rôle qui approuve (CHEF_PROJET, ADMIN, DIRECTEUR)
 * @param comments Commentaires optionnels
 */
export const approveHouseholdStep = async (
  householdId: string,
  role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR',
  comments?: string
): Promise<HouseholdApprovalHistory | null> => {
  try {
    const response = await api.post(`/households/${householdId}/approve`, {
      role,
      comments,
      timestamp: new Date().toISOString(),
    } as any);
    logger.log(`✅ Approbation ${role} enregistrée pour ${householdId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur d'approbation ${role}:`, err);
    throw err;
  }
};

/**
 * Rejette une étape du workflow de ménage
 */
export const rejectHouseholdStep = async (
  householdId: string,
  role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR',
  reason: string
): Promise<HouseholdApprovalHistory | null> => {
  try {
    const response = await api.post(`/households/${householdId}/reject`, {
      role,
      reason,
      timestamp: new Date().toISOString(),
    } as any);
    logger.log(`⛔ Rejet ${role} enregistré pour ${householdId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Erreur rejet ${role}:`, err);
    throw err;
  }
};

/**
 * Calcule le % de complétion du workflow
 */
export const calculateApprovalProgress = (history: HouseholdApprovalHistory): number => {
  const approved = history.steps.filter((s) => s.status === 'approved').length;
  return (approved / history.steps.length) * 100;
};

/**
 * Vérifie si l'utilisateur peut approuver une étape
 */
export const canApproveStep = (
  userRole: string | undefined,
  step: ApprovalStep,
  isAdmin: boolean
): boolean => {
  // Admin peut tout approuver
  if (isAdmin && ['CHEF_PROJET', 'ADMIN', 'DIRECTEUR'].includes(step.role)) {
    return true;
  }

  // Chef projet approuve sa propre étape
  if (userRole === 'CHEF_PROJET' && step.role === 'CHEF_PROJET' && step.status === 'pending') {
    return true;
  }

  // Directeur approuve sa propre étape
  if (userRole === 'DIRECTEUR' && step.role === 'DIRECTEUR' && step.status === 'pending') {
    return true;
  }

  return false;
};
