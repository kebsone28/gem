 
/**
 * Mission Approval System - TypeScript Types & Constants
 * Définitions centralisées pour tout le système d'approbation
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export type ApprovalRole = 'INITIATEUR' | 'ADMIN' | 'DIRECTEUR';
export type ApprovalStatus =
  | 'EN_ATTENTE'
  | 'APPROUVE'
  | 'REJETE'
  | 'pending'
  | 'approved'
  | 'rejected';
export type WorkflowStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'executed';

/**
 * Représente une seule étape du workflow d'approbation
 */
export interface MissionApprovalStep {
  /** Le rôle qui doit approuver cette étape */
  role: ApprovalRole;

  /** Nom convivial de l'étape (ex: 'Validation Technique') */
  label?: string;

  /** Statut actuel de l'approbation */
  status: ApprovalStatus;

  /** Nom de la personne qui a approuvé */
  approvedBy?: string;

  /** Date et heure de l'approbation */
  approvedAt?: string;

  /** Commentaires ou raison du rejet */
  comments?: string;
}

/**
 * Représente le workflow complet d'approbation d'une mission
 */
export interface MissionApprovalWorkflow {
  /** ID unique de la mission */
  missionId: string;

  /** Numéro de l'ordre de mission (ex: "20/2026") */
  orderNumber: string;

  /** Toutes les étapes du workflow */
  steps: MissionApprovalStep[];

  /** Statut global du workflow */
  overallStatus: WorkflowStatus;

  /** Étape actuelle (séquence) */
  currentStep?: number;

  /** Métadonnées de génération du numéro d'ordre */
  orderNumberGeneratedAt?: string;
  orderNumberGeneratedBy?: string;

  /** Date de création du workflow */
  createdAt: string;

  /** Dernière mise à jour */
  updatedAt: string;
}

/**
 * Configuration pour les permissions d'approbation par rôle
 */
export interface RolePermissions {
  canApprove: ApprovalRole[];
  canReject: ApprovalRole[];
  canOverride: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Hiérarchie des rôles et leurs permissions
 */
/**
 * Hiérarchie des rôles et leurs permissions (Simplifiée pour GEM SAAS)
 */
export const ROLE_HIERARCHY: Record<ApprovalRole, RolePermissions> = {
  INITIATEUR: {
    canApprove: [],
    canReject: [],
    canOverride: false,
  },
  ADMIN: {
    canApprove: ['DIRECTEUR'],
    canReject: ['DIRECTEUR'],
    canOverride: true,
  },
  DIRECTEUR: {
    canApprove: ['DIRECTEUR'],
    canReject: ['DIRECTEUR'],
    canOverride: false,
  },
};

/**
 * Messages par statut d'approbation
 */
export const APPROVAL_STATUS_MESSAGES: Record<ApprovalStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  EN_ATTENTE: 'En attente',
  APPROUVE: 'Approuvé',
  REJETE: 'Rejeté',
};

/**
 * Messages par statut de workflow
 */
/**
 * Messages par statut de workflow
 */
export const WORKFLOW_STATUS_MESSAGES: Record<WorkflowStatus, string> = {
  draft: 'Brouillon',
  pending: 'Soumise (En attente de validation finale)',
  approved: '✅ Validée et officialisée',
  rejected: '❌ Rejetée',
  executed: '🚀 Exécutée',
};

/**
 * Couleurs pour l'affichage des statuts
 */
export const STATUS_COLORS: Record<ApprovalStatus | WorkflowStatus, string> = {
  pending: '#ff9800', // Orange
  approved: '#4caf50', // Green
  rejected: '#f44336', // Red
  EN_ATTENTE: '#ff9800', // Orange
  APPROUVE: '#4caf50', // Green
  REJETE: '#f44336', // Red
  draft: '#9e9e9e',
  executed: '#2196f3',
};

/**
 * Ordre de validation métier simplifié
 */
export const APPROVAL_ROLE_ORDER: ApprovalRole[] = ['DIRECTEUR'];

/**
 * Labels pour chaque rôle
 */
export const ROLE_LABELS: Record<ApprovalRole, string> = {
  INITIATEUR: 'Initiateur de la mission',
  ADMIN: 'Administrateur',
  DIRECTEUR: 'Direction / Validation finale',
};

/**
 * Icônes Material-UI pour chaque rôle
 */
export const ROLE_ICONS: Record<ApprovalRole, string> = {
  INITIATEUR: 'person',
  ADMIN: 'security',
  DIRECTEUR: 'verified_user',
};

/**
 * Messages d'erreur
 */
export const ERROR_MESSAGES = {
  WORKFLOW_NOT_FOUND: 'Workflow not found',
  STEP_NOT_FOUND: 'Approval step not found',
  ALREADY_PROCESSED: 'Step already processed',
  NOT_AUTHORIZED: 'Not authorized to approve this role',
  INVALID_ROLE: 'Invalid role',
  MISSING_FIELDS: 'Missing required fields',
};

/**
 * Messages de succès
 */
export const SUCCESS_MESSAGES = {
  APPROVED: 'Approbation enregistrée avec succès',
  REJECTED: 'Rejet enregistré avec succès',
  WORKFLOW_INITIALIZED: 'Workflow initialized successfully',
};

/**
 * Paramètres de configuration
 */
export const APPROVAL_CONFIG = {
  /** Intervalle de rafraîchissement en millisecondes */
  REFRESH_INTERVAL: 5000,

  /** Timeout pour les requêtes API */
  API_TIMEOUT: 10000,

  /** Nombre maximum de tentatives de requête */
  MAX_RETRIES: 3,

  /** Permet le rejet avec escalade */
  ALLOW_ESCALATION: true,

  /** Approche de workflow: 'sequential' ou 'parallel' */
  WORKFLOW_TYPE: 'sequential' as const,

  /** Rendre les approbations obligatoires */
  REQUIRE_ALL_APPROVALS: true,

  /** Permettre les commentaires optionnels */
  OPTIONAL_COMMENTS: false,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Obtient les permissions d'un rôle
 */
export function getRolePermissions(role?: string | null): RolePermissions | null {
  if (!role || !(role in ROLE_HIERARCHY)) {
    return null;
  }
  return ROLE_HIERARCHY[role as ApprovalRole];
}

/**
 * Vérifie si un utilisateur peut approuver un rôle spécifique
 */
export function canApproveRole(userRole: string | undefined, targetRole: string): boolean {
  if (!userRole) return false;
  const permissions = getRolePermissions(userRole);
  return permissions?.canApprove.includes(targetRole as ApprovalRole) ?? false;
}

/**
 * Vérifie si un utilisateur peut rejeter un rôle spécifique
 */
export function canRejectRole(userRole: string | undefined, targetRole: string): boolean {
  if (!userRole) return false;
  const permissions = getRolePermissions(userRole);
  return permissions?.canReject.includes(targetRole as ApprovalRole) ?? false;
}

/**
 * Vérifie si un utilisateur peut surpasser une approbation
 */
export function canOverrideApproval(userRole: string | undefined): boolean {
  if (!userRole) return false;
  const permissions = getRolePermissions(userRole);
  return permissions?.canOverride ?? false;
}

/**
 * Calcule le statut global du workflow basé sur les étapes
 */
export function calculateWorkflowStatus(steps: MissionApprovalStep[]): WorkflowStatus {
  const hasRejected = steps.some((s) => s.status === 'rejected');
  if (hasRejected) return 'rejected';

  const allApproved = steps.every((s) => s.status === 'approved');
  if (allApproved) return 'approved';

  const hasApproved = steps.some((s) => s.status === 'approved');
  if (hasApproved) return 'pending';

  return 'pending';
}

/**
 * Calcule le pourcentage d'approbations complétées
 */
export function calculateApprovalProgress(steps: MissionApprovalStep[]): number {
  if (steps.length === 0) return 0;
  const approved = steps.filter((s) => s.status === 'approved').length;
  return (approved / steps.length) * 100;
}

/**
 * Obtient l'étape suivante à approuver
 */
export function getNextPendingStep(steps: MissionApprovalStep[]): MissionApprovalStep | null {
  return steps.find((s) => s.status === 'pending') ?? null;
}

/**
 * Formate la date pour l'affichage
 */
export function formatApprovalDate(dateString?: string): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Valide les données d'approbation
 */
export function validateApprovalData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const typedData = data as Record<string, unknown>;
  if (!typedData.role) errors.push('Role is required');
  if (!['ADMIN', 'DIRECTEUR'].includes(typedData.role as string)) {
    errors.push('Invalid role');
  }

  if (typedData.comments && typeof typedData.comments !== 'string') {
    errors.push('Comments must be a string');
  }

  if (!typedData.timestamp) errors.push('Timestamp is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide les données de rejet
 */
export function validateRejectionData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const typedData = data as Record<string, unknown>;
  if (!typedData.role) errors.push('Role is required');
  if (!['ADMIN', 'DIRECTEUR'].includes(typedData.role as string)) {
    errors.push('Invalid role');
  }

  if (
    !typedData.reason ||
    typeof typedData.reason !== 'string' ||
    (typedData.reason as string).trim() === ''
  ) {
    errors.push('Rejection reason is required and must not be empty');
  }

  if (!typedData.timestamp) errors.push('Timestamp is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  ROLE_HIERARCHY,
  APPROVAL_STATUS_MESSAGES,
  WORKFLOW_STATUS_MESSAGES,
  STATUS_COLORS,
  APPROVAL_ROLE_ORDER,
  ROLE_LABELS,
  ROLE_ICONS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  APPROVAL_CONFIG,
  getRolePermissions,
  canApproveRole,
  canRejectRole,
  canOverrideApproval,
  calculateWorkflowStatus,
  calculateApprovalProgress,
  getNextPendingStep,
  formatApprovalDate,
  validateApprovalData,
  validateRejectionData,
};
