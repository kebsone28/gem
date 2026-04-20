/**
 * 🔐 Moteur de Sécurité & RBAC - GEM SAAS
 * Version : High-Precision Enterprise (Audit-Refined)
 */

import type { User } from './types';

// 1️⃣ RÉFÉRENTIEL DES RÔLES (Canonical)
export const ROLES = {
  ADMIN: 'ADMIN_PROQUELEC',
  ADMIN_ALT: 'ADMINISTRATEUR',
  DG: 'DG_PROQUELEC',
  DG_ALT: 'DIRECTION GÉNÉRALE',
  CHEF_PROJET: 'CHEF_PROJET',
  CHEF_PROJET_ALT: 'CHEF DE PROJET',
  CHEF_EQUIPE: 'CHEF_EQUIPE',
  CHEF_CHANTIER: 'CHEF DE CHANTIER',
  CHEF: 'CHEF',
  COMPTABLE: 'COMPTABLE',
  DIRECTEUR: 'DIRECTEUR',
  CLIENT_LSE: 'CLIENT_LSE',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// 2️⃣ TABLE D'ALIAS (Canonicalisation)
export const ROLE_ALIASES: Record<string, UserRole> = {
  ADMIN_PROQUELEC: ROLES.ADMIN,
  ADMINISTRATEUR: ROLES.ADMIN,
  ADMIN: ROLES.ADMIN,

  DG_PROQUELEC: ROLES.DG,
  'DIRECTION GÉNÉRALE': ROLES.DG,
  DIRECTEUR: ROLES.DG,

  CHEF_PROJET: ROLES.CHEF_PROJET,
  'CHEF DE PROJET': ROLES.CHEF_PROJET,
  CP: ROLES.CHEF_PROJET,

  'CHEF DE CHANTIER': ROLES.CHEF_EQUIPE,
  CHEF_EQUIPE: ROLES.CHEF_EQUIPE,
  CHEF: ROLES.CHEF_EQUIPE,

  COMPTABLE: ROLES.COMPTABLE,
  CLIENT_LSE: ROLES.CLIENT_LSE,
};

// 3️⃣ RÉFÉRENTIEL DES PERMISSIONS
export const PERMISSIONS = {
  GERER_UTILISATEURS: 'gerer_utilisateurs',
  GERER_PARAMETRES: 'gerer_parametres',
  VOIR_DIAGNOSTIC: 'voir_diagnostic',
  VOIR_FINANCES: 'voir_finances',
  GERER_FINANCES: 'gerer_finances',
  VOIR_SIMULATION: 'voir_simulation',
  LANCER_SIMULATION: 'lancer_simulation',
  VOIR_CARTE: 'voir_carte',
  MODIFIER_CARTE: 'modifier_carte',
  CREER_PROJET: 'creer_projet',
  SUPPRIMER_PROJET: 'supprimer_projet',
  GERER_LOGISTIQUE: 'gerer_logistique',
  VOIR_RAPPORTS: 'voir_rapports',
  ACCES_TERMINAL_KOBO: 'acces_terminal_kobo',
  CREER_MISSION: 'creer_mission',
  VALIDER_MISSION: 'valider_mission',
  GERER_PV: 'gerer_pv',
};

// 4️⃣ MATRICE DE DROITS (Standard)
// @ts-expect-error - ROLE_PERMISSIONS type depends on UserRole which is dynamically loaded
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  [ROLES.DG]: [
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.GERER_FINANCES,
    PERMISSIONS.VOIR_RAPPORTS,
    PERMISSIONS.VOIR_SIMULATION,
    PERMISSIONS.CREER_MISSION,
    PERMISSIONS.VALIDER_MISSION,
    PERMISSIONS.GERER_LOGISTIQUE,
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.GERER_PV,
  ],

  [ROLES.CHEF_PROJET]: [
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.MODIFIER_CARTE,
    PERMISSIONS.CREER_PROJET,
    PERMISSIONS.GERER_LOGISTIQUE,
    PERMISSIONS.VOIR_RAPPORTS,
    PERMISSIONS.CREER_MISSION,
    PERMISSIONS.VOIR_SIMULATION,
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.GERER_FINANCES,
    PERMISSIONS.GERER_PV,
  ],

  [ROLES.COMPTABLE]: [
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.GERER_FINANCES,
    PERMISSIONS.VOIR_RAPPORTS,
    PERMISSIONS.CREER_MISSION,
    PERMISSIONS.GERER_LOGISTIQUE,
  ],

  [ROLES.CLIENT_LSE]: [PERMISSIONS.VOIR_CARTE, PERMISSIONS.VOIR_RAPPORTS],

  [ROLES.CHEF_EQUIPE]: [
    PERMISSIONS.ACCES_TERMINAL_KOBO,
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.VOIR_RAPPORTS,
  ],
};

// 5️⃣ HELPERS UI (Centralisés pour éviter la pollution des composants)

export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  return ROLE_ALIASES[role.trim().toUpperCase()] || null;
};

export const isMasterAdmin = (user: unknown): boolean => {
  if (!user) return false;
  const nRole = normalizeRole((user as Record<string, unknown>).role as string);
  return nRole === ROLES.ADMIN || (user as Record<string, unknown>).email?.valueOf() === 'admingem';
};

export const getMissionLabel = (user: unknown): string => {
  const nRole = normalizeRole((user as Record<string, unknown>)?.role as string);
  if (!nRole) return 'Missions OM';
  if (nRole === ROLES.ADMIN) return 'Registre des Missions';
  if (nRole === ROLES.DG) return 'Mes Ordres de Mission';
  return 'Missions OM';
};

/**
 * 🔐 COEUR DU MOTEUR : Vérifie une permission avec système de Blacklist
 */
export const hasPermission = (user: unknown, permission: string): boolean => {
  if (!user) return false;
  const typedUser = user as Record<string, unknown>;

  // 1️⃣ PRIORITÉ HAUTE SÉCURITÉ (Bypass Admin)
  if (isMasterAdmin(user)) return true;

  // 2️⃣ BLACKLIST STRICTE (Denied Permissions)
  // Utile pour retirer un droit spécifique même si le rôle de base le permet
  if (
    typedUser.deniedPermissions &&
    Array.isArray(typedUser.deniedPermissions) &&
    (typedUser.deniedPermissions as string[]).includes(permission)
  ) {
    return false;
  }

  // 3️⃣ OVERRIDE PERSONNALISÉ (Additifs)
  if (
    typedUser.permissions &&
    Array.isArray(typedUser.permissions) &&
    (typedUser.permissions as string[]).length > 0
  ) {
    return (typedUser.permissions as string[]).includes(permission);
  }

  // 4️⃣ DROITS PAR DÉFAUT DU RÔLE
  const nRole = normalizeRole(typedUser.role as string);
  if (!nRole) return false;
  return ROLE_PERMISSIONS[nRole]?.includes(permission) || false;
};

// Labels pour l'administration des permissions
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.VOIR_CARTE]: 'Carte Terrain',
  [PERMISSIONS.MODIFIER_CARTE]: 'Modif. Terrain',
  [PERMISSIONS.VOIR_FINANCES]: 'Accès Finances',
  [PERMISSIONS.GERER_FINANCES]: 'Gest. Financière',
  [PERMISSIONS.VOIR_RAPPORTS]: 'Rapports & Audit',
  [PERMISSIONS.CREER_MISSION]: 'Créer Missions',
  [PERMISSIONS.VALIDER_MISSION]: 'Valider Missions',
  [PERMISSIONS.GERER_LOGISTIQUE]: 'Logistique',
  [PERMISSIONS.ACCES_TERMINAL_KOBO]: 'Terminal Kobo',
  [PERMISSIONS.CREER_PROJET]: 'Créer Projets',
  [PERMISSIONS.SUPPRIMER_PROJET]: 'Supprimer Projets',
  [PERMISSIONS.GERER_PARAMETRES]: 'Paramètres Système',
  [PERMISSIONS.GERER_UTILISATEURS]: 'Gestion Utilisateurs',
  [PERMISSIONS.GERER_PV]: 'Automatisation PV',
};
