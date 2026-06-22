/**
 * BUSINESS RULES — Central State Machines & Business Logic
 * Toutes les transitions de statut et règles métier sont définies ici.
 */

// ═══════════════════════════════════════════════════════════════
// 1. HOUSEHOLD STATUS STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export const HOUSEHOLD_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
};

export const HOUSEHOLD_STATUS_LABELS = {
  [HOUSEHOLD_STATUS.DRAFT]: 'Brouillon',
  [HOUSEHOLD_STATUS.PENDING_APPROVAL]: 'En attente de validation',
  [HOUSEHOLD_STATUS.VALIDATED]: 'Validé',
  [HOUSEHOLD_STATUS.REJECTED]: 'Rejeté',
  [HOUSEHOLD_STATUS.ARCHIVED]: 'Archivé',
};

const HOUSEHOLD_TRANSITIONS = {
  [HOUSEHOLD_STATUS.DRAFT]: [HOUSEHOLD_STATUS.PENDING_APPROVAL, HOUSEHOLD_STATUS.ARCHIVED],
  [HOUSEHOLD_STATUS.PENDING_APPROVAL]: [HOUSEHOLD_STATUS.VALIDATED, HOUSEHOLD_STATUS.REJECTED, HOUSEHOLD_STATUS.DRAFT],
  [HOUSEHOLD_STATUS.VALIDATED]: [HOUSEHOLD_STATUS.ARCHIVED],
  [HOUSEHOLD_STATUS.REJECTED]: [HOUSEHOLD_STATUS.DRAFT],
  [HOUSEHOLD_STATUS.ARCHIVED]: [],
};

export const isValidHouseholdTransition = (from, to) => {
  const allowed = HOUSEHOLD_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
};

export const getValidHouseholdStatuses = () => Object.values(HOUSEHOLD_STATUS);

// ═══════════════════════════════════════════════════════════════
// 2. MISSION STATUS STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export const MISSION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const MISSION_STATUS_LABELS = {
  [MISSION_STATUS.DRAFT]: 'Brouillon',
  [MISSION_STATUS.SUBMITTED]: 'Soumise',
  [MISSION_STATUS.IN_REVIEW]: 'En cours de validation',
  [MISSION_STATUS.APPROVED]: 'Approuvée',
  [MISSION_STATUS.REJECTED]: 'Rejetée',
  [MISSION_STATUS.CANCELLED]: 'Annulée',
};

// Legacy French → canonical mapping (existing DB values)
const MISSION_STATUS_LEGACY_MAP = {
  'draft': MISSION_STATUS.DRAFT,
  'brouillon': MISSION_STATUS.DRAFT,
  'soumise': MISSION_STATUS.SUBMITTED,
  'submitted': MISSION_STATUS.SUBMITTED,
  'en_attente_validation': MISSION_STATUS.SUBMITTED,
  'in_review': MISSION_STATUS.IN_REVIEW,           // [FIX C-1] IN_REVIEW maintenant atteignable
  'approuvee': MISSION_STATUS.APPROVED,
  'approuvée': MISSION_STATUS.APPROVED,
  'approved': MISSION_STATUS.APPROVED,
  'rejetee': MISSION_STATUS.REJECTED,
  'rejetée': MISSION_STATUS.REJECTED,
  'rejected': MISSION_STATUS.REJECTED,
  'annulee': MISSION_STATUS.CANCELLED,
  'annulée': MISSION_STATUS.CANCELLED,
  'cancelled': MISSION_STATUS.CANCELLED,
};

export const resolveMissionStatus = (status) => MISSION_STATUS_LEGACY_MAP[status] || status;

const MISSION_TRANSITIONS = {
  [MISSION_STATUS.DRAFT]: [MISSION_STATUS.SUBMITTED, MISSION_STATUS.CANCELLED],
  // [FIX C-1] SUBMITTED peut passer en IN_REVIEW avant l'approbation finale
  [MISSION_STATUS.SUBMITTED]: [MISSION_STATUS.IN_REVIEW, MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED, MISSION_STATUS.CANCELLED],
  [MISSION_STATUS.IN_REVIEW]: [MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED, MISSION_STATUS.CANCELLED],
  [MISSION_STATUS.APPROVED]: [MISSION_STATUS.CANCELLED],
  [MISSION_STATUS.REJECTED]: [MISSION_STATUS.DRAFT],
  [MISSION_STATUS.CANCELLED]: [],
};

export const isValidMissionTransition = (from, to) => {
  const canonicalFrom = resolveMissionStatus(from);
  const canonicalTo = resolveMissionStatus(to);
  if (canonicalFrom === canonicalTo) return true;
  const allowed = MISSION_TRANSITIONS[canonicalFrom];
  return allowed ? allowed.includes(canonicalTo) : false;
};

// Retourne tous les statuts canoniques valides (y compris IN_REVIEW)
export const getAllValidMissionStatuses = () => Object.values(MISSION_STATUS);

export const isMissionEditable = (status) => {
  const canonical = resolveMissionStatus(status);
  return canonical === MISSION_STATUS.DRAFT || canonical === MISSION_STATUS.REJECTED;
};

export const isMissionSubmitted = (status) => {
  const canonical = resolveMissionStatus(status);
  return canonical === MISSION_STATUS.SUBMITTED;
};

// ═══════════════════════════════════════════════════════════════
// 3. PROJECT STATUS STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export const PROJECT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const PROJECT_STATUS_LABELS = {
  [PROJECT_STATUS.ACTIVE]: 'Actif',
  [PROJECT_STATUS.PAUSED]: 'En pause',
  [PROJECT_STATUS.COMPLETED]: 'Terminé',
  [PROJECT_STATUS.ARCHIVED]: 'Archivé',
};

const PROJECT_TRANSITIONS = {
  [PROJECT_STATUS.ACTIVE]: [PROJECT_STATUS.PAUSED, PROJECT_STATUS.COMPLETED],
  [PROJECT_STATUS.PAUSED]: [PROJECT_STATUS.ACTIVE, PROJECT_STATUS.COMPLETED],
  [PROJECT_STATUS.COMPLETED]: [PROJECT_STATUS.ARCHIVED],
  [PROJECT_STATUS.ARCHIVED]: [],
};

export const isValidProjectTransition = (from, to) => {
  const allowed = PROJECT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
};

export const getValidProjectStatuses = () => Object.values(PROJECT_STATUS);

// ═══════════════════════════════════════════════════════════════
// 4. APPROVAL WORKFLOW ROLES (Household)
// ═══════════════════════════════════════════════════════════════

export const HOUSEHOLD_APPROVAL_STEPS = [
  { role: 'CHEF_PROJET', label: 'Validation Chef de Projet', order: 1 },
  { role: 'ADMIN_PROQUELEC', label: 'Validation Administration', order: 2 }, // [FIX M-1] Rôle canonique
  { role: 'DIRECTEUR', label: 'Approbation Direction', order: 3 },
];

export const getDefaultHouseholdWorkflow = (householdId, createdAt) => ({
  householdId,
  steps: HOUSEHOLD_APPROVAL_STEPS.map((s) => ({ ...s, status: 'pending', approvedBy: null, approvedAt: null, comments: null })),
  overallStatus: 'pending',
  createdAt: createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ═══════════════════════════════════════════════════════════════
// 5. TEAM TRADE KEYS (remplace la détection par nom)
// ═══════════════════════════════════════════════════════════════

export const TEAM_TRADES = {
  MASON: 'mason',
  DELIVERY: 'delivery',
  ELECTRICIAN: 'electrician',
  SUPERVISOR: 'supervisor',
  LOGISTICS: 'logistics',
};

export const DEFAULT_TRADE_RATES = {
  [TEAM_TRADES.MASON]: 5,
  [TEAM_TRADES.DELIVERY]: 15,
  [TEAM_TRADES.ELECTRICIAN]: 10,
};

export const DEFAULT_WORKING_DAYS_PER_MONTH = 22;

// ═══════════════════════════════════════════════════════════════
// 6. MISSION APPROVAL ROLES
// ═══════════════════════════════════════════════════════════════

export const MISSION_WORKFLOW_ROLES = {
  DIRECTEUR: { sequence: 1, label: 'Directeur' },
  ADMIN: { sequence: 99, label: 'Administrateur' },
  ADMIN_PROQUELEC: { sequence: 99, label: 'Super Admin' },
};

export const MISSION_REJECTION_CATEGORIES = {
  DONNEES_INCOMPLETES: 'Données incomplètes',
  BUDGET_INCOHERENT: 'Budget incohérent',
  MISSION_HORS_PERIMETRE: 'Mission hors périmètre',
  PLANNING_INCOHERENT: 'Planning incohérent',
  JUSTIFICATIFS_MANQUANTS: 'Justificatifs manquants',
  AUTRE: 'Autre',
};

// ═══════════════════════════════════════════════════════════════
// 7. ROLE NAME NORMALIZATION MAP
// ═══════════════════════════════════════════════════════════════

export const ROLE_ALIASES = {
  'ADMIN_PROQUELEC': 'ADMIN_PROQUELEC',
  'ADMIN': 'ADMIN',
  'ADMIN_ALT': 'ADMIN',
  'DIRECTEUR': 'DIRECTEUR',
  'DIRECTEUR_GENERAL': 'DIRECTEUR',
  'DG_PROQUELEC': 'DIRECTEUR',
  'CHEF_PROJET': 'CHEF_PROJET',
  'COMPTABLE': 'COMPTABLE',
  'CHEF_EQUIPE': 'CHEF_EQUIPE',
  'SUPERVISEUR': 'SUPERVISEUR',
  'CONTROLEUR': 'CONTROLEUR',
  'EMPLOYE': 'EMPLOYE',
  'PATRIMOINE': 'PATRIMOINE',
  'CLIENT_LSE': 'CLIENT_LSE',
};

export const normalizeRoleName = (role) => ROLE_ALIASES[role] || role;

// ═══════════════════════════════════════════════════════════════
// 8. FINANCIAL CHARGE STATUS WORKFLOW
// ═══════════════════════════════════════════════════════════════

export const CHARGE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  RECONCILED: 'RECONCILED',
  CANCELLED: 'CANCELLED',
};

const CHARGE_TRANSITIONS = {
  [CHARGE_STATUS.DRAFT]: [CHARGE_STATUS.PENDING, CHARGE_STATUS.CANCELLED],
  [CHARGE_STATUS.PENDING]: [CHARGE_STATUS.APPROVED, CHARGE_STATUS.CANCELLED],
  [CHARGE_STATUS.APPROVED]: [CHARGE_STATUS.PAID, CHARGE_STATUS.CANCELLED],
  [CHARGE_STATUS.PAID]: [CHARGE_STATUS.RECONCILED],
  [CHARGE_STATUS.RECONCILED]: [],
  [CHARGE_STATUS.CANCELLED]: [],
};

export const isValidChargeTransition = (from, to) => {
  const allowed = CHARGE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
};

// ═══════════════════════════════════════════════════════════════
// 9. DOMAIN TYPES
// ═══════════════════════════════════════════════════════════════

export const DOMAIN_TYPES = {
  GEM: 'gem',
  MES: 'mes',
  TARGETING: 'targeting',
  DATA_COLLECTION: 'data_collection',
};

// ═══════════════════════════════════════════════════════════════
// 10. VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════

export const validateStatusTransition = (entityName, currentStatus, newStatus, transitionValidator) => {
  if (currentStatus === newStatus) return { valid: true };
  if (!transitionValidator(currentStatus, newStatus)) {
    return {
      valid: false,
      error: `Transition de statut invalide pour ${entityName}: "${currentStatus}" → "${newStatus}".`,
      allowedTransitions: getTransitionsFrom(currentStatus, transitionValidator),
    };
  }
  return { valid: true };
};

// [FIX M-4] Retourne les statuts cibles autorisés depuis un statut donné
function getTransitionsFrom(status, transitionValidator) {
  const allPossibleStatuses = [
    ...Object.values(HOUSEHOLD_STATUS),
    ...Object.values(MISSION_STATUS),
    ...Object.values(PROJECT_STATUS),
    ...Object.values(CHARGE_STATUS),
  ];
  const uniqueStatuses = [...new Set(allPossibleStatuses)];
  return uniqueStatuses.filter(s => transitionValidator(status, s));
}

/**
 * Valide que le budget d'une mission est cohérent
 * [FIX m-4] Budget zéro autorisé (missions de reconnaissance, de planification)
 */
export const validateMissionBudget = (budget) => {
  if (budget == null) return { valid: true };
  const amount = Number(budget);
  if (isNaN(amount) || amount < 0) {
    return { valid: false, error: 'Le budget doit être un nombre positif ou nul.' };
  }
  return { valid: true };
};

/**
 * Valide les coordonnées GPS
 */
export const validateGpsCoordinates = (latitude, longitude) => {
  if (latitude == null || longitude == null) return { valid: true };
  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'La latitude doit être comprise entre -90 et 90.' };
  }
  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'La longitude doit être comprise entre -180 et 180.' };
  }
  return { valid: true };
};
