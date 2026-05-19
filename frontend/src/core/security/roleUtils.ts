/**
 * Utilitaires centralisés pour la normalisation des rôles.
 * POINT UNIQUE de vérité pour la logique de mapping des rôles.
 */

/**
 * Normalise un rôle brut pour le workflow d'approbation de mission.
 * Retourne 'ADMIN', 'DIRECTEUR', ou null.
 */
export const normalizeMissionApprovalRole = (rawRole?: string | null): 'ADMIN' | 'DIRECTEUR' | null => {
  const role = (rawRole || '').toUpperCase().trim();

  if (['ADMIN', 'ADMIN_GEDOS', 'ADMIN_PROQUELEC', 'PLATFORM_ADMIN'].includes(role)) {
    return 'ADMIN';
  }

  if ([
    'DIRECTEUR',
    'DIRECTEUR_GENERAL',
    'DIRECTEUR_TECHNIQUE',
    'DG_GEDOS',
    'DG',
    'DIR_GEN',
    'DIRECTION_GENERALE',
    'DIRECTION GÉNÉRALE',
    'DIRECTION GENERALE',
    'DG_PROQUELEC',
  ].includes(role)) {
    return 'DIRECTEUR';
  }

  return null;
};

/**
 * Vérifie si un rôle est de type administrateur système.
 */
export const isAdminRole = (rawRole?: string | null): boolean => {
  return normalizeMissionApprovalRole(rawRole) === 'ADMIN';
};

/**
 * Vérifie si un rôle est de type Directeur Général.
 */
export const isDirecteurRole = (rawRole?: string | null): boolean => {
  return normalizeMissionApprovalRole(rawRole) === 'DIRECTEUR';
};

/**
 * Vérifie si un email est celui du super-administrateur système.
 * Utilise la variable d'environnement VITE_SUPER_ADMIN_EMAIL si disponible.
 */
export const isMasterAdminEmail = (email?: string | null): boolean => {
  const masterEmail = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'admin_gedos').toLowerCase().trim();
  const currentEmail = (email || '').toLowerCase().trim();
  return currentEmail === masterEmail || currentEmail === 'admin_gedos' || currentEmail === 'admingedos';
};
