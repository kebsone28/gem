
/**
 * 🔐 Moteur de Sécurité & RBAC Enterprise - GEM SAAS
 * Architecture : Tenant-Decoupled / Namespaced RBAC / ABAC Ready
 */

// 1️⃣ RÉFÉRENTIEL DES TENANTS (ORGANISATIONS)
export const TENANTS = {
  PROQUELEC: 'proquelec',
  SENELEC: 'senelec',
  CLIENT_LSE: 'client_lse',
  GEM: 'gem', // Interne
} as const;

export type TenantId = (typeof TENANTS)[keyof typeof TENANTS];

// 2️⃣ RÉFÉRENTIEL DES RÔLES GÉNÉRIQUES (DÉCOUPLÉS)
export const AppRole = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // Super Admin GEM
  ADMIN: 'ADMIN',                 // Admin local d'entreprise
  DG: 'DG',                       // Direction Générale
  CHEF_PROJET: 'CHEF_PROJET',     // Responsable opérationnel
  DIRECTION: 'DIRECTION',         // Management intermédiaire
  COMPTABLE: 'COMPTABLE',         // Finances & Reporting
  PATRIMOINE: 'PATRIMOINE',       // Gestion actifs/logistique
  SUPERVISEUR: 'SUPERVISEUR',     // Supervision externe (Senelec/LSE)
  CONTROLEUR: 'CONTROLEUR',       // Contrôle terrain
  EMPLOYE: 'EMPLOYE',             // Utilisateur de base
} as const;

export type UserRole = (typeof AppRole)[keyof typeof AppRole];

// --- LEGACY ALIASES (Backward Compatibility) ---
export const ROLES = AppRole;

/**
 * 👤 Interface Utilisateur Authentifié (Enterprise-Grade)
 */
export interface AuthUser {
  id: string;
  email: string;
  tenantId: TenantId | string;
  role: UserRole | string;
  isPlatformAdmin?: boolean; // Remplace le check par email
  permissions?: string[];
  scopes?: {
    regions?: string[];
    projects?: string[];
    villages?: string[];
  };
}

// 3️⃣ ALIAS DE COMPATIBILITÉ (Mappe les anciens rôles vers les nouveaux génériques)
export const ROLE_ALIASES: Record<string, UserRole> = {
  // Legacy Proquelec
  PROQUELEC_ADMIN: AppRole.ADMIN,
  PROQUELEC_DG: AppRole.DG,
  PROQUELEC_CHEF_PROJET: AppRole.CHEF_PROJET,
  PROQUELEC_DIRECTION: AppRole.DIRECTION,
  PROQUELEC_COMPTABLE: AppRole.COMPTABLE,
  PROQUELEC_PATRIMOINE: AppRole.PATRIMOINE,
  PROQUELEC_EMPLOYE: AppRole.EMPLOYE,
  
  // Legacy Senelec
  SENELEC_SUPERVISEUR: AppRole.SUPERVISEUR,
  SENELEC_CONTROLEUR: AppRole.CONTROLEUR,

  // Legacy LSE
  CLIENT_LSE_SUPERVISEUR: AppRole.SUPERVISEUR,
  CLIENT_LSE_TECHNIQUE: AppRole.CONTROLEUR,
  
  // Legacy Sous-traitants
  SOUS_TRAITANT_DIRECTEUR: AppRole.DG,
  SOUS_TRAITANT_EMPLOYE: AppRole.EMPLOYE,

  // Humain
  'DIRECTION GÉNÉRALE': AppRole.DG,
  'CHEF DE PROJET': AppRole.CHEF_PROJET,
};

// 4️⃣ REGISTRY DES PERMISSIONS (NAMESPACED)
export const PERMISSIONS = {
  // --- MISSIONS ---
  MISSIONS_READ: 'missions.read',
  MISSIONS_CREATE: 'missions.create',
  MISSIONS_UPDATE: 'missions.update',
  MISSIONS_DELETE: 'missions.delete',
  MISSIONS_VALIDATE: 'missions.validate',
  MISSIONS_APPROVE: 'missions.approve',
  MISSIONS_PLANNING: 'missions.planning',
  
  // --- TERRAIN & KOBO ---
  TERRAIN_READ: 'terrain.read',
  TERRAIN_WRITE: 'terrain.write',
  TERRAIN_TERMINAL: 'terrain.terminal',
  TERRAIN_REJECT: 'terrain.reject',
  TERRAIN_ZONES: 'terrain.zones',
  TERRAIN_MENAGES: 'terrain.menages',
  
  // --- FINANCES ---
  FINANCE_READ: 'finance.read',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_PAYMENTS: 'finance.payments',
  FINANCE_EXPORT: 'finance.export',
  FINANCE_REPORTS: 'finance.reports',
  
  // --- LOGISTIQUE ---
  LOGISTIQUE_READ: 'logistique.read',
  LOGISTIQUE_MANAGE: 'logistique.manage',
  
  // --- SYSTÈME & ADMIN ---
  SYSTEM_USERS: 'system.users',
  SYSTEM_ROLES: 'system.roles',
  SYSTEM_AUDIT: 'system.audit',
  SYSTEM_SYNC: 'system.sync',
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_EXPORT: 'system.export',
  SYSTEM_MESSAGES: 'system.messages',
  
  // --- UI & COLLABORATION (SOCLE COMMUN) ---
  UI_MAP: 'ui.map',
  UI_CHAT: 'ui.chat',
  UI_ALERTS: 'ui.alerts',
  UI_TRAINING: 'ui.training',
  UI_PROJECTS: 'ui.projects',
  UI_TEAMS: 'ui.teams',
  UI_DASHBOARD: 'ui.dashboard',
  
  // --- IA & ANALYTICS ---
  IA_USE: 'ia.use',
  IA_METRICS: 'ia.metrics',
  IA_SIMULATION: 'ia.simulation',
  
  // --- DOCUMENTS ---
  DOCS_READ: 'docs.read',
  DOCS_CONFIDENTIAL: 'docs.confidential',
  DOCS_PV: 'docs.pv',
} as const;

/**
 * 🚀 ALL_PERMISSIONS : Liste propre sans doublons pour le Super Admin
 */
export const ATOMIC_PERMISSIONS = Object.values(PERMISSIONS).filter(p => p.includes('.'));

// 5️⃣ GROUPES DE PERMISSIONS (PACKS FONCTIONNELS)
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
  FINANCE_ADMIN: [
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_PAYMENTS,
    PERMISSIONS.FINANCE_EXPORT,
  ],
  SUPERVISOR_PACK: [
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.DOCS_PV,
    PERMISSIONS.SYSTEM_AUDIT,
  ],
};

// 6️⃣ MATRICE DES RÔLES (GÉNÉRIQUE & MULTI-TENANT)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [AppRole.PLATFORM_ADMIN]: ATOMIC_PERMISSIONS,

  [AppRole.ADMIN]: ATOMIC_PERMISSIONS,

  [AppRole.DG]: [
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

  [AppRole.CHEF_PROJET]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    PERMISSIONS.TERRAIN_READ,
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.UI_TEAMS,
    PERMISSIONS.IA_USE,
  ],

  [AppRole.DIRECTION]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_MANAGER,
    PERMISSIONS.MISSIONS_VALIDATE,
    PERMISSIONS.IA_USE,
  ],

  [AppRole.COMPTABLE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    ...PERMISSION_GROUPS.FINANCE_ADMIN,
    PERMISSIONS.LOGISTIQUE_READ,
    PERMISSIONS.SYSTEM_EXPORT,
  ],

  [AppRole.PATRIMOINE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
    PERMISSIONS.TERRAIN_MENAGES,
    PERMISSIONS.LOGISTIQUE_MANAGE,
    PERMISSIONS.UI_TEAMS,
  ],

  [AppRole.EMPLOYE]: [
    ...PERMISSION_GROUPS.SOCLE_COMMUN,
    ...PERMISSION_GROUPS.MISSION_VIEWER,
  ],

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

// 7️⃣ PONT DE MIGRATION & REVERSE MAPPING (OPTIMISÉ O(1))
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

// Reverse Mapping pour optimisation O(1)
export const REVERSE_LEGACY_MAPPING: Record<string, string> = Object.entries(LEGACY_MAPPING).reduce((acc, [key, val]) => {
  acc[val] = key;
  return acc;
}, {} as Record<string, string>);

// 8️⃣ HELPERS & POLICY ENGINE
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (Object.values(AppRole).includes(upper as any)) return upper as UserRole;
  return ROLE_ALIASES[upper] || null;
};

export const isPlatformAdmin = (user: AuthUser): boolean => {
  if (!user) return false;
  return user.isPlatformAdmin === true || normalizeRole(user.role) === AppRole.PLATFORM_ADMIN;
};

// --- LEGACY ALIAS ---
export const isMasterAdmin = isPlatformAdmin;

/**
 * ⚡ Moteur de vérification de permissions Tenant-Aware & ABAC-Ready
 */
export const hasPermission = (user: AuthUser, permission: string | string[]): boolean => {
  if (!user) return false;
  
  // Platform Admin Bypass
  if (isPlatformAdmin(user)) return true;

  const nRole = normalizeRole(user.role);
  const userPerms = new Set(user.permissions || []);
  
  // Résolution automatique par rôle si pas de perms granulaires
  if (userPerms.size === 0 && nRole) {
    (ROLE_PERMISSIONS[nRole] || []).forEach(p => userPerms.add(p));
  }

  const check = (p: string) => {
    // 1. Check direct (Nouveau format)
    if (userPerms.has(p)) return true;
    
    // 2. Check via Reverse Legacy (Si l'user a l'ancien nom en DB)
    const legacyKey = REVERSE_LEGACY_MAPPING[p];
    if (legacyKey && userPerms.has(legacyKey)) return true;
    
    // 3. Check via Legacy Mapping (Si l'app demande l'ancien nom)
    if (LEGACY_MAPPING[p] && userPerms.has(LEGACY_MAPPING[p])) return true;

    return false;
  };

  if (Array.isArray(permission)) {
    return permission.some(p => check(p));
  }
  return check(permission);
};

// 9️⃣ LABELS UI COMPLET
export const PERMISSION_LABELS: Record<string, string> = {
  // Administration
  [PERMISSIONS.SYSTEM_USERS]: 'Gestion des Comptes',
  [PERMISSIONS.SYSTEM_CONFIG]: 'Paramètres Système',
  [PERMISSIONS.SYSTEM_AUDIT]: 'Historique (Audit Logs)',
  [PERMISSIONS.SYSTEM_MESSAGES]: 'Diffuser Message Global',
  [PERMISSIONS.SYSTEM_EXPORT]: 'Exports Système Massifs',

  // Missions
  [PERMISSIONS.MISSIONS_READ]: 'Voir Registre Missions',
  [PERMISSIONS.MISSIONS_CREATE]: 'Créer Missions',
  [PERMISSIONS.MISSIONS_UPDATE]: 'Modifier Missions',
  [PERMISSIONS.MISSIONS_VALIDATE]: 'Validation Opérationnelle',
  [PERMISSIONS.MISSIONS_APPROVE]: 'Approbation Finale (DG)',
  [PERMISSIONS.MISSIONS_DELETE]: 'Supprimer Missions',
  [PERMISSIONS.MISSIONS_PLANNING]: 'Planning (Gantt)',

  // Équipes
  [PERMISSIONS.UI_TEAMS]: 'Voir & Gérer les Équipes',

  // Finances
  [PERMISSIONS.FINANCE_READ]: 'Tableau de bord Finances',
  [PERMISSIONS.FINANCE_MANAGE]: 'Gestion des Budgets',
  [PERMISSIONS.FINANCE_PAYMENTS]: 'Suivi des Paiements',
  [PERMISSIONS.FINANCE_EXPORT]: 'Exports de Données',
  [PERMISSIONS.FINANCE_REPORTS]: 'Rapports Financiers',

  // Terrain
  [PERMISSIONS.UI_MAP]: 'Carte Interactive',
  [PERMISSIONS.TERRAIN_ZONES]: 'Gestion Zones/Grappes',
  [PERMISSIONS.TERRAIN_MENAGES]: 'Gestion des Ménages',
  [PERMISSIONS.TERRAIN_TERMINAL]: 'Terminal Collecte Kobo',
  [PERMISSIONS.TERRAIN_REJECT]: 'Rejeter Dossier Kobo',

  // Projets
  [PERMISSIONS.UI_PROJECTS]: 'Registre des Projets',
  [PERMISSIONS.UI_DASHBOARD]: 'Personnaliser Dashboard',

  // Logistique
  [PERMISSIONS.LOGISTIQUE_READ]: 'État des Stocks',
  [PERMISSIONS.LOGISTIQUE_MANAGE]: 'Mouvements & Logistique',

  // Documents
  [PERMISSIONS.DOCS_PV]: 'Génération des PV',
  [PERMISSIONS.DOCS_CONFIDENTIAL]: 'Voir Docs Confidentiels',

  // Formations
  [PERMISSIONS.UI_TRAINING]: 'Accès Sessions Formation',

  // Communication
  [PERMISSIONS.UI_CHAT]: 'Utiliser la Messagerie',

  // Alertes
  [PERMISSIONS.UI_ALERTS]: 'Consulter les Alertes',

  // Synchro
  [PERMISSIONS.SYSTEM_SYNC]: 'Logs de Synchronisation',

  // IA
  [PERMISSIONS.IA_USE]: 'Assistant Wanekoo',
  [PERMISSIONS.IA_METRICS]: 'Consommation & Coûts IA',
  [PERMISSIONS.IA_SIMULATION]: 'Scénarios de Simulation',
};
