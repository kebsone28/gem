/**
 * 🔐 Security Types & Constants - GED OS
 */

// 1️⃣ RÉFÉRENTIEL DES TENANTS
export const TENANTS = {
  PROQUELEC: 'proquelec',
  SENELEC: 'senelec',
  CLIENT_LSE: 'client_lse',
  GED_OS: 'ged_os',
} as const;

export type TenantId = (typeof TENANTS)[keyof typeof TENANTS];

// 2️⃣ RÉFÉRENTIEL DES RÔLES GÉNÉRIQUES
export const AppRole = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ADMIN: 'ADMIN_PROQUELEC',
  DIRECTEUR: 'DIRECTEUR',
  CHEF_PROJET: 'CHEF_PROJET',
  CHEF_EQUIPE: 'CHEF_EQUIPE',
  COMPTABLE: 'COMPTABLE',
  PATRIMOINE: 'PATRIMOINE',
  SUPERVISEUR: 'SUPERVISEUR',
  CONTROLEUR: 'CONTROLEUR',
  EMPLOYE: 'EMPLOYE',
} as const;

export type UserRole = (typeof AppRole)[keyof typeof AppRole];

export const ROLE_ALIASES: Record<string, UserRole> = {
  // Proquelec
  PROQUELEC_ADMIN: AppRole.ADMIN,
  PROQUELEC_DG: AppRole.DIRECTEUR,
  PROQUELEC_CHEF_PROJET: AppRole.CHEF_PROJET,
  PROQUELEC_DIRECTION: AppRole.DIRECTEUR,
  PROQUELEC_COMPTABLE: AppRole.COMPTABLE,
  PROQUELEC_PATRIMOINE: AppRole.PATRIMOINE,
  PROQUELEC_EMPLOYE: AppRole.EMPLOYE,

  // Senelec
  SENELEC_SUPERVISEUR: AppRole.SUPERVISEUR,
  SENELEC_CONTROLEUR: AppRole.CONTROLEUR,

  // LSE
  CLIENT_LSE_SUPERVISEUR: AppRole.SUPERVISEUR,
  CLIENT_LSE_TECHNIQUE: AppRole.CONTROLEUR,

  // Sous-traitants
  SOUS_TRAITANT_DIRECTEUR: AppRole.DIRECTEUR,
  SOUS_TRAITANT_EMPLOYE: AppRole.EMPLOYE,

  // Legacy / Display names
  'DIRECTION GÉNÉRALE': AppRole.DIRECTEUR,
  'CHEF DE PROJET': AppRole.CHEF_PROJET,
  'CHEF DE CHANTIER': AppRole.DIRECTEUR,
  CHEF_EQUIPE: AppRole.CHEF_EQUIPE,
  DG: AppRole.DIRECTEUR,
  ADMIN: AppRole.ADMIN,
  ADMIN_PROQUELEC: AppRole.ADMIN,
  DG_PROQUELEC: AppRole.DIRECTEUR,
};

/**
 * 👤 Interface Utilisateur Enterprise
 */
export interface AuthUser {
  id: string;
  email: string;
  tenantId: TenantId | string;
  role: UserRole | string;
  isPlatformAdmin?: boolean;
  permissions?: string[];
  scopes?: {
    regions?: string[];
    projects?: string[];
    villages?: string[];
    teams?: string[];
  };
}

/**
 * 🏷️ Ressources Métiers Sécurisées
 */
export interface SecurityResource {
  id: string;
  tenantId: string;
  regionId?: string;
  projectId?: string;
  createdBy?: string;
  status?: string;
}

export interface Mission extends SecurityResource {
  status: 'draft' | 'validated' | 'approved' | 'rejected' | 'archived';
}

/**
 * 📝 Moteur de Réponses & Raisons
 */
export const PolicyReason = {
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  REGION_MISMATCH: 'REGION_MISMATCH',
  PROJECT_MISMATCH: 'PROJECT_MISMATCH',
  STATUS_LOCKED: 'STATUS_LOCKED',
  NOT_OWNER: 'NOT_OWNER',
  EXPIRED: 'EXPIRED',
} as const;

export type PolicyReasonType = (typeof PolicyReason)[keyof typeof PolicyReason];

export interface PolicyResponse {
  allowed: boolean;
  reason?: PolicyReasonType;
  message?: string;
}

// 3️⃣ REGISTRY DES PERMISSIONS (NAMESPACED)
export const PERMISSIONS = {
  // ── MISSIONS ──
  MISSIONS_READ: 'missions.read',
  MISSIONS_CREATE: 'missions.create',
  MISSIONS_UPDATE: 'missions.update',
  MISSIONS_DELETE: 'missions.delete',
  MISSIONS_VALIDATE: 'missions.validate',
  MISSIONS_APPROVE: 'missions.approve',
  MISSIONS_PLANNING: 'missions.planning',

  // ── TERRAIN ──
  TERRAIN_READ: 'terrain.read',
  TERRAIN_WRITE: 'terrain.write',
  TERRAIN_TERMINAL: 'terrain.terminal',
  TERRAIN_REJECT: 'terrain.reject',
  TERRAIN_ZONES: 'terrain.zones',
  TERRAIN_MENAGES: 'terrain.menages',
  TERRAIN_MAP: 'terrain.map',

  // ── CAHIER DES CHARGES ──
  CAHIER_TECHNICAL: 'cahier.technical',
  CAHIER_CONTRACTS: 'cahier.contracts',
  CAHIER_STRATEGY: 'cahier.strategy',

  // ── FINANCES ──
  FINANCE_READ: 'finance.read',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_PAYMENTS: 'finance.payments',
  FINANCE_EXPORT: 'finance.export',
  FINANCE_REPORTS: 'finance.reports',

  // ── LOGISTIQUE (ISOLATION TOTALE) ──
  LOGISTIQUE_STOCK: 'logistique.stock',
  LOGISTIQUE_DELIVERIES: 'logistique.deliveries',
  LOGISTIQUE_AGENTS: 'logistique.agents',
  LOGISTIQUE_OM: 'logistique.om',
  LOGISTIQUE_ATELIER: 'logistique.atelier',
  LOGISTIQUE_DEPLOYMENT: 'logistique.deployment',
  LOGISTIQUE_READ: 'logistique.read',
  LOGISTIQUE_MANAGE: 'logistique.manage',

  // ── DASHBOARD (VUES SPÉCIFIQUES) ──
  DASHBOARD_ADMIN: 'dashboard.admin',
  DASHBOARD_PROJECT: 'dashboard.project',
  DASHBOARD_TEAM: 'dashboard.team',
  DASHBOARD_CLIENT: 'dashboard.client',
  DASHBOARD_ACCOUNTING: 'dashboard.accounting',
  DASHBOARD_ASSETS: 'dashboard.assets',

  // ── PARAMÈTRES (SETTINGS) ──
  SETTINGS_CHARGES: 'settings.charges',
  SETTINGS_KOBO: 'settings.kobo',
  SETTINGS_DATA: 'settings.data',
  SETTINGS_DATAHUB: 'settings.datahub',
  SETTINGS_SYSTEM: 'settings.system',

  // ── SYSTÈME ──
  SYSTEM_USERS: 'system.users',
  SYSTEM_ROLES: 'system.roles',
  SYSTEM_AUDIT: 'system.audit',
  SYSTEM_SYNC: 'system.sync',
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_EXPORT: 'system.export',
  SYSTEM_MESSAGES: 'system.messages',

  // ── UI & NAVIGATION ──
  UI_MAP: 'ui.map',
  UI_CHAT: 'ui.chat',
  UI_ALERTS: 'ui.alerts',
  UI_TRAINING: 'ui.training',
  UI_PROJECTS: 'ui.projects',
  UI_TEAMS: 'ui.teams',
  UI_DASHBOARD: 'ui.dashboard',

  // ── IA (GED OS AI) ──
  IA_USE: 'ia.use',
  IA_METRICS: 'ia.metrics',
  IA_SIMULATION: 'ia.simulation',
  IA_CONFIG: 'ia.config',

  // ── DOCUMENTS ──
  DOCS_READ: 'docs.read',
  DOCS_CONFIDENTIAL: 'docs.confidential',
  DOCS_PV: 'docs.pv',

  // ── MODULES ──
  MODULES_MANAGE: 'modules.manage',

  // ── SECTEURS AUTORISÉS ──
  SECTOR_GEM: 'sector.gem',
  SECTOR_MES: 'sector.mes',

  // ── TOOLBOX (GED OS Toolbox) ──
  TOOLBOX_SUBMISSION_CREATE: 'toolbox.submission.create',
  TOOLBOX_SUBMISSION_EDIT: 'toolbox.submission.edit',
  TOOLBOX_SUBMISSION_VALIDATE: 'toolbox.submission.validate',
  TOOLBOX_SUBMISSION_DELETE: 'toolbox.submission.delete',
  TOOLBOX_SETTINGS_READ: 'toolbox.settings.read',
  TOOLBOX_SETTINGS_MANAGE: 'toolbox.settings.manage',
} as const;

export const ROLES = AppRole;

export const LEGACY_MAPPING: Record<string, string> = {
  voir_missions: PERMISSIONS.MISSIONS_READ,
  creer_mission: PERMISSIONS.MISSIONS_CREATE,
  modifier_mission: PERMISSIONS.MISSIONS_UPDATE,
  valider_mission: PERMISSIONS.MISSIONS_VALIDATE,
  approuver_mission: PERMISSIONS.MISSIONS_APPROVE,
  voir_finances: PERMISSIONS.FINANCE_READ,
  voir_paiements: PERMISSIONS.FINANCE_PAYMENTS,
  voir_carte: PERMISSIONS.UI_MAP,
  acces_chat: PERMISSIONS.UI_CHAT,
  voir_alertes: PERMISSIONS.UI_ALERTS,
  voir_formations: PERMISSIONS.UI_TRAINING,
  voir_projets: PERMISSIONS.UI_PROJECTS,
  voir_equipes: PERMISSIONS.UI_TEAMS,
  utiliser_ia: PERMISSIONS.IA_USE,
  gerer_utilisateurs: PERMISSIONS.SYSTEM_USERS,

  /**
   * Jetons historiques du MODULE_REGISTRY (notation `domaine.action`) et autres alias.
   * Permet à `hasPermission(user, 'mission.view')` de résoudre vers les atomes actuels.
   */
  'mission.view': PERMISSIONS.MISSIONS_READ,
  'project.view': PERMISSIONS.UI_PROJECTS,
  'household.view': PERMISSIONS.TERRAIN_READ,
  /** Ancien jeton module « rapports » : accès large (préférer les atomes explicites côté registry) */
  'report.view': PERMISSIONS.MISSIONS_READ,
  'chat.view': PERMISSIONS.UI_CHAT,
  'project.edit': PERMISSIONS.MISSIONS_UPDATE,
  'audit.view': PERMISSIONS.SYSTEM_AUDIT,
  'formation.view': PERMISSIONS.UI_TRAINING,
  'kobo.manage': PERMISSIONS.SETTINGS_KOBO,

  /** Alignement API / authorize (même cible que le backend PERMISSION_KEY_TO_ATOM) */
  'project.template.create': PERMISSIONS.MODULES_MANAGE,
  'project.template.update': PERMISSIONS.MODULES_MANAGE,
  'project.template.delete': PERMISSIONS.MODULES_MANAGE,
  'project.template.manage': PERMISSIONS.MODULES_MANAGE,
};
