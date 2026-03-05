import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS, PERMISSIONS } from '../utils/permissions';

/**
 * Hook personnalisé pour gérer les permissions de manière centralisée dans le UI.
 */
export const usePermissions = () => {
    const { user } = useAuth();

    // Récupérer la liste des permissions associées au rôle de l'utilisateur
    const rolesPermissions = user ? ROLE_PERMISSIONS[user.role] || [] : [];

    /**
     * Vérifie si l'utilisateur possède une permission spécifique.
     * @param permission - La permission à vérifier (extraite de PERMISSIONS)
     */
    const peut = (permission: string): boolean => {
        return rolesPermissions.includes(permission);
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

    return {
        peut,
        peutModifier,
        PERMISSIONS,
        role: user?.role
    };
};
