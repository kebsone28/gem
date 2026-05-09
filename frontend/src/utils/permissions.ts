
/**
 * 🔐 Moteur de Sécurité & IAM Enterprise - GEM SAAS
 * Phase 3 : ABAC (Attribute-Based Access Control) & Scopes Contextuels
 */

// 1️⃣ RÉFÉRENTIEL DES TENANTS
export const TENANTS = {
  PROQUELEC: 'proquelec',
  SENELEC: 'senelec',
  CLIENT_LSE: 'client_lse',
  GEM: 'gem',
} as const;

export type TenantId = (typeof TENANTS)[keyof typeof TENANTS];

// 2️⃣ RÉFÉRENTIEL DES RÔLES GÉNÉRIQUES
export const AppRole = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ADMIN: 'ADMIN',
  DG: 'DG',
  CHEF_PROJET: 'CHEF_PROJET',
  DIRECTION: 'DIRECTION',
  COMPTABLE: 'COMPTABLE',
  PATRIMOINE: 'PATRIMOINE',
  SUPERVISEUR: 'SUPERVISEUR',
  CONTROLEUR: 'CONTROLEUR',
  EMPLOYE: 'EMPLOYE',
} as const;

export type UserRole = (typeof AppRole)[keyof typeof AppRole];

export const ROLE_ALIASES: Record<string, UserRole> = {
  PROQUELEC_ADMIN: AppRole.ADMIN,
  PROQUELEC_DG: AppRole.DG,
  PROQUELEC_CHEF_PROJET: AppRole.CHEF_PROJET,
  PROQUELEC_DIRECTION: AppRole.DIRECTION,
  PROQUELEC_COMPTABLE: AppRole.COMPTABLE,
  PROQUELEC_PATRIMOINE: AppRole.PATRIMOINE,
  PROQUELEC_EMPLOYE: AppRole.EMPLOYE,
  SENELEC_SUPERVISEUR: AppRole.SUPERVISEUR,
  SENELEC_CONTROLEUR: AppRole.CONTROLEUR,
  SUPERVISEUR_SENELEC: AppRole.SUPERVISEUR,
  CONTROLEUR_SENELEC: AppRole.CONTROLEUR,
  CLIENT_LSE_SUPERVISEUR: AppRole.SUPERVISEUR,
  CLIENT_LSE_TECHNIQUE: AppRole.CONTROLEUR,
  TECHNICIEN_LSE: AppRole.CONTROLEUR,
  SUPERVISEUR_LSE: AppRole.SUPERVISEUR,
  SOUS_TRAITANT_DIRECTEUR: AppRole.DG,
  SOUS_TRAITANT_EMPLOYE: AppRole.EMPLOYE,
  DIRECTEUR_SOUS_TRAITANT: AppRole.DG,
  EMPLOYE_SOUS_TRAITANT: AppRole.EMPLOYE,
  'DIRECTION GÉNÉRALE': AppRole.DG,
  'CHEF DE PROJET': AppRole.CHEF_PROJET,
  'CHEF DE CHANTIER': AppRole.DIRECTION,
  'DG': AppRole.DG,
  'ADMIN': AppRole.ADMIN,
};

/**
 * 👤 Interface Utilisateur Enterprise (ABAC-Ready)
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

export interface PolicyResponse {
  allowed: boolean;
  reason?: 'MISSING_PERMISSION' | 'TENANT_MISMATCH' | 'REGION_MISMATCH' | 'PROJECT_MISMATCH' | 'STATUS_LOCKED' | 'NOT_OWNER' | 'EXPIRED';
  message?: string;
}

// 3️⃣ REGISTRY DES PERMISSIONS
export const PERMISSIONS = {
  MISSIONS_READ: 'missions.read',
  MISSIONS_CREATE: 'missions.create',
  MISSIONS_UPDATE: 'missions.update',
  MISSIONS_DELETE: 'missions.delete',
  MISSIONS_VALIDATE: 'missions.validate',
  MISSIONS_APPROVE: 'missions.approve',
  MISSIONS_PLANNING: 'missions.planning',
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

// 4️⃣ GROUPES DE PERMISSIONS
export const PERMISSION_GROUPS = {
  SOCLE_COMMUN: [PERMISSIONS.UI_MAP, PERMISSIONS.UI_CHAT, PERMISSIONS.UI_ALERTS, PERMISSIONS.UI_TRAINING],
  MISSION_VIEWER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.UI_PROJECTS, PERMISSIONS.TERRAIN_READ],
  MISSION_MANAGER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.MISSIONS_CREATE, PERMISSIONS.MISSIONS_UPDATE, PERMISSIONS.MISSIONS_PLANNING],
  FINANCE_ADMIN: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.FINANCE_PAYMENTS, PERMISSIONS.FINANCE_EXPORT],
  SUPERVISOR_PACK: [PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.DOCS_PV, PERMISSIONS.SYSTEM_AUDIT],
};

// 5️⃣ MATRICE DES RÔLES
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [AppRole.PLATFORM_ADMIN]: Object.values(PERMISSIONS).filter(p => p.includes('.')),
  [AppRole.ADMIN]: Object.values(PERMISSIONS).filter(p => p.includes('.')),
  [AppRole.DG]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, ...PERMISSION_GROUPS.FINANCE_ADMIN, ...PERMISSION_GROUPS.SUPERVISOR_PACK, PERMISSIONS.MISSIONS_APPROVE, PERMISSIONS.IA_USE, PERMISSIONS.IA_METRICS, PERMISSIONS.IA_SIMULATION, PERMISSIONS.UI_DASHBOARD, PERMISSIONS.SYSTEM_EXPORT, PERMISSIONS.SYSTEM_MESSAGES, PERMISSIONS.SYSTEM_SYNC, PERMISSIONS.UI_TEAMS, PERMISSIONS.DOCS_CONFIDENTIAL],
  [AppRole.CHEF_PROJET]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, PERMISSIONS.TERRAIN_READ, PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.UI_TEAMS, PERMISSIONS.IA_USE],
  [AppRole.DIRECTION]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.IA_USE],
  [AppRole.COMPTABLE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, ...PERMISSION_GROUPS.FINANCE_ADMIN, PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.SYSTEM_EXPORT],
  [AppRole.PATRIMOINE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.TERRAIN_MENAGES, PERMISSIONS.LOGISTIQUE_MANAGE, PERMISSIONS.UI_TEAMS],
  [AppRole.EMPLOYE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER],
  [AppRole.SUPERVISEUR]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.SYSTEM_EXPORT],
  [AppRole.CONTROLEUR]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.TERRAIN_REJECT],
};

// 6️⃣ PONT DE MIGRATION & REVERSE MAPPING
export const LEGACY_MAPPING: Record<string, string> = {
  'voir_missions': PERMISSIONS.MISSIONS_READ, 'creer_mission': PERMISSIONS.MISSIONS_CREATE, 'modifier_mission': PERMISSIONS.MISSIONS_UPDATE, 'valider_mission': PERMISSIONS.MISSIONS_VALIDATE, 'approuver_mission': PERMISSIONS.MISSIONS_APPROVE, 'voir_finances': PERMISSIONS.FINANCE_READ, 'voir_paiements': PERMISSIONS.FINANCE_PAYMENTS, 'voir_carte': PERMISSIONS.UI_MAP, 'acces_chat': PERMISSIONS.UI_CHAT, 'voir_alertes': PERMISSIONS.UI_ALERTS, 'voir_formations': PERMISSIONS.UI_TRAINING, 'voir_projets': PERMISSIONS.UI_PROJECTS, 'voir_equipes': PERMISSIONS.UI_TEAMS, 'utiliser_ia': PERMISSIONS.IA_USE,
};
const REVERSE_LEGACY_MAPPING: Record<string, string> = Object.entries(LEGACY_MAPPING).reduce((acc, [key, val]) => { acc[val] = key; return acc; }, {} as Record<string, string>);

// 7️⃣ HELPERS & POLICY ENGINE
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(AppRole).includes(upper as any)) return upper as UserRole;
  return ROLE_ALIASES[upper] || null;
};

export const isPlatformAdmin = (user: AuthUser): boolean => user?.isPlatformAdmin === true || normalizeRole(user?.role) === AppRole.PLATFORM_ADMIN;

export const hasPermission = (user: AuthUser, permission: string | string[]): boolean => {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  const nRole = normalizeRole(user.role);
  const userPerms = new Set(user.permissions || []);
  if (userPerms.size === 0 && nRole) (ROLE_PERMISSIONS[nRole] || []).forEach(p => userPerms.add(p));
  const check = (p: string) => userPerms.has(p) || (REVERSE_LEGACY_MAPPING[p] && userPerms.has(REVERSE_LEGACY_MAPPING[p])) || (LEGACY_MAPPING[p] && userPerms.has(LEGACY_MAPPING[p]));
  return Array.isArray(permission) ? permission.some(p => check(p)) : check(permission);
};

export const hasRegionAccess = (user: AuthUser, regionId?: string) => !regionId || !user.scopes?.regions?.length || user.scopes.regions.includes(regionId);
export const hasProjectAccess = (user: AuthUser, projectId?: string) => !projectId || !user.scopes?.projects?.length || user.scopes.projects.includes(projectId);

export const canViewMission = (user: AuthUser, mission: any): PolicyResponse => {
  if (!hasPermission(user, PERMISSIONS.MISSIONS_READ)) return { allowed: false, reason: 'MISSING_PERMISSION', message: 'Droit de lecture manquant.' };
  if (isPlatformAdmin(user)) return { allowed: true };
  if (user.tenantId !== mission.tenantId) return { allowed: false, reason: 'TENANT_MISMATCH', message: 'Accès restreint à votre organisation.' };
  if (!hasRegionAccess(user, mission.regionId)) return { allowed: false, reason: 'REGION_MISMATCH', message: 'Mission hors de votre zone géographique.' };
  if (!hasProjectAccess(user, mission.projectId)) return { allowed: false, reason: 'PROJECT_MISMATCH', message: 'Mission hors de votre périmètre projet.' };
  return { allowed: true };
};

export const canEditMission = (user: AuthUser, mission: any): PolicyResponse => {
  const viewCheck = canViewMission(user, mission);
  if (!viewCheck.allowed) return viewCheck;
  if (!hasPermission(user, PERMISSIONS.MISSIONS_UPDATE)) return { allowed: false, reason: 'MISSING_PERMISSION' };
  if (mission.status === 'approved' || mission.status === 'validated') return { allowed: false, reason: 'STATUS_LOCKED', message: 'Mission verrouillée après approbation.' };
  return { allowed: true };
};

// 🔟 LABELS & ALIASES
export const ROLES = AppRole;
export const isMasterAdmin = isPlatformAdmin;
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
  [PERMISSIONS.FINANCE_EXPORT]: 'Exports de Données',
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
