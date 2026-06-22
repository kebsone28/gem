import logger from '../utils/logger.js';
import { ROLE_PERMISSIONS } from '../core/config/permissions.js';
import { routePermissionSatisfied } from '../core/config/permissionNormalization.js';
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
        if (req.user.role === 'ADMIN_PROQUELEC' || req.user.role === 'ADMIN' || req.user.role === 'DG_PROQUELEC') {
            return next();
        }

        const roleUtilisateur = req.user.role;
        const userPerms = req.user.permissions && Array.isArray(req.user.permissions) ? req.user.permissions : [];

        const ok = routePermissionSatisfied(userPerms, roleUtilisateur, permission, ROLE_PERMISSIONS);

        if (!ok) {
            const permissionsAutorisees = ROLE_PERMISSIONS[roleUtilisateur] || [];
            logger.warn(`[SECURITE] Accès refusé : ${req.user.email} (${roleUtilisateur}) | Requiert: ${permission} | Perms du rôle: ${JSON.stringify(permissionsAutorisees)} | Perms de l'user: ${JSON.stringify(userPerms)}`);
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
 * Middleware ABAC : Vérifie si un Chef d'Équipe ou Chef de Projet est assigné au projet
 * [FIX M-3] Étendu aux CHEF_PROJET pour éviter les fuites de données cross-projet
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

        // Seuls les CHEF_EQUIPE et CHEF_PROJET sont soumis à cette vérification
        const restrictedRoles = ['CHEF_EQUIPE', 'CHEF_PROJET'];
        if (!restrictedRoles.includes(user.role)) {
            return next();
        }

        try {
            // 1. Extraire l'ID du projet selon le contexte de la requête
            let projectIdCible = null;

            if (typeRessource === 'projet') {
                projectIdCible = req.params.id || req.body.id;
            } else if (req.body.projectId) {
                projectIdCible = req.body.projectId;
            } else if (req.query.projectId) {
                projectIdCible = req.query.projectId;
            } else if (req.projectId) {
                projectIdCible = req.projectId;
            }

            // Sans ID projet cible, pas de restriction possible — laisser passer
            if (!projectIdCible) {
                return next();
            }

            if (user.role === 'CHEF_EQUIPE') {
                // 2a. Pour CHEF_EQUIPE : vérifier via l'équipe assignée
                const equipe = await prisma.team.findUnique({
                    where: { leaderId: user.id }
                });

                if (!equipe || !equipe.projectId) {
                    return res.status(403).json({
                        error: 'Accès interdit : Vous n\'êtes assigné à aucun projet actif.'
                    });
                }

                if (equipe.projectId !== projectIdCible) {
                    logger.warn(`[ABAC] Refus : Chef Equipe ${user.email} tente d'agir sur le projet ${projectIdCible} (assigné à ${equipe.projectId})`);
                    return res.status(403).json({
                        error: 'Accès interdit : Vous ne pouvez modifier que les ressources de votre projet assigné.'
                    });
                }

                req.assignedProjectId = equipe.projectId;

            } else if (user.role === 'CHEF_PROJET') {
                // 2b. Pour CHEF_PROJET : vérifier via la config du projet (assignedUsers)
                const project = await prisma.project.findFirst({
                    where: { id: projectIdCible, organizationId: user.organizationId, deletedAt: null },
                    select: { id: true, config: true }
                });

                if (!project) {
                    return res.status(404).json({ error: 'Projet introuvable.' });
                }

                const assignedUsers = (project.config || {}).assignedUsers || [];
                const isAssigned = assignedUsers.includes(user.id) || assignedUsers.includes(user.email);

                if (!isAssigned) {
                    logger.warn(`[ABAC] Refus : Chef Projet ${user.email} tente d'agir sur le projet ${projectIdCible} (non assigné)`);
                    return res.status(403).json({
                        error: 'Accès interdit : Vous ne pouvez modifier que les projets auxquels vous êtes assigné.'
                    });
                }

                req.assignedProjectId = project.id;
            }

            next();
        } catch (error) {
            logger.error('[ABAC ERROR]', error);
            res.status(500).json({ error: 'Erreur lors de la vérification des assignations.' });
        }
    };
};

/**
 * Middleware d'Isolation de Projet
 * Vérifie que le projet demandé (via header X-Project-Id ou paramètre) existe
 * et appartient à l'organisation de l'utilisateur.
 * Injecte req.projectId pour usage dans les contrôleurs.
 */
export const verifierProjet = async (req, res, next) => {
    const projectId = req.headers['x-project-id'] || req.params.projectId || req.query.projectId;

    // Si pas d'ID projet fourni, on laisse passer au plus vite (évite le crash si auth non fait)
    if (!projectId) {
        return next();
    }

    // 🛡️ Guard : req.user peut être undefined si le middleware auth n'a pas encore tourné
    if (!req.user) {
        // S'il y a un projectId, on DOIT vérifier les permissions, donc l'auth est requise.
        return res.status(401).json({ error: 'Vérification projet: Non authentifié' });
    }

    const { organizationId, role } = req.user;

    try {
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
                deletedAt: null
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Projet introuvable ou accès non autorisé.' });
        }

        // Vérification d'assignation pour les rôles restreints
        // [BYPASS] Les Admins, DG et les sessions de simulation (God Mode) voient tout
        const isAdmin = role === 'ADMIN_PROQUELEC' || role === 'ADMIN' || role === 'DG_PROQUELEC';
        const isSimulation = req.user.isSimulation === true;

        if (!isAdmin && !isSimulation) {
            const assignedUsers = (project.config || {}).assignedUsers || [];
            if (!assignedUsers.includes(req.user.id) && !assignedUsers.includes(req.user.email)) {
                return res.status(403).json({ error: 'Accès interdit : Vous n\'êtes pas assigné à ce projet.' });
            }
        }

        req.projectId = projectId;
        req.project = project; // Injecte l'objet projet complet (utile pour la config/modules)
        next();
    } catch (error) {
        logger.error('[PROJECT ISOLATION ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur lors de la vérification du contexte projet.',
            details: error.message,
            stack: error.stack
        });
    }
};

/**
 * Middleware pour vérifier si un module spécifique est activé.
 * Vérifie d'abord la configuration GLOBALE (SystemConfig en DB),
 * puis la configuration du projet (enabledModules).
 * @param {string} moduleName - Le nom du module (ex: 'logistique', 'planning')
 */
export const verifierModule = (moduleName) => {
    return async (req, res, next) => {
        // Les admins ont accès à tout par défaut pour la maintenance
        const isAdmin = req.user?.role === 'ADMIN_PROQUELEC' || req.user?.role === 'ADMIN' || req.user?.role === 'DG_PROQUELEC';
        if (isAdmin) return next();

        try {
            // 1. Vérification GLOBALE — Source de vérité SaaS
            const globalConfigRow = await prisma.systemConfig.findUnique({
                where: { key: 'global_modules_config' },
            });

            if (globalConfigRow?.value) {
                const globalConfig = globalConfigRow.value;
                // Chercher le module par son ID exact ou via un mapping de noms courants
                const moduleEntry = globalConfig[moduleName] ||
                    Object.values(globalConfig).find(m => m.id === moduleName);

                if (moduleEntry && moduleEntry.enabled === false) {
                    return res.status(403).json({
                        error: `Accès interdit : Le module '${moduleName}' est désactivé globalement par l'administrateur.`,
                        module: moduleName,
                        scope: 'global'
                    });
                }
            }

            // 2. Vérification PROJET — Si un projet est injecté par verifierProjet
            if (req.project) {
                const enabledModules = req.project.config?.enabledModules || [];
                if (enabledModules.length > 0 && !enabledModules.includes(moduleName)) {
                    return res.status(403).json({
                        error: `Accès interdit : Le module '${moduleName}' n'est pas activé pour ce projet.`,
                        module: moduleName,
                        scope: 'project'
                    });
                }
            } else {
                // 🛡️ [SECURITY sec_005] Fail-closed: Certains modules EXIGENT un contexte projet
                const projectScopedModules = ['mission', 'logistics', 'planning', 'finance', 'pv', 'household'];
                if (projectScopedModules.includes(moduleName)) {
                    // Si on arrive ici, verifierProjet n'a pas trouvé d'ID projet valide
                    return res.status(400).json({
                        error: `Le module '${moduleName}' nécessite un contexte projet (Header 'x-project-id' manquant ou invalide).`,
                        code: 'PROJECT_CONTEXT_REQUIRED'
                    });
                }
            }

            next();
        } catch (error) {
            logger.error('[verifierModule] Erreur critique lors de la vérification du module:', error);
            // 🛡️ FAIL-CLOSED : En cas d'erreur DB, on bloque l'accès par sécurité (503 Service Unavailable)
            return res.status(503).json({ 
                error: 'Service temporairement indisponible (Vérification de module)',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

export default { verifierPermission, verifierOrganisation, verifierAssignation, verifierProjet, verifierModule };
