/**
 * actionConfig.js
 * Configuration centralisée des types d'actions pour l'ApprovalService.
 * Définit les niveaux de risque, seuils de confiance et droits d'exécution
 * par agent IA pour le système d'approbation GEM-MINT.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION DES ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_CONFIGS = {
  // Actions Missions
  createMission: {
    risk: 'LOW',
    description: 'Créer une nouvelle mission terrain',
    requiresApproval: false,
    allowedAgents: ['TechAgent', 'MissionSage', 'DataAgent']
  },
  updateMission: {
    risk: 'LOW',
    description: 'Mettre à jour une mission existante',
    requiresApproval: false,
    allowedAgents: ['TechAgent', 'MissionSage']
  },
  submitMission: {
    risk: 'MEDIUM',
    description: 'Soumettre une mission pour approbation DG',
    requiresApproval: false,
    allowedAgents: ['MissionSage']
  },
  approveMission: {
    risk: 'HIGH',
    description: 'Approuver et certifier une mission',
    requiresApproval: true,
    allowedAgents: []
  },

  // Actions Données
  syncKoboData: {
    risk: 'LOW',
    description: 'Synchroniser les données Kobo vers la DB locale',
    requiresApproval: false,
    allowedAgents: ['DataAgent', 'TechAgent']
  },
  modifyData: {
    risk: 'MEDIUM',
    description: 'Modifier des données terrain',
    requiresApproval: false,
    allowedAgents: ['DataAgent', 'TechAgent']
  },
  deleteData: {
    risk: 'HIGH',
    description: 'Supprimer des données permanentes',
    requiresApproval: true,
    allowedAgents: []
  },

  // Actions Équipes
  assignTechnician: {
    risk: 'LOW',
    description: 'Assigner un technicien à un lot',
    requiresApproval: false,
    allowedAgents: ['TechAgent', 'MissionSage']
  },
  createTeam: {
    risk: 'MEDIUM',
    description: 'Créer une nouvelle équipe terrain',
    requiresApproval: false,
    allowedAgents: ['TechAgent']
  },
  disbandTeam: {
    risk: 'HIGH',
    description: 'Dissoudre une équipe terrain',
    requiresApproval: true,
    allowedAgents: []
  },

  // Actions PV
  generatePV: {
    risk: 'MEDIUM',
    description: 'Générer automatiquement un Procès-Verbal',
    requiresApproval: false,
    allowedAgents: ['TechAgent', 'MissionSage', 'SupportAgent']
  },
  sendPVAlert: {
    risk: 'LOW',
    description: 'Envoyer une alerte SMS/Email liée à un PV',
    requiresApproval: false,
    allowedAgents: ['TechAgent', 'MissionSage', 'SupportAgent', 'DataAgent']
  },

  // Actions Support
  sendNotification: {
    risk: 'LOW',
    description: 'Envoyer une notification système',
    requiresApproval: false,
    allowedAgents: ['SupportAgent', 'TechAgent', 'MissionSage', 'DataAgent']
  },
  escalateIssue: {
    risk: 'MEDIUM',
    description: 'Escalader un problème à la direction',
    requiresApproval: false,
    allowedAgents: ['SupportAgent']
  },

  // Actions Système
  exportReport: {
    risk: 'LOW',
    description: 'Exporter un rapport analytique',
    requiresApproval: false,
    allowedAgents: ['MissionSage', 'DataAgent', 'TechAgent', 'SupportAgent']
  },
  resetData: {
    risk: 'HIGH',
    description: 'Réinitialisation totale de données critiques',
    requiresApproval: true,
    allowedAgents: []
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEUILS DE CONFIANCE
// ─────────────────────────────────────────────────────────────────────────────

export const confidenceThresholds = {
  LOW: 0.4,     // Actions LOW risk — exécution auto si confiance > 40%
  MEDIUM: 0.65, // Actions MEDIUM risk — exécution auto si confiance > 65%
  HIGH: 0.90    // Actions HIGH risk — toujours requiert approbation humaine
};

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES GLOBAUX D'APPROBATION
// ─────────────────────────────────────────────────────────────────────────────

export const approvalSettings = {
  // Auto-exécution des actions LOW risk sans log
  autoExecuteLow: true,
  // Auto-exécution des actions MEDIUM risk avec log obligatoire
  autoExecuteMedium: true,
  // TTL des approbations en attente (48h = 172800000 ms)
  pendingTTLMs: 172800000,
  // Notifier les managers pour les actions HIGH risk
  notifyManagersOnHighRisk: true
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la configuration d'une action donnée.
 * Retourne une configuration par défaut MEDIUM si l'actionType est inconnu.
 */
export const getActionConfig = (actionType) => {
  return ACTION_CONFIGS[actionType] || {
    risk: 'MEDIUM',
    description: `Action générique: ${actionType}`,
    requiresApproval: false,
    allowedAgents: []
  };
};

/**
 * Vérifie si un agent est autorisé à exécuter une action.
 * Les actions HIGH risk bloquées sont toujours refusées.
 */
export const canAgentExecuteAction = (agentName, actionType) => {
  const config = getActionConfig(actionType);

  // Actions HIGH risk avec requiresApproval : aucun agent ne peut auto-exécuter
  if (config.risk === 'HIGH' && config.requiresApproval) {
    return false;
  }

  // Si allowedAgents est vide → ouvert à tous les agents
  if (!config.allowedAgents || config.allowedAgents.length === 0) {
    return true;
  }

  return config.allowedAgents.includes(agentName);
};

/**
 * Détermine le flux d'exécution en fonction du risque et de la confiance.
 * @returns {'AUTO_EXECUTE' | 'AUTO_EXECUTE_LOGGED' | 'REQUIRE_APPROVAL'}
 */
export const determineExecutionFlow = (riskLevel, confidence) => {
  const threshold = confidenceThresholds[riskLevel] ?? 0.65;

  if (riskLevel === 'LOW' && approvalSettings.autoExecuteLow) {
    return confidence >= threshold ? 'AUTO_EXECUTE' : 'REQUIRE_APPROVAL';
  }

  if (riskLevel === 'MEDIUM' && approvalSettings.autoExecuteMedium) {
    return confidence >= threshold ? 'AUTO_EXECUTE_LOGGED' : 'REQUIRE_APPROVAL';
  }

  // HIGH risk = toujours approbation humaine
  return 'REQUIRE_APPROVAL';
};
