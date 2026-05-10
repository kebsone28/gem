/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS, hasPermission, normalizeRole } from '../utils/permissions';
import { AppRole } from '../utils/security/types';
import { isMasterAdminEmail } from '../utils/roleUtils';

/**
 * Hook personnalisé pour gérer les permissions de manière centralisée dans le UI.
 */
export const usePermissions = () => {
  const { user } = useAuth();

  /**
   * Vérifie si l'utilisateur possède une permission spécifique.
   * @param permission - La permission à vérifier (extraite de PERMISSIONS)
   */
  const peut = (permission: string | string[]): boolean => {
    return hasPermission(user, permission);
  };

  /**
   * Logique ABAC (Attribute-Based Access Control)
   * Vérifie si l'utilisateur peut modifier une ressource spécifique.
   * @param ressource - La ressource à modifier (ex: projet, ménage)
   */
  const peutModifier = (ressource: any): boolean => {
    if (!user) return false;

    const nRole = normalizeRole(user.role);

    // Un Admin peut tout modifier
    if (nRole === AppRole.ADMIN) return true;

    // Un Chef d'Équipe ne peut modifier que ce qui appartient à son équipe
    if (nRole === AppRole.CHEF_EQUIPE && ressource.teamId === (user as any).teamId) {
      return peut(PERMISSIONS.TERRAIN_WRITE || 'terrain.write');
    }

    return false;
  };

  const nRole = normalizeRole(user?.role);
  const isAdmin = nRole === AppRole.ADMIN || isMasterAdminEmail(user?.email);
  const isChefProjet = nRole === AppRole.CHEF_PROJET;
  const isDirecteur = nRole === AppRole.DIRECTEUR;

  return {
    peut,
    peutModifier,
    PERMISSIONS,
    role: nRole,
    user,
    isAdmin,
    canEdit: isAdmin || isChefProjet,
    canManagePV: isAdmin || isChefProjet || isDirecteur,
    isChefProjet,
    isDG: isDirecteur,
  };
};
