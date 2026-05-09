
/**
 * 🔐 Moteur de Sécurité & IAM Enterprise - GEM SAAS
 * Phase 4 : Audit Engine & Industrialisation
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
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // Super Admin GEM (Tous tenants)
  ADMIN: 'ADMIN',                 // Admin Entreprise (Un seul tenant)
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

/**
 * 👤 Interface Utilisateur Authentifié
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

// Helpers de réponse standardisés
export const allow = (): PolicyResponse => ({ allowed: true });
export const deny = (reason: PolicyReasonType, message: string): PolicyResponse => ({
  allowed: false,
  reason,
  message,
});

// 3️⃣ REGISTRY DES PERMISSIONS (NAMESPACED)
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

// ATOMIC PERMISSIONS FILTER (Super Admin logic)
const ALL_ATOMIC_PERMISSIONS = Object.values(PERMISSIONS).filter(p => p.includes('.'));

// 4️⃣ MATRICE DES RÔLES
export const PERMISSION_GROUPS = {
  SOCLE_COMMUN: [PERMISSIONS.UI_MAP, PERMISSIONS.UI_CHAT, PERMISSIONS.UI_ALERTS, PERMISSIONS.UI_TRAINING],
  MISSION_VIEWER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.UI_PROJECTS, PERMISSIONS.TERRAIN_READ],
  MISSION_MANAGER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.MISSIONS_CREATE, PERMISSIONS.MISSIONS_UPDATE, PERMISSIONS.MISSIONS_PLANNING],
  FINANCE_ADMIN: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.FINANCE_PAYMENTS, PERMISSIONS.FINANCE_EXPORT],
  SUPERVISOR_PACK: [PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.DOCS_PV, PERMISSIONS.SYSTEM_AUDIT],
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [AppRole.PLATFORM_ADMIN]: ALL_ATOMIC_PERMISSIONS,
  [AppRole.ADMIN]: ALL_ATOMIC_PERMISSIONS,
  [AppRole.DG]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, ...PERMISSION_GROUPS.FINANCE_ADMIN, ...PERMISSION_GROUPS.SUPERVISOR_PACK, PERMISSIONS.MISSIONS_APPROVE, PERMISSIONS.IA_USE, PERMISSIONS.IA_METRICS, PERMISSIONS.IA_SIMULATION, PERMISSIONS.UI_DASHBOARD, PERMISSIONS.SYSTEM_EXPORT, PERMISSIONS.SYSTEM_MESSAGES, PERMISSIONS.SYSTEM_SYNC, PERMISSIONS.UI_TEAMS, PERMISSIONS.DOCS_CONFIDENTIAL],
  [AppRole.CHEF_PROJET]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, PERMISSIONS.TERRAIN_READ, PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.UI_TEAMS, PERMISSIONS.IA_USE],
  [AppRole.DIRECTION]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_MANAGER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.IA_USE],
  [AppRole.COMPTABLE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, ...PERMISSION_GROUPS.FINANCE_ADMIN, PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.SYSTEM_EXPORT],
  [AppRole.PATRIMOINE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.TERRAIN_MENAGES, PERMISSIONS.LOGISTIQUE_MANAGE, PERMISSIONS.UI_TEAMS],
  [AppRole.EMPLOYE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER],
  [AppRole.SUPERVISEUR]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.SYSTEM_EXPORT],
  [AppRole.CONTROLEUR]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER, PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.TERRAIN_REJECT],
};

// 5️⃣ PONT DE MIGRATION & REVERSE MAPPING (O(1))
export const LEGACY_MAPPING: Record<string, string> = {
  'voir_missions': PERMISSIONS.MISSIONS_READ, 'creer_mission': PERMISSIONS.MISSIONS_CREATE, 'modifier_mission': PERMISSIONS.MISSIONS_UPDATE, 'valider_mission': PERMISSIONS.MISSIONS_VALIDATE, 'approuver_mission': PERMISSIONS.MISSIONS_APPROVE, 'voir_finances': PERMISSIONS.FINANCE_READ, 'voir_paiements': PERMISSIONS.FINANCE_PAYMENTS, 'voir_carte': PERMISSIONS.UI_MAP, 'acces_chat': PERMISSIONS.UI_CHAT, 'voir_alertes': PERMISSIONS.UI_ALERTS, 'voir_formations': PERMISSIONS.UI_TRAINING, 'voir_projets': PERMISSIONS.UI_PROJECTS, 'voir_equipes': PERMISSIONS.UI_TEAMS, 'utiliser_ia': PERMISSIONS.IA_USE,
};

const REVERSE_LEGACY_MAPPING: Record<string, string> = Object.entries(LEGACY_MAPPING).reduce((acc, [key, val]) => { acc[val] = key; return acc; }, {} as Record<string, string>);

// 6️⃣ HELPERS & CACHE ENGINE
const PERMS_CACHE = new Map<string, Set<string>>();

export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(AppRole).includes(upper as any)) return upper as UserRole;
  const ROLE_ALIASES: any = { PROQUELEC_ADMIN: AppRole.ADMIN, PROQUELEC_DG: AppRole.DG, SENELEC_SUPERVISEUR: AppRole.SUPERVISEUR, CLIENT_LSE_SUPERVISEUR: AppRole.SUPERVISEUR };
  return ROLE_ALIASES[upper] || null;
};

export const sameTenant = (user: AuthUser, resource: SecurityResource): boolean => user.tenantId === resource.tenantId;
export const isPlatformAdmin = (user: AuthUser): boolean => user?.isPlatformAdmin === true || normalizeRole(user?.role) === AppRole.PLATFORM_ADMIN;

/**
 * ⚡ RBAC Engine (Optimisé avec Cache & Reverse Mapping)
 */
export const hasPermission = (user: AuthUser, permission: string | string[]): boolean => {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;

  const nRole = normalizeRole(user.role);
  const cacheKey = `${user.id}_${nRole}`;
  
  let userPerms = PERMS_CACHE.get(cacheKey);
  if (!userPerms) {
    userPerms = new Set(user.permissions || []);
    if (userPerms.size === 0 && nRole) (ROLE_PERMISSIONS[nRole] || []).forEach(p => userPerms.add(p));
    PERMS_CACHE.set(cacheKey, userPerms);
  }

  const check = (p: string) => userPerms!.has(p) || (REVERSE_LEGACY_MAPPING[p] && userPerms!.has(REVERSE_LEGACY_MAPPING[p])) || (LEGACY_MAPPING[p] && userPerms!.has(LEGACY_MAPPING[p]));
  return Array.isArray(permission) ? permission.some(p => check(p)) : check(permission);
};

// 7️⃣ SCOPE HELPERS
export const hasRegionAccess = (user: AuthUser, regionId?: string) => !regionId || !user.scopes?.regions?.length || user.scopes.regions.includes(regionId);
export const hasProjectAccess = (user: AuthUser, projectId?: string) => !projectId || !user.scopes?.projects?.length || user.scopes.projects.includes(projectId);

// 8️⃣ AUDIT ENGINE (IAM TRACEABILITY)
export interface AuditEvent {
  actorId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  allowed: boolean;
  reason?: PolicyReasonType;
  timestamp: Date;
}

export const auditLog = (event: AuditEvent) => {
  // Prêt pour DB/IndexedDB ou API Backend
  console.log(`[AUDIT] ${event.allowed ? '✅' : '❌'} User:${event.actorId} | Action:${event.action} | Res:${event.resourceType}:${event.resourceId} | Reason:${event.reason || 'OK'}`);
  // Ici : add to local Dexie audit store
};

// 9️⃣ POLICY ENGINE (ABAC & WORKFLOW)
export const canViewMission = (user: AuthUser, mission: Mission): PolicyResponse => {
  const result = ((): PolicyResponse => {
    if (!hasPermission(user, PERMISSIONS.MISSIONS_READ)) return deny(PolicyReason.MISSING_PERMISSION, 'Droit de lecture requis.');
    if (isPlatformAdmin(user)) return allow();
    if (!sameTenant(user, mission)) return deny(PolicyReason.TENANT_MISMATCH, 'Accès restreint à votre organisation.');
    if (!hasRegionAccess(user, mission.regionId)) return deny(PolicyReason.REGION_MISMATCH, 'Zone géographique hors périmètre.');
    if (!hasProjectAccess(user, mission.projectId)) return deny(PolicyReason.PROJECT_MISMATCH, 'Projet hors périmètre.');
    return allow();
  })();

  auditLog({ actorId: user.id, tenantId: user.tenantId, action: PERMISSIONS.MISSIONS_READ, resourceType: 'mission', resourceId: mission.id, allowed: result.allowed, reason: result.reason, timestamp: new Date() });
  return result;
};

export const canEditMission = (user: AuthUser, mission: Mission): PolicyResponse => {
  const result = ((): PolicyResponse => {
    const viewCheck = canViewMission(user, mission);
    if (!viewCheck.allowed) return viewCheck;
    if (!hasPermission(user, PERMISSIONS.MISSIONS_UPDATE)) return deny(PolicyReason.MISSING_PERMISSION, 'Droit de modification requis.');
    if (mission.status === 'approved' || mission.status === 'validated') return deny(PolicyReason.STATUS_LOCKED, 'Action impossible sur une mission verrouillée.');
    return allow();
  })();

  auditLog({ actorId: user.id, tenantId: user.tenantId, action: PERMISSIONS.MISSIONS_UPDATE, resourceType: 'mission', resourceId: mission.id, allowed: result.allowed, reason: result.reason, timestamp: new Date() });
  return result;
};

// 🔟 LEGACY & LABELS
export const ROLES = AppRole;
export const isMasterAdmin = isPlatformAdmin;
export const PERMISSION_LABELS: Record<string, string> = { [PERMISSIONS.MISSIONS_READ]: 'Voir Missions', [PERMISSIONS.FINANCE_READ]: 'Finances', [PERMISSIONS.IA_USE]: 'Assistant IA' };
