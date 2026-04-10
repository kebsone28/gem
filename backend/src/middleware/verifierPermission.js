import { ROLE_PERMISSIONS } from '../core/config/permissions.js';
import prisma from '../core/utils/prisma.js';

/**
 * Middleware professionnel pour vérifier si un utilisateur possède la permission requise.
 * @param {string} permission - La permission à vérifier (extraite de PERMISSIONS)
 */
export const verifierPermission = (permission) => {
    return (req, res, next) => {
        // L'utilisateur doit être authentifié (req.user est injecté par le middleware authenticate)
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }

        // 1. Les Admins ont un accès total systématique
        if (req.user.role === 'ADMIN_PROQUELEC' || req.user.role === 'ADMIN') {
            return next();
        }

        // 2. Vérifier d'abord les permissions granulaires personnalisées (si présentes dans le token/user)
        if (req.user.permissions && Array.isArray(req.user.permissions) && req.user.permissions.includes(permission)) {
            return next();
        }

        // 3. Fallback sur les permissions par défaut du rôle (Legacy/Standard)
        const roleUtilisateur = req.user.role;
        const permissionsAutorisees = ROLE_PERMISSIONS[roleUtilisateur] || [];

        if (!permissionsAutorisees.includes(permission)) {
            console.warn(`[SECURITE] Accès refusé : ${req.user.email} (${roleUtilisateur}) | Requiert: ${permission} | Perms du rôle: ${JSON.stringify(permissionsAutorisees)} | Perms de l'user: ${JSON.stringify(req.user.permissions || [])}`);
            return res.status(403).json({
                error: 'Accès interdit : Vous ne possédez pas les permissions nécessaires pour cette action.',
                debug: { role: roleUtilisateur, required: permission }
            });
        }

        next();
    };
};

/**
 * Middleware de filtrage Multi-Tenant (ABAC de base)
 * Garantit qu'un utilisateur n'accède qu'aux données de son organisation.
 */
export const verifierOrganisation = (req, res, next) => {
    const organizationIdClient = req.headers['x-organization-id'];

    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    // L'utilisateur ne peut agir que sur son organisation propre
    // (Sauf s'il est un Super-Admin système, mais ici on reste sur PROQUELEC)
    if (req.user.organizationId && organizationIdClient && req.user.organizationId !== organizationIdClient) {
        return res.status(403).json({ error: 'Accès interdit : Violation de périmètre d\'organisation.' });
    }

    next();
};

/**
 * Middleware ABAC : Vérifie si un Chef d'Équipe est assigné au projet
 * @param {string} typeRessource - 'projet', 'zone', 'menage'
 */
export const verifierAssignation = (typeRessource) => {
    return async (req, res, next) => {
        const { user } = req;
        if (!user) return res.status(401).json({ error: 'Non authentifié' });

        // Les Admins et DG ont un accès total (pas de restriction ABAC d'assignation)
        if (user.role === 'ADMIN_PROQUELEC' || user.role === 'DG_PROQUELEC') {
            return next();
        }

        // Seuls les Chefs d'Équipe sont soumis à cette vérification d'assignation
        if (user.role !== 'CHEF_EQUIPE') {
            return next();
        }

        try {
            // 1. Récupérer l'équipe menée par cet utilisateur
            const equipe = await prisma.team.findUnique({
                where: { leaderId: user.id }
            });

            if (!equipe || !equipe.projectId) {
                return res.status(403).json({
                    error: 'Accès interdit : Vous n\'êtes assigné à aucun projet actif.'
                });
            }

            // 2. Extraire l'ID du projet selon le contexte de la requête
            let projectIdCible = null;

            if (typeRessource === 'projet') {
                projectIdCible = req.params.id || req.body.id;
            } else if (req.body.projectId) {
                projectIdCible = req.body.projectId;
            } else if (req.query.projectId) {
                projectIdCible = req.query.projectId;
            }

            // 3. Validation
            if (projectIdCible && equipe.projectId !== projectIdCible) {
                console.warn(`[ABAC] Refus : Chef Equipe ${user.email} tente d'agir sur le projet ${projectIdCible} alors qu'il est assigné à ${equipe.projectId}`);
                return res.status(403).json({
                    error: 'Accès interdit : Vous ne pouvez modifier que les ressources de votre projet assigné.'
                });
            }

            // On injecte l'ID du projet de l'équipe dans la requête pour filtrage automatique éventuel
            req.assignedProjectId = equipe.projectId;

            next();
        } catch (error) {
            console.error('[ABAC ERROR]', error);
            res.status(500).json({ error: 'Erreur lors de la vérification des assignations.' });
        }
    };
};

export default { verifierPermission, verifierOrganisation, verifierAssignation };
