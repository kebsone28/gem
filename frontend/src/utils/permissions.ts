
/**
 * 🔐 Moteur de Sécurité & IAM Enterprise - GEM SAAS
 * Phase 5 : Security Alerting & Proactive Monitoring
 */

import { securityAlertService } from '../services/securityAlertService';

// 🛡️ Import des types (Découplage pour éviter les dépendances circulaires)
import type { 
  AuthUser, 
  PolicyResponse, 
  PolicyReasonType, 
  UserRole, 
  TenantId, 
  SecurityResource, 
  Mission 
} from './security/types';

// 📦 Import des constantes
import { 
  PERMISSIONS, 
  AppRole, 
  PolicyReason,
  LEGACY_MAPPING, 
  ROLE_ALIASES 
} from './security/types';

// 1️⃣ PONT DE MIGRATION & REVERSE MAPPING (O(1))
const REVERSE_LEGACY_MAPPING: Record<string, string> = Object.entries(LEGACY_MAPPING).reduce((acc, [key, val]) => { acc[val] = key; return acc; }, {} as Record<string, string>);

// 2️⃣ CACHE ENGINE
const PERMS_CACHE = new Map<string, Set<string>>();

// 3️⃣ MATRICE DES RÔLES
export const PERMISSION_GROUPS = {
  SOCLE_COMMUN: [PERMISSIONS.UI_MAP, PERMISSIONS.UI_CHAT, PERMISSIONS.UI_ALERTS, PERMISSIONS.UI_TRAINING],
  MISSION_VIEWER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.UI_PROJECTS, PERMISSIONS.TERRAIN_READ],
  MISSION_MANAGER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.MISSIONS_CREATE, PERMISSIONS.MISSIONS_UPDATE, PERMISSIONS.MISSIONS_PLANNING],
  FINANCE_ADMIN: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.FINANCE_PAYMENTS, PERMISSIONS.FINANCE_EXPORT],
  SUPERVISOR_PACK: [PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.DOCS_PV, PERMISSIONS.SYSTEM_AUDIT],
};

const ALL_ATOMIC_PERMISSIONS = Object.values(PERMISSIONS).filter(p => p.includes('.'));

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

// 4️⃣ HELPERS & SECURITY ENGINE
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(AppRole).includes(upper as any)) return upper as UserRole;
  return ROLE_ALIASES[upper] || null;
};

export const sameTenant = (user: AuthUser, resource: SecurityResource): boolean => user.tenantId === resource.tenantId;
export const isPlatformAdmin = (user: AuthUser): boolean => 
  user?.isPlatformAdmin === true || 
  normalizeRole(user?.role) === AppRole.PLATFORM_ADMIN ||
  user?.email === 'admingem'; // 🔑 God Mode historique (Bypass de secours)

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

// 5️⃣ SCOPE HELPERS
export const hasRegionAccess = (user: AuthUser, regionId?: string) => !regionId || !user.scopes?.regions?.length || user.scopes.regions.includes(regionId);
export const hasProjectAccess = (user: AuthUser, projectId?: string) => !projectId || !user.scopes?.projects?.length || user.scopes.projects.includes(projectId);

// 6️⃣ AUDIT ENGINE
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

export const auditLog = (event: AuditEvent, user?: AuthUser) => {
  console.log(`[AUDIT] ${event.allowed ? '✅' : '❌'} User:${event.actorId} | Action:${event.action} | Res:${event.resourceType}:${event.resourceId} | Reason:${event.reason || 'OK'}`);
  
  if (!event.allowed && user) {
    securityAlertService.trackFailure(user, event.action, event.resourceId, event.reason);
  }
};

// 7️⃣ POLICY ENGINE
export const allow = (): PolicyResponse => ({ allowed: true });
export const deny = (reason: PolicyReasonType, message: string): PolicyResponse => ({ allowed: false, reason, message });

export const canViewMission = (user: AuthUser, mission: Mission): PolicyResponse => {
  const result = ((): PolicyResponse => {
    if (!hasPermission(user, PERMISSIONS.MISSIONS_READ)) return deny(PolicyReason.MISSING_PERMISSION, 'Droit de lecture requis.');
    if (isPlatformAdmin(user)) return allow();
    if (!sameTenant(user, mission)) return deny(PolicyReason.TENANT_MISMATCH, 'Accès restreint à votre organisation.');
    if (!hasRegionAccess(user, mission.regionId)) return deny(PolicyReason.REGION_MISMATCH, 'Zone géographique hors périmètre.');
    if (!hasProjectAccess(user, mission.projectId)) return deny(PolicyReason.PROJECT_MISMATCH, 'Projet hors périmètre.');
    return allow();
  })();

  auditLog({ actorId: user.id, tenantId: user.tenantId, action: PERMISSIONS.MISSIONS_READ, resourceType: 'mission', resourceId: mission.id, allowed: result.allowed, reason: result.reason, timestamp: new Date() }, user);
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

  auditLog({ actorId: user.id, tenantId: user.tenantId, action: PERMISSIONS.MISSIONS_UPDATE, resourceType: 'mission', resourceId: mission.id, allowed: result.allowed, reason: result.reason, timestamp: new Date() }, user);
  return result;
};

// 8️⃣ LEGACY EXPORTS
export { PERMISSIONS, AppRole as ROLES, isPlatformAdmin as isMasterAdmin };
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
