
/**
 * 🔐 Moteur de Sécurité & RBAC Enterprise - GEM SAAS
 * Architecture : Namespaced RBAC + Permission Groups + ABAC Ready
 */

// 1️⃣ RÉFÉRENTIEL DES RÔLES
export const ROLES = {
  CLIENT_LSE_SUPERVISEUR: 'CLIENT_LSE_SUPERVISEUR',
  CLIENT_LSE_TECHNIQUE: 'CLIENT_LSE_TECHNIQUE',
  PROQUELEC_ADMIN: 'PROQUELEC_ADMIN',
  PROQUELEC_DG: 'PROQUELEC_DG',
  PROQUELEC_CHEF_PROJET: 'PROQUELEC_CHEF_PROJET',
  PROQUELEC_DIRECTION: 'PROQUELEC_DIRECTION',
  PROQUELEC_COMPTABLE: 'PROQUELEC_COMPTABLE',
  PROQUELEC_PATRIMOINE: 'PROQUELEC_PATRIMOINE',
  PROQUELEC_EMPLOYE: 'PROQUELEC_EMPLOYE',
  SENELEC_SUPERVISEUR: 'SENELEC_SUPERVISEUR',
  SENELEC_CONTROLEUR: 'SENELEC_CONTROLEUR',
  SOUS_TRAITANT_DIRECTEUR: 'SOUS_TRAITANT_DIRECTEUR',
  SOUS_TRAITANT_EMPLOYE: 'SOUS_TRAITANT_EMPLOYE',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_ALIASES: Record<string, UserRole> = {
  CLIENT_LSE: ROLES.CLIENT_LSE_SUPERVISEUR,
  ADMIN_PROQUELEC: ROLES.PROQUELEC_ADMIN,
  DG: ROLES.PROQUELEC_DG,
  CP: ROLES.PROQUELEC_CHEF_PROJET,
  CHEF_EQUIPE: ROLES.PROQUELEC_DIRECTION,
  COMPTABLE: ROLES.PROQUELEC_COMPTABLE,
  PATRIMOINE: ROLES.PROQUELEC_PATRIMOINE,
  EMPLOYE: ROLES.PROQUELEC_EMPLOYE,
};

// 2️⃣ REGISTRY DES PERMISSIONS (NAMESPACED)
export const PERMISSIONS = {
  // --- NEW NAMESPACED KEYS ---
  MISSIONS_READ: 'missions.read',
  MISSIONS_CREATE: 'missions.create',
  MISSIONS_UPDATE: 'missions.update',
  MISSIONS_DELETE: 'missions.delete',
  MISSIONS_VALIDATE: 'missions.validate',
  MISSIONS_APPROVE: 'missions.approve',
  MISSIONS_ARCHIVE: 'missions.archive',
  MISSIONS_PLANNING: 'missions.planning',
  
  // --- LEGACY KEYS (Backward Compatibility) ---
  VOIR_MISSIONS: 'missions.read',
  CREER_MISSION: 'missions.create',
  MODIFIER_MISSION: 'missions.update',
  VALIDER_MISSION: 'missions.validate',
  APPROUVER_MISSION: 'missions.approve',
  SUPPRIMER_MISSION: 'missions.delete',
  GERER_PLANNING: 'missions.planning',
  VOIR_FINANCES: 'finance.read',
  VOIR_PAIEMENTS: 'finance.payments',
  VOIR_RAPPORTS_TERRAIN: 'terrain.read',
  VOIR_RAPPORTS_FINANCIERS: 'finance.reports',
  VOIR_CARTE: 'ui.map',
  ACCES_CHAT: 'ui.chat',
  VOIR_ALERTES: 'ui.alerts',
  VOIR_FORMATIONS: 'ui.training',
  VOIR_PROJETS: 'ui.projects',
  VOIR_EQUIPES: 'ui.teams',
  UTILISER_IA: 'ia.use',
  VOIR_METRIQUES_IA: 'ia.metrics',
  VOIR_SIMULATION: 'ia.simulation',
  VOIR_DOCUMENTS_CONFIDENTIELS: 'docs.confidential',
  GERER_PV: 'docs.pv',
  ACCES_TERMINAL_KOBO: 'terrain.terminal',
  VOIR_LOGISTIQUE: 'logistique.read',
  GERER_LOGISTIQUE: 'logistique.manage',
  GERER_UTILISATEURS: 'system.users',
  GERER_ROLES: 'system.roles',
  VOIR_AUDIT_LOGS: 'system.audit',
  VOIR_SYNCHRO: 'system.sync',
  GERER_PARAMETRES: 'system.config',
  EXPORTER_DONNEES: 'system.export',
  DIFFUSER_MESSAGE_SYSTEME: 'system.messages',
  GERER_MENAGES: 'terrain.menages',

  // --- NEW ATOMIC PERMISSIONS ---
  TERRAIN_READ: 'terrain.read',
  TERRAIN_WRITE: 'terrain.write',
  TERRAIN_TERMINAL: 'terrain.terminal',
  TERRAIN_REJECT: 'terrain.reject',
  TERRAIN_ZONES: 'terrain.zones',
  TERRAIN_MENAGES: 'terrain.menages',
  
  FINANCE_READ: 'finance.read',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_PAYMENTS: 'finance.payments',
  FINANCE_EXPORT: 'finance.export',
  FINANCE_REPORTS: 'finance.reports',
  
  LOGISTIQUE_READ: 'logistique.read',
  LOGISTIQUE_MANAGE: 'logistique.manage',
  
  SYSTEM_USERS: 'system.users',
  SYSTEM_ROLES: 'system.roles',
  SYSTEM_AUDIT: 'system.audit',
  SYSTEM_SYNC: 'system.sync',
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_EXPORT: 'system.export',
  SYSTEM_MESSAGES: 'system.messages',
  
  UI_MAP: 'ui.map',
  UI_CHAT: 'ui.chat',
  UI_ALERTS: 'ui.alerts',
  UI_TRAINING: 'ui.training',
  UI_PROJECTS: 'ui.projects',
  UI_TEAMS: 'ui.teams',
  UI_DASHBOARD: 'ui.dashboard',
  
  IA_USE: 'ia.use',
  IA_METRICS: 'ia.metrics',
  IA_SIMULATION: 'ia.simulation',
  
  DOCS_READ: 'docs.read',
  DOCS_CONFIDENTIAL: 'docs.confidential',
  DOCS_PV: 'docs.pv',
} as const;

// 3️⃣ GROUPES DE PERMISSIONS (PACKS FONCTIONNELS)
export const PERMISSION_GROUPS = {
  SOCLE_COMMUN: [
    PERMISSIONS.UI_MAP,
    PERMISSIONS.UI_CHAT,
    PERMISSIONS.UI_ALERTS,
    PERMISSIONS.UI_TRAINING,
  ],
  MISSION_VIEWER: [
    PERMISSIONS.MISSIONS_READ,
    PERMISSIONS.UI_PROJECTS,
    PERMISSIONS.TERRAIN_READ,
  ],
  MISSION_MANAGER: [
    PERMISSIONS.MISSIONS_READ,
    PERMISSIONS.MISSIONS_CREATE,
    PERMISSIONS.MISSIONS_UPDATE,
    PERMISSIONS.MISSIONS_PLANNING,
  ],
  FINANCE_VIEWER: [
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_REPORTS,
  ],
  FINANCE_ADMIN: [
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_PAYMENTS,
    PERMISSIONS.FINANCE_EXPORT,
  ],
  TERRAIN_OPERATOR: [
    PERMISSIONS.TERRAIN_READ,
    PERMISSIONS.TERRAIN_TERMINAL,
    PERMISSIONS.TERRAIN_MENAGES,
  ],
  SUPERVISOR_PACK: [
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.DOCS_PV,
    PERMISSIONS.SYSTEM_AUDIT,
  ],
};

// 4️⃣ MATRICE DES RÔLES (CLEAN & SCALABLE)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [ROLES.PROQUELEC_ADMIN]: Object.values(PERMISSIONS),

  [ROLES.PROQUELEC_DG]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    ...PERMISSION_GROUPS.FINANCE_ADMIN,
    ...PERMISSION_GROUPS.SUPERVISOR_PACK,
    PERMISSIONS.MISSIONS_APPROVE,
    PERMISSIONS.IA_USE,
    PERMISSIONS.IA_METRICS,
    PERMISSIONS.IA_SIMULATION,
    PERMISSIONS.UI_DASHBOARD,
    PERMISSIONS.SYSTEM_EXPORT,
    PERMISSIONS.SYSTEM_MESSAGES,
    PERMISSIONS.SYSTEM_SYNC,
    PERMISSIONS.UI_TEAMS,
    PERMISSIONS.DOCS_CONFIDENTIAL,
  ],

  [ROLES.PROQUELEC_CHEF_PROJET]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    PERMISSIONS.TERRAIN_READ,
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.UI_TEAMS,
    PERMISSIONS.IA_USE,
  ],

  [ROLES.PROQUELEC_DIRECTION]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.IA_USE,
  ],

  [ROLES.PROQUELEC_COMPTABLE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    ...PERMISSION_GROUPS.FINANCE_ADMIN,
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.SYSTEM_EXPORT,
  ],

  [ROLES.PROQUELEC_PATRIMOINE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.TERRAIN_MENAGES,
    PERMISSIONS.LOGISTIQUE_MANAGE,
    PERMISSIONS.UI_TEAMS,
  ],

  [ROLES.PROQUELEC_EMPLOYE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
  ],

  [ROLES.SENELEC_SUPERVISEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.SYSTEM_EXPORT,
  ],

  [ROLES.SENELEC_CONTROLEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.TERRAIN_REJECT,
  ],

  [ROLES.SOUS_TRAITANT_DIRECTEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.TERRAIN_TERMINAL,
    PERMISSIONS.SYSTEM_SYNC,
    PERMISSIONS.UI_TEAMS,
  ],

  [ROLES.SOUS_TRAITANT_EMPLOYE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.TERRAIN_OPERATOR,
  ],

  [ROLES.CLIENT_LSE_SUPERVISEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.FINANCE_VIEWER,
    PERMISSIONS.SYSTEM_EXPORT,
  ],

  [ROLES.CLIENT_LSE_TECHNIQUE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
  ],
};

// 5️⃣ PONT DE MIGRATION (LEGACY COMPATIBILITY)
export const LEGACY_MAPPING: Record<string, string> = {
  'voir_missions': PERMISSIONS.MISSIONS_READ,
  'creer_mission': PERMISSIONS.MISSIONS_CREATE,
  'modifier_mission': PERMISSIONS.MISSIONS_UPDATE,
  'valider_mission': PERMISSIONS.MISSIONS_VALIDATE,
  'approuver_mission': PERMISSIONS.MISSIONS_APPROVE,
  'voir_finances': PERMISSIONS.FINANCE_READ,
  'voir_paiements': PERMISSIONS.FINANCE_PAYMENTS,
  'voir_carte': PERMISSIONS.UI_MAP,
  'acces_chat': PERMISSIONS.UI_CHAT,
  'voir_alertes': PERMISSIONS.UI_ALERTS,
  'voir_formations': PERMISSIONS.UI_TRAINING,
  'voir_projets': PERMISSIONS.UI_PROJECTS,
  'voir_equipes': PERMISSIONS.UI_TEAMS,
  'utiliser_ia': PERMISSIONS.IA_USE,
};

// 6️⃣ LABELS UI COMPLET
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.SYSTEM_USERS]: 'Gestion des Comptes',
  [PERMISSIONS.SYSTEM_CONFIG]: 'Paramètres Système',
  [PERMISSIONS.SYSTEM_AUDIT]: 'Historique (Audit Logs)',
  [PERMISSIONS.SYSTEM_MESSAGES]: 'Diffuser Message Global',
  [PERMISSIONS.SYSTEM_EXPORT]: 'Exports Système Massifs',
  [PERMISSIONS.MISSIONS_READ]: 'Voir Registre Missions',
  [PERMISSIONS.MISSIONS_CREATE]: 'Créer Missions',
  [PERMISSIONS.MISSIONS_UPDATE]: 'Modifier Missions',
  [PERMISSIONS.MISSIONS_VALIDATE]: 'Validation Opérationnelle',
  [PERMISSIONS.MISSIONS_APPROVE]: 'Approbation Finale (DG)',
  [PERMISSIONS.MISSIONS_DELETE]: 'Supprimer Missions',
  [PERMISSIONS.MISSIONS_PLANNING]: 'Planning (Gantt)',
  [PERMISSIONS.UI_TEAMS]: 'Voir & Gérer les Équipes',
  [PERMISSIONS.FINANCE_READ]: 'Tableau de bord Finances',
  [PERMISSIONS.FINANCE_MANAGE]: 'Gestion des Budgets',
  [PERMISSIONS.FINANCE_PAYMENTS]: 'Suivi des Paiements',
  [PERMISSIONS.FINANCE_COMPTABILITE]: 'Exports Comptables',
  [PERMISSIONS.FINANCE_REPORTS]: 'Rapports Financiers',
  [PERMISSIONS.UI_MAP]: 'Carte Interactive',
  [PERMISSIONS.TERRAIN_ZONES]: 'Gestion Zones/Grappes',
  [PERMISSIONS.TERRAIN_MENAGES]: 'Gestion des Ménages',
  [PERMISSIONS.TERRAIN_TERMINAL]: 'Terminal Collecte Kobo',
  [PERMISSIONS.TERRAIN_REJECT]: 'Rejeter Dossier Kobo',
  [PERMISSIONS.UI_PROJECTS]: 'Registre des Projets',
  [PERMISSIONS.UI_DASHBOARD]: 'Personnaliser Dashboard',
  [PERMISSIONS.LOGISTIQUE_READ]: 'État des Stocks',
  [PERMISSIONS.LOGISTIQUE_MANAGE]: 'Mouvements & Logistique',
  [PERMISSIONS.DOCS_PV]: 'Génération des PV',
  [PERMISSIONS.DOCS_CONFIDENTIAL]: 'Voir Docs Confidentiels',
  [PERMISSIONS.UI_TRAINING]: 'Accès Sessions Formation',
  [PERMISSIONS.UI_CHAT]: 'Utiliser la Messagerie',
  [PERMISSIONS.UI_ALERTS]: 'Consulter les Alertes',
  [PERMISSIONS.SYSTEM_SYNC]: 'Logs de Synchronisation',
  [PERMISSIONS.IA_USE]: 'Assistant Wanekoo',
  [PERMISSIONS.IA_METRICS]: 'Consommation & Coûts IA',
  [PERMISSIONS.IA_SIMULATION]: 'Scénarios de Simulation',
};

// 7️⃣ HELPERS & POLICY ENGINE
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(ROLES).includes(upper as any)) return upper as UserRole;
  return ROLE_ALIASES[upper] || null;
};

export const isMasterAdmin = (user: any): boolean => {
  if (!user) return false;
  const nRole = normalizeRole(user.role);
  return nRole === ROLES.PROQUELEC_ADMIN || user.email === 'admingem' || user.email === 'admin@proquelec.com';
};

export const hasPermission = (user: any, permission: string | string[]): boolean => {
  if (!user) return false;
  
  const nRole = normalizeRole(user.role);
  if (nRole === ROLES.PROQUELEC_ADMIN || user.email === 'admingem') return true;

  const userPerms = new Set(user.permissions || []);
  
  if (userPerms.size === 0 && nRole) {
    (ROLE_PERMISSIONS[nRole] || []).forEach(p => userPerms.add(p));
  }

  const check = (p: string) => {
    if (userPerms.has(p)) return true;
    const legacyKey = Object.keys(LEGACY_MAPPING).find(key => LEGACY_MAPPING[key] === p);
    if (legacyKey && userPerms.has(legacyKey)) return true;
    if (LEGACY_MAPPING[p] && userPerms.has(LEGACY_MAPPING[p])) return true;
    return false;
  };

  if (Array.isArray(permission)) {
    return permission.some(p => check(p));
  }
  return check(permission);
};
