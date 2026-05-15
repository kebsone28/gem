/**
 * 🔐 Moteur de Sécurité & IAM Enterprise - GED OS
 * Phase 5 : Security Alerting & Proactive Monitoring
 */

import { securityAlertService } from '../services/securityAlertService';
import logger from './logger';

// 🛡️ Import des types (Découplage pour éviter les dépendances circulaires)
import type {
  AuthUser,
  PolicyResponse,
  PolicyReasonType,
  UserRole,
  SecurityResource,
  Mission,
} from './security/types';

// 📦 Import des constantes
import { PERMISSIONS, AppRole, PolicyReason, LEGACY_MAPPING, ROLE_ALIASES } from './security/types';

// 1️⃣ PONT DE MIGRATION & REVERSE MAPPING (O(1))
const REVERSE_LEGACY_MAPPING: Record<string, string> = Object.entries(LEGACY_MAPPING).reduce(
  (acc, [key, val]) => {
    acc[val] = key;
    return acc;
  },
  {} as Record<string, string>
);

// 2️⃣ CACHE ENGINE
const PERMS_CACHE = new Map<string, Set<string>>();

// 3️⃣ MATRICE DES RÔLES
export const PERMISSION_GROUPS = {
  SOCLE_COMMUN: [
    PERMISSIONS.UI_MAP,
    PERMISSIONS.UI_CHAT,
    PERMISSIONS.UI_ALERTS,
    PERMISSIONS.UI_TRAINING,
  ],
  MISSION_VIEWER: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.UI_PROJECTS, PERMISSIONS.TERRAIN_READ],
  MISSION_MANAGER: [
    PERMISSIONS.MISSIONS_READ,
    PERMISSIONS.MISSIONS_CREATE,
    PERMISSIONS.MISSIONS_UPDATE,
    PERMISSIONS.MISSIONS_PLANNING,
  ],
  FINANCE_ADMIN: [
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_PAYMENTS,
    PERMISSIONS.FINANCE_EXPORT,
  ],
  SUPERVISOR_PACK: [PERMISSIONS.MISSIONS_VALIDATE, PERMISSIONS.DOCS_PV, PERMISSIONS.SYSTEM_AUDIT],
  LOGISTIQUE_FULL_PACK: [
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.LOGISTIQUE_STOCK,
    PERMISSIONS.LOGISTIQUE_DELIVERIES,
    PERMISSIONS.LOGISTIQUE_AGENTS,
    PERMISSIONS.LOGISTIQUE_OM,
    PERMISSIONS.LOGISTIQUE_ATELIER,
    PERMISSIONS.LOGISTIQUE_DEPLOYMENT,
    PERMISSIONS.LOGISTIQUE_MANAGE,
  ],
};

const ALL_ATOMIC_PERMISSIONS = Object.values(PERMISSIONS).filter((p) => p.includes('.'));

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [AppRole.PLATFORM_ADMIN]: ALL_ATOMIC_PERMISSIONS,
  [AppRole.ADMIN]: ALL_ATOMIC_PERMISSIONS,
  [AppRole.DIRECTEUR]: [
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
    PERMISSIONS.SYSTEM_USERS,
    ...PERMISSION_GROUPS.LOGISTIQUE_FULL_PACK,
  ],
  [AppRole.CHEF_PROJET]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    PERMISSIONS.TERRAIN_READ,
    ...PERMISSION_GROUPS.LOGISTIQUE_FULL_PACK,
    PERMISSIONS.UI_TEAMS,
    PERMISSIONS.IA_USE,
  ],
  [AppRole.CHEF_EQUIPE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER],
  [AppRole.COMPTABLE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    ...PERMISSION_GROUPS.FINANCE_ADMIN,
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.LOGISTIQUE_STOCK,
    PERMISSIONS.SYSTEM_EXPORT,
  ],
  [AppRole.PATRIMOINE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.TERRAIN_MENAGES,
    ...PERMISSION_GROUPS.LOGISTIQUE_FULL_PACK,
    PERMISSIONS.UI_TEAMS,
  ],
  [AppRole.EMPLOYE]: [...PERMISSION_GROUPS.SOCLE_COMMUN, ...PERMISSION_GROUPS.MISSION_VIEWER],
  [AppRole.SUPERVISEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.SYSTEM_EXPORT,
  ],
  [AppRole.CONTROLEUR]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.TERRAIN_REJECT,
  ],
};

// 4️⃣ HELPERS & SECURITY ENGINE
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(AppRole).includes(upper as any)) return upper as UserRole;
  return ROLE_ALIASES[upper] || null;
};

export const sameTenant = (user: AuthUser, resource: SecurityResource): boolean =>
  user.tenantId === resource.tenantId;
export const isPlatformAdmin = (user: AuthUser): boolean =>
   user?.isPlatformAdmin === true ||
   normalizeRole(user?.role) === AppRole.PLATFORM_ADMIN ||
   normalizeRole(user?.role) === AppRole.ADMIN;

export const invalidatePermissionsCache = (userId?: string) => {
  if (userId) {
    // Supprime toutes les entrées commençant par l'ID utilisateur
    for (const key of PERMS_CACHE.keys()) {
      if (key.startsWith(`${userId}_`)) PERMS_CACHE.delete(key);
    }
  } else {
    PERMS_CACHE.clear();
  }
};

export const hasPermission = (user: AuthUser, permission: string | string[]): boolean => {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;

  const nRole = normalizeRole(user.role);
  const cacheKey = `${user.id}_${nRole}`;

  let userPerms = PERMS_CACHE.get(cacheKey);
  if (!userPerms) {
    const rawPerms = new Set<string>(user.permissions || []);
    if (rawPerms.size === 0 && nRole)
      (ROLE_PERMISSIONS[nRole] || []).forEach((p) => rawPerms.add(p));
    
    // Expansion récursive des dépendances
    const expandedPerms = new Set<string>();
    rawPerms.forEach(p => {
        expandedPerms.add(p);
        resolvePermissionDependencies(p).forEach(dep => expandedPerms.add(dep));
    });

    PERMS_CACHE.set(cacheKey, expandedPerms);
    userPerms = expandedPerms;
  }

  const check = (p: string): boolean => {
    if (userPerms!.has(p)) return true;
    
    // Vérification des alias legacy
    if (REVERSE_LEGACY_MAPPING[p] && userPerms!.has(REVERSE_LEGACY_MAPPING[p])) return true;
    if (LEGACY_MAPPING[p] && userPerms!.has(LEGACY_MAPPING[p])) return true;

    return false;
  };
  return Array.isArray(permission) ? permission.some((p) => check(p)) : check(permission);
};

// 5️⃣ SCOPE HELPERS
export const hasRegionAccess = (user: AuthUser, regionId?: string) =>
  !regionId || !user.scopes?.regions?.length || user.scopes.regions.includes(regionId);
export const hasProjectAccess = (user: AuthUser, projectId?: string) =>
  !projectId || !user.scopes?.projects?.length || user.scopes.projects.includes(projectId);

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
  logger.info(
    `[AUDIT] ${event.allowed ? '✅' : '❌'} User:${event.actorId} | Action:${event.action} | Res:${event.resourceType}:${event.resourceId} | Reason:${event.reason || 'OK'}`
  );

  if (!event.allowed && user) {
    securityAlertService.trackFailure(user, event.action, event.resourceId, event.reason);
  }
};

// 7️⃣ POLICY ENGINE
export const allow = (): PolicyResponse => ({ allowed: true });
export const deny = (reason: PolicyReasonType, message: string): PolicyResponse => ({
  allowed: false,
  reason,
  message,
});

export const canViewMission = (user: AuthUser, mission: Mission): PolicyResponse => {
  const result = ((): PolicyResponse => {
    if (!hasPermission(user, PERMISSIONS.MISSIONS_READ))
      return deny(PolicyReason.MISSING_PERMISSION, 'Droit de lecture requis.');
    if (isPlatformAdmin(user)) return allow();
    if (!sameTenant(user, mission))
      return deny(PolicyReason.TENANT_MISMATCH, 'Accès restreint à votre organisation.');
    if (!hasRegionAccess(user, mission.regionId))
      return deny(PolicyReason.REGION_MISMATCH, 'Zone géographique hors périmètre.');
    if (!hasProjectAccess(user, mission.projectId))
      return deny(PolicyReason.PROJECT_MISMATCH, 'Projet hors périmètre.');
    return allow();
  })();

  auditLog(
    {
      actorId: user.id,
      tenantId: user.tenantId,
      action: PERMISSIONS.MISSIONS_READ,
      resourceType: 'mission',
      resourceId: mission.id,
      allowed: result.allowed,
      reason: result.reason,
      timestamp: new Date(),
    },
    user
  );
  return result;
};

export const canEditMission = (user: AuthUser, mission: Mission): PolicyResponse => {
  const result = ((): PolicyResponse => {
    const viewCheck = canViewMission(user, mission);
    if (!viewCheck.allowed) return viewCheck;
    if (!hasPermission(user, PERMISSIONS.MISSIONS_UPDATE))
      return deny(PolicyReason.MISSING_PERMISSION, 'Droit de modification requis.');
    if (mission.status === 'approved' || mission.status === 'validated')
      return deny(PolicyReason.STATUS_LOCKED, 'Action impossible sur une mission verrouillée.');
    return allow();
  })();

  auditLog(
    {
      actorId: user.id,
      tenantId: user.tenantId,
      action: PERMISSIONS.MISSIONS_UPDATE,
      resourceType: 'mission',
      resourceId: mission.id,
      allowed: result.allowed,
      reason: result.reason,
      timestamp: new Date(),
    },
    user
  );
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
  [PERMISSIONS.UI_PROJECTS]: 'Registre des Projets',
  [PERMISSIONS.UI_DASHBOARD]: 'Personnaliser Dashboard',

  // 📈 Dashboard & Vues
  [PERMISSIONS.DASHBOARD_ADMIN]: 'Dashboard (Administration)',
  [PERMISSIONS.DASHBOARD_PROJECT]: 'Dashboard (Chef de Projet)',
  [PERMISSIONS.DASHBOARD_TEAM]: 'Dashboard (Équipes)',
  [PERMISSIONS.DASHBOARD_CLIENT]: 'Dashboard (Client/LSE)',
  [PERMISSIONS.DASHBOARD_ACCOUNTING]: 'Dashboard (Comptabilité)',
  [PERMISSIONS.DASHBOARD_ASSETS]: 'Dashboard (Patrimoine)',

  // ⚙️ Paramètres
  [PERMISSIONS.SETTINGS_CHARGES]: 'Paramètres (Charges & Ressources)',
  [PERMISSIONS.SETTINGS_KOBO]: 'Paramètres (KoboToolbox)',
  [PERMISSIONS.SETTINGS_DATA]: 'Paramètres (Base de Données)',
  [PERMISSIONS.SETTINGS_DATAHUB]: 'Paramètres (Data Hub)',
  [PERMISSIONS.SETTINGS_SYSTEM]: 'Paramètres (Déploiement & Système)',

  // 📝 Cahier des Charges
  [PERMISSIONS.CAHIER_TECHNICAL]: 'Cahier (Référentiel Technique)',
  [PERMISSIONS.CAHIER_CONTRACTS]: 'Cahier (Clauses Contractuelles)',
  [PERMISSIONS.CAHIER_STRATEGY]: 'Cahier (Stratégie Opérationnelle)',

  // 📦 Logistique Granulaire
  [PERMISSIONS.LOGISTIQUE_READ]: 'Logistique (Vue Globale)',
  [PERMISSIONS.LOGISTIQUE_STOCK]: 'Gestion des Stocks',
  [PERMISSIONS.LOGISTIQUE_DELIVERIES]: 'Suivi des Livraisons',
  [PERMISSIONS.LOGISTIQUE_AGENTS]: 'Performances Agents',
  [PERMISSIONS.LOGISTIQUE_OM]: 'Émission Ordres de Mission',
  [PERMISSIONS.LOGISTIQUE_ATELIER]: 'Atelier de Production',
  [PERMISSIONS.LOGISTIQUE_DEPLOYMENT]: 'Déploiement Terrain',
  [PERMISSIONS.LOGISTIQUE_MANAGE]: 'Logistique (Master)',
  
  // 🗺️ Terrain
  [PERMISSIONS.TERRAIN_MAP]: 'Accès Carte Interactive',
  [PERMISSIONS.TERRAIN_READ]: 'Voir Données Terrain',
  [PERMISSIONS.TERRAIN_ZONES]: 'Gestion Zones/Grappes',
  [PERMISSIONS.TERRAIN_MENAGES]: 'Gestion des Ménages',
  [PERMISSIONS.TERRAIN_TERMINAL]: 'Terminal Collecte Kobo',
  [PERMISSIONS.TERRAIN_REJECT]: 'Rejeter Dossier Kobo',

  [PERMISSIONS.DOCS_PV]: 'Génération des PV',
  [PERMISSIONS.DOCS_CONFIDENTIAL]: 'Voir Docs Confidentiels',
  [PERMISSIONS.UI_TRAINING]: 'Accès Sessions Formation',
  [PERMISSIONS.UI_CHAT]: 'Utiliser la Messagerie',
  [PERMISSIONS.UI_ALERTS]: 'Consulter les Alertes',
  [PERMISSIONS.SYSTEM_SYNC]: 'Logs de Synchronisation',
  [PERMISSIONS.IA_USE]: 'Assistant GED OS',
  [PERMISSIONS.IA_METRICS]: 'Consommation & Coûts IA',
  [PERMISSIONS.IA_SIMULATION]: 'Scénarios de Simulation',
  [PERMISSIONS.IA_CONFIG]: 'Configuration Cerveau IA',
};

// 9️⃣ GESTION DES DÉPENDANCES
// Permet de s'assurer que si un module "avancé" est activé, ses prérequis le sont aussi.
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  [PERMISSIONS.TERRAIN_MAP]: [PERMISSIONS.TERRAIN_READ],
  [PERMISSIONS.TERRAIN_ZONES]: [PERMISSIONS.TERRAIN_READ],
  [PERMISSIONS.TERRAIN_MENAGES]: [PERMISSIONS.TERRAIN_READ],
  [PERMISSIONS.TERRAIN_TERMINAL]: [PERMISSIONS.TERRAIN_READ],
  [PERMISSIONS.TERRAIN_REJECT]: [PERMISSIONS.TERRAIN_READ, PERMISSIONS.TERRAIN_MENAGES],
  
  [PERMISSIONS.LOGISTIQUE_STOCK]: [PERMISSIONS.LOGISTIQUE_READ],
  [PERMISSIONS.LOGISTIQUE_DELIVERIES]: [PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.LOGISTIQUE_STOCK],
  [PERMISSIONS.LOGISTIQUE_AGENTS]: [PERMISSIONS.LOGISTIQUE_READ],
  [PERMISSIONS.LOGISTIQUE_OM]: [PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.MISSIONS_CREATE],
  [PERMISSIONS.LOGISTIQUE_ATELIER]: [PERMISSIONS.LOGISTIQUE_READ],
  [PERMISSIONS.LOGISTIQUE_DEPLOYMENT]: [PERMISSIONS.LOGISTIQUE_READ, PERMISSIONS.TERRAIN_READ],
  
  [PERMISSIONS.FINANCE_MANAGE]: [PERMISSIONS.FINANCE_READ],
  [PERMISSIONS.FINANCE_PAYMENTS]: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE],
  [PERMISSIONS.FINANCE_EXPORT]: [PERMISSIONS.FINANCE_READ],
  
  [PERMISSIONS.MISSIONS_CREATE]: [PERMISSIONS.MISSIONS_READ],
  [PERMISSIONS.MISSIONS_UPDATE]: [PERMISSIONS.MISSIONS_READ],
  [PERMISSIONS.MISSIONS_DELETE]: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.MISSIONS_UPDATE],
  [PERMISSIONS.MISSIONS_VALIDATE]: [PERMISSIONS.MISSIONS_READ],
  [PERMISSIONS.MISSIONS_APPROVE]: [PERMISSIONS.MISSIONS_READ, PERMISSIONS.MISSIONS_VALIDATE],
};

/**
 * Résout récursivement toutes les permissions requises pour une permission donnée.
 */
export const resolvePermissionDependencies = (p: string, visited = new Set<string>()): string[] => {
  if (visited.has(p)) return [];
  visited.add(p);
  
  const deps = PERMISSION_DEPENDENCIES[p] || [];
  const allDeps = [...deps];
  
  deps.forEach(dep => {
    allDeps.push(...resolvePermissionDependencies(dep, visited));
  });
  
  return Array.from(new Set(allDeps));
};
