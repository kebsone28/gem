/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS, hasPermission } from '../utils/permissions';

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

    // Un Admin peut tout modifier
    if (user.role === 'ADMIN_PROQUELEC') return true;

    // Un Chef d'Équipe ne peut modifier que ce qui appartient à son équipe (simulation de logique)
    if (user.role === 'CHEF_EQUIPE' && ressource.teamId === user.teamId) {
      return peut(PERMISSIONS.MODIFIER_CARTE);
    }

    return false;
  };

  const isAdmin = user?.role === 'ADMIN_PROQUELEC' || user?.email === 'admingem';
  const isChefProjet = user?.role === 'CHEF_PROJET';
  const isDG = user?.role === 'DG_PROQUELEC';

  return {
    peut,
    peutModifier,
    PERMISSIONS,
    role: user?.role,
    user,
    isAdmin,
    canEdit: isAdmin || isChefProjet,
    canManagePV: isAdmin || isChefProjet || isDG,
    isChefProjet,
    isDG
  };
};
