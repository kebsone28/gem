/**
 * Action Risk Configuration
 * Détermine le comportement d'approbation pour chaque action
 * 
 * Risk Levels:
 * - LOW: Auto-exécution directe
 * - MEDIUM: Auto-exécution + logging + audit trail
 * - HIGH: Validation humaine obligatoire (admin review)
 */

export const actionConfig = {
  // ============= LECTURE / ANALYSE (LOW RISK) =============
  getHouseholds: {
    risk: 'LOW',
    description: 'Lire les données des ménages',
    autoExecute: true,
    timeout: 5000
  },
  
  analyzeConsumption: {
    risk: 'LOW',
    description: 'Analyser les patterns de consommation',
    autoExecute: true,
    timeout: 10000
  },

  // ============= RAPPORTS & EXPORT (MEDIUM RISK) =============
  createReport: {
    risk: 'MEDIUM',
    description: 'Générer un rapport technique/data',
    autoExecute: true,
    timeout: 15000,
    requiresLog: true
  },

  callAPI: {
    risk: 'MEDIUM',
    description: 'Appeler une API externe',
    autoExecute: true,
    timeout: 8000,
    requiresLog: true
  },

  // ============= CRÉATION DE DONNÉES (HIGH RISK) =============
  createMission: {
    risk: 'HIGH',
    description: 'Créer une nouvelle mission terrain',
    autoExecute: false,
    requiresApproval: true,
    timeout: 30000,
    requiredRoles: ['admin', 'manager']
  },

  assignTechnician: {
    risk: 'HIGH',
    description: 'Assigner un technicien à une mission',
    autoExecute: false,
    requiresApproval: true,
    timeout: 20000,
    requiredRoles: ['admin', 'manager']
  },

  modifyHouseholdData: {
    risk: 'HIGH',
    description: 'Modifier les données d\'un ménage',
    autoExecute: false,
    requiresApproval: true,
    timeout: 20000,
    requiredRoles: ['admin', 'supervisor']
  },

  updateProjectStatus: {
    risk: 'HIGH',
    description: 'Changer le statut d\'un projet',
    autoExecute: false,
    requiresApproval: true,
    timeout: 25000,
    requiredRoles: ['admin']
  },

  // ============= SUPPRESSION (CRITICAL) =============
  deleteData: {
    risk: 'HIGH',
    description: 'Supprimer des données',
    autoExecute: false,
    requiresApproval: true,
    timeout: 30000,
    requiredRoles: ['admin'],
    requiresMultipleApprovals: true
  }
};

/**
 * Mapping: Agent -> Actions disponibles
 * Détermine quels actions chaque agent peut proposer
 */
export const agentPermissions = {
  TechAgent: [
    'getHouseholds',
    'analyzeConsumption',
    'createReport',
    'callAPI',
    'createMission',
    'modifyHouseholdData'
  ],
  
  DataAgent: [
    'getHouseholds',
    'analyzeConsumption',
    'createReport',
    'callAPI'
  ],
  
  SupportAgent: [
    'getHouseholds',
    'createReport',
    'callAPI'
  ],
  
  MissionSage: [
    'getHouseholds',
    'analyzeConsumption',
    'createReport',
    'callAPI'
  ]
};

/**
 * Confidence Thresholds
 * Auto-exécution selon le score de confiance de l'AI
 */
export const confidenceThresholds = {
  autoExecuteHighConfidence: 0.90,    // > 90% = exécution directe même HIGH RISK
  autoExecuteMediumConfidence: 0.75,  // 75-90% = exécution auto
  requireApprovalConfidence: 0.50     // < 50% = validation obligatoire
};

/**
 * Risk-based Approval Settings
 */
export const approvalSettings = {
  LOW: {
    requiresApproval: false,
    autoExecute: true,
    logResult: false,
    notifyAdmin: false
  },
  MEDIUM: {
    requiresApproval: false,
    autoExecute: true,
    logResult: true,
    notifyAdmin: true
  },
  HIGH: {
    requiresApproval: true,
    autoExecute: false,
    logResult: true,
    notifyAdmin: true,
    retentionDays: 90
  }
};

/**
 * Helper: Get config for an action
 */
export function getActionConfig(actionType) {
  return actionConfig[actionType] || {
    risk: 'HIGH',
    description: 'Action inconnue',
    autoExecute: false,
    requiresApproval: true
  };
}

/**
 * Helper: Check if agent can execute action
 */
export function canAgentExecuteAction(agentName, actionType) {
  const allowedActions = agentPermissions[agentName] || [];
  return allowedActions.includes(actionType);
}

/**
 * Helper: Determine execution flow based on risk + confidence
 */
export function determineExecutionFlow(riskLevel, confidence) {
  // Si HIGH CONFIDENCE + HIGH RISK → peut auto-exécuter
  if (confidence >= confidenceThresholds.autoExecuteHighConfidence) {
    return 'AUTO_EXECUTE';
  }

  // Si MEDIUM RISK + bonne confiance
  if (riskLevel === 'MEDIUM' && confidence >= confidenceThresholds.autoExecuteMediumConfidence) {
    return 'AUTO_EXECUTE_LOGGED';
  }

  // Si basse confiance → validation obligatoire
  if (confidence < confidenceThresholds.requireApprovalConfidence) {
    return 'REQUIRE_APPROVAL';
  }

  // Par défaut: selon le risk level
  if (riskLevel === 'LOW') return 'AUTO_EXECUTE';
  if (riskLevel === 'MEDIUM') return 'AUTO_EXECUTE_LOGGED';
  return 'REQUIRE_APPROVAL';
}
