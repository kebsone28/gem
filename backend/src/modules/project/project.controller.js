import bcrypt from 'bcryptjs';
import fs from 'fs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { socketService } from '../../services/socket.service.js';
import { recalculateProjectGrappes } from '../../services/project_config.service.js';
import { exec } from 'child_process';
import path from 'path';
import {
    DEFAULT_WANEKOO_DEPLOY_PATH,
    buildWanekooDeployCommand,
} from '../../core/config/serverDeploy.config.js';

const DONE_STATUSES = new Set(['completed', 'Terminé', 'Réception: Validée', 'Conforme']);

const isCompletedStatus = (status) => DONE_STATUSES.has(status);

// @desc    Get all projects for an organization
// @route   GET /api/projects
export const getProjects = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const projects = await prisma.project.findMany({
            where: {
                organizationId,
                deletedAt: null
            },
            include: {
                updatedBy: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: { zones: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        res.json({ projects });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Server error while fetching projects' });
    }
};

// @desc    Get single project
// @route   GET /api/projects/:id
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const project = await prisma.project.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null
            },
            include: {
                updatedBy: {
                    select: {
                        name: true
                    }
                },
                zones: {
                    where: { deletedAt: null }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Server error while fetching project' });
    }
};

// @desc    Create new project
// @route   POST /api/projects
export const createProject = async (req, res) => {
    try {
        const { id, name, budget, duration, totalHouses, config } = req.body;
        const { organizationId, id: userId } = req.user;

        // Check for duplicate name
        const existing = await prisma.project.findFirst({
            where: { organizationId, name, deletedAt: null }
        });

        if (existing) {
            return res.status(400).json({ error: 'Un projet avec ce nom existe déjà.' });
        }

        const project = await prisma.project.create({
            data: {
                id: id || undefined, // Use client-provided ID or let Prisma generate one
                name,
                status: 'active',
                budget: budget || 0,
                duration: duration || 12,
                totalHouses: totalHouses || 0,
                config: config || {},
                organizationId,
                updatedById: userId
            }
        });

        // Audit Log
        await tracerAction({
            userId,
            organizationId,
            action: 'CREATION_PROJET',
            resource: 'Projet',
            resourceId: project.id,
            details: { name: project.name },
            req
        });

        res.status(201).json(project);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Server error while creating project' });
    }
};

// @desc    Update project
// @route   PATCH /api/projects/:id
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, budget, duration, totalHouses, config } = req.body;
        const { organizationId, id: userId } = req.user;

        const project = await prisma.project.findFirst({
            where: { id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        fs.appendFileSync('debug-trace.log', `[${new Date().toISOString()}] BEFORE prisma update id=${id} BODY=${JSON.stringify(req.body)}\n`);
        const updatedProject = await prisma.project.update({

            where: { id },
            data: {
                name,
                status,
                budget,
                duration,
                totalHouses,
                config,
                updatedById: userId,
                version: project.version + 1
            }
        });

        // Audit Log
        await tracerAction({
            userId,
            organizationId,
            action: 'MODIFICATION_PROJET',
            resource: 'Projet',
            resourceId: id,
            details: {
                old: { name: project.name, status: project.status },
                new: { name, status }
            },
            req
        });

        // 🟢 NEW: Emit websocket event to notify all clients
        try {
            socketService.emit('notification', {
                type: 'SYNC',
                message: `La configuration du projet a été mise à jour`,
                data: { user: userId, action: 'PROJECT_UPDATED', id }
            });
        } catch (wsError) {
             console.error('WebSocket Emit error during project update:', wsError);
        }

        res.json(updatedProject);
    } catch (error) {
        fs.appendFileSync('debug-trace.log', `[${new Date().toISOString()}] ERROR updateProject: ${error.message}\n${error.stack}\n`);
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Server error while updating project', details: error.message, stack: error.stack });
    }
};

// @desc    Delete project (Soft delete) — requires admin password confirmation
// @route   DELETE /api/projects/:id
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const { organizationId } = req.user;

        // 1. Require password in request body
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis pour supprimer un projet.' });
        }

        // 2. Fetch current user with their passwordHash
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!currentUser) {
            return res.status(403).json({ error: 'Utilisateur introuvable.' });
        }

        // 3. Verify password against DB hash
        const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
        if (!isPasswordValid) {
            return res.status(403).json({ error: 'Mot de passe incorrect. Suppression refusée.' });
        }

        // 4. Find project
        const project = await prisma.project.findFirst({
            where: { id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 5. Soft delete
        await prisma.project.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // 6. Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_PROJET',
            resource: 'Projet',
            resourceId: id,
            details: { name: project.name },
            req
        });

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error while deleting project' });
    }
};

// -------------------------------------------------------------
// BORDEREAU GENERATION (Spatial assignment on the fly)
// -------------------------------------------------------------
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

export const getProjectBordereau = async (req, res) => {
    try {
        console.log(`[BORDEREAU] Starting getProjectBordereau for projectId: ${req.params.id}`);
        const { id: projectId } = req.params;
        const { organizationId } = req.user;

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
                deletedAt: null
            },
            select: { id: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 1. Fetch statistics by Grappe in ONE query using groupBy
        console.time('[BORDEREAU] Stats aggregation');
        const grappeStats = await prisma.household.groupBy({
            by: ['grappeId', 'status'],
            where: {
                organizationId,
                zone: { projectId },
                deletedAt: null
            },
            _count: true
        });

        // Structure stats for easy access: grappeId -> { total, done }
        const statsMap = {};
        grappeStats.forEach(gs => {
            const gid = gs.grappeId || 'unclassified';
            if (!statsMap[gid]) statsMap[gid] = { total: 0, done: 0 };
            statsMap[gid].total += gs._count;
            if (isCompletedStatus(gs.status)) {
                statsMap[gid].done += gs._count;
            }
        });
        console.timeEnd('[BORDEREAU] Stats aggregation');

        // 2. Fetch Regions and Grappes (metadata only)
        const regions = await prisma.region.findMany({
            include: {
                grappes: {
                    where: { organizationId },
                    select: { id: true, name: true }
                }
            }
        });

        // 3. Fetch all teams for this project
        const teams = await prisma.team.findMany({
            where: { organizationId, projectId, deletedAt: null },
            select: { id: true, name: true, tradeKey: true, role: true, grappeId: true }
        });

        const mappedTeams = teams.map(t => {
            let type = t.tradeKey || t.role || '';
            const tL = type.toLowerCase();
            if (tL.includes('macon') || tL.includes('maçon')) type = 'Maçonnerie';
            if (tL.includes('reseau') || tL.includes('réseau')) type = 'Réseau';
            if (tL.includes('interieur') || tL.includes('installation')) type = 'Installation intérieure';
            if (tL.includes('controle') || tL.includes('contrôle')) type = 'Contrôle & Validation';
            return { id: t.id, name: t.name, type, grappeId: t.grappeId };
        });

        // 4. Build enriched structure
        const enrichedGrappes = [];
        for (const reg of regions) {
            for (const g of reg.grappes) {
                const stats = statsMap[g.id];
                if (!stats) continue; // Only grappes with households in THIS project

                enrichedGrappes.push({
                    id: g.id,
                    name: g.name,
                    region: reg.name,
                    householdCount: stats.total,
                    electrified: stats.done,
                    teams: mappedTeams.filter(t => t.grappeId === g.id),
                    // households: [] // REMOVED FOR LIST PERFORMANCE - Client should fetch details if needed
                });
            }
        }

        // 5. Handle Unclassified households
        const unclassifiedStats = statsMap['unclassified'];
        if (unclassifiedStats) {
            // Find which regions they belong to (more expensive but only for unclassified)
            const unclassifiedRegions = await prisma.household.groupBy({
                by: ['region'],
                where: {
                    organizationId,
                    zone: { projectId },
                    grappeId: null,
                    deletedAt: null
                },
                _count: true
            });

            for (const ur of unclassifiedRegions) {
                const regionName = ur.region || 'Sans Région';
                // Note: accurate status count per unclassified region would need another groupBy
                // but let's approximate or do one more query if really needed.
                enrichedGrappes.push({
                    id: `unclassified_${regionName}`,
                    name: `À CLASSER – ${regionName}`,
                    region: regionName,
                    householdCount: ur._count,
                    electrified: 0, // Simplified for performance
                    teams: []
                });
            }
        }

        // 6. Final Sort
        enrichedGrappes.sort((a, b) => {
            if (a.region !== b.region) return a.region.localeCompare(b.region);
            return a.name.localeCompare(b.name);
        });

        res.json({
            timestamp: new Date().toISOString(),
            grappes: enrichedGrappes
        });

    } catch (error) {
        console.error('Bordereau calculation error:', error);
        res.status(500).json({ error: 'Failed to generate bordereau', details: error.message, stack: error.stack });
    }
};

/**
 * Manually trigger grappe recalculation for a project
 */
export const triggerRecalculateGrappes = async (req, res) => {
    try {
        const { id: projectId } = req.params;
        const { organizationId } = req.user;

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
                deletedAt: null
            },
            select: { id: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await recalculateProjectGrappes(projectId, organizationId, true);
        
        res.json({
            message: 'Recalculation triggered and completed',
            result
        });
    } catch (error) {
        console.error('Manual recalculate error:', error);
        const status = error.message?.includes('not found') ? 404 : 500;
        res.status(status).json({ error: status === 404 ? 'Project not found' : 'Failed to recalculate grappes' });
    }
};

/**
 * Reset: Supprimer TOUS les ménages et grappes du projet
 * WARNING: Action destructive, ne peut pas être annulée
 */
export const resetProjectData = async (req, res) => {
    try {
        const { id: projectId } = req.params;
        const { organizationId } = req.user;

        // Vérifier que le projet existe et appartient à l'organisation
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
                deletedAt: null
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Supprimer TOUS les ménages du projet
        const deletedHouseholds = await prisma.household.deleteMany({
            where: {
                zone: {
                    projectId
                }
            }
        });

        // Supprimer TOUTES les grappes associées (optionnel, elles seront recréées si nécessaire)
        const deletedGrappes = await prisma.grappe.deleteMany({
            where: {
                households: {
                    none: {}  // Grappes sans ménages
                }
            }
        });

        console.log(`[RESET] Supprimé ${deletedHouseholds.count} ménages du projet ${projectId}`);
        console.log(`[RESET] Supprimé ${deletedGrappes.count} grappes orphelines`);

        // Tracer l'action
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'RESET_DATA',
            resource: 'Projet',
            resourceId: projectId,
            details: { name: project.name },
            req
        });

        res.json({
            message: 'Project data reset successfully',
            deleted: {
                households: deletedHouseholds.count,
                grappes: deletedGrappes.count
            }
        });

    } catch (error) {
        console.error('Project reset error:', error);
        res.status(500).json({ error: 'Failed to reset project data' });
    }
};

/**
 * 🚀 DEPLOY: Lance la mise à jour du VPS depuis l'interface
 */
export const deployServerUpdate = async (req, res) => {
    try {
        const { email, organizationId } = req.user;

        // 🛡️ SÉCURITÉ : Seul l'administrateur principal (admingem) peut déployer
        if (email !== 'admingem') {
            return res.status(403).json({ error: 'Privilèges insuffisants pour le déploiement système.' });
        }

        const projectPath = DEFAULT_WANEKOO_DEPLOY_PATH;
        const command = buildWanekooDeployCommand(projectPath);

        console.log(`[SYSTEM] Déploiement initié par ${email}`);

        // On lance en arrière-plan pour ne pas bloquer la requête HTTP
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[DEPLOY ERROR]: ${error.message}`);
                return;
            }
            console.log(`[DEPLOY SUCCESS]: ${stdout}`);
            
            // Notification via Socket.io quand c'est fini
            socketService.emit('notification', {
                type: 'SUCCESS',
                message: 'Le serveur a été mis à jour avec succès !',
                data: { action: 'DEPLOY_COMPLETED' }
            });
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'DEPLOY_SYSTEME',
            resource: 'Serveur',
            resourceId: 'PROD',
            details: { initiator: email },
            req
        });

        res.json({ 
            message: 'Déploiement lancé avec succès.', 
            details: 'L\'opération dure environ 60 secondes en arrière-plan.' 
        });

    } catch (error) {
        console.error('Deploy route error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'initialisation du déploiement' });
    }
};

/**
 * 🗄️ DB MAINTENANCE: Nettoie les enregistrements supprimés (soft deletes) et optimise la base
 */
export const dbMaintenance = async (req, res) => {
    try {
        const { email, organizationId } = req.user;

        // 🛡️ SÉCURITÉ : Seul l'administrateur principal (admingem) peut lancer la maintenance
        if (email !== 'admingem') {
            return res.status(403).json({ error: 'Privilèges insuffisants pour la maintenance de la base de données.' });
        }

        console.log(`[SYSTEM] Maintenance BD initiée par ${email}`);

        // 1. Nettoyage des Soft Deletes (Vieux de plus de 30 jours)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 2. Purge ordonnée uniquement sur les modèles réellement soft-deletés
        // Household -> Team/Mission -> Zone -> Project
        const [householdsResult, teamsResult, missionsResult] = await prisma.$transaction([
            prisma.household.deleteMany({
                where: {
                    deletedAt: { lte: thirtyDaysAgo }
                }
            }),
            prisma.team.deleteMany({
                where: {
                    deletedAt: { lte: thirtyDaysAgo }
                }
            }),
            prisma.mission.deleteMany({
                where: {
                    deletedAt: { lte: thirtyDaysAgo }
                }
            })
        ]);

        const zonesResult = await prisma.zone.deleteMany({
            where: {
                deletedAt: { lte: thirtyDaysAgo },
                households: { none: {} },
                teams: { none: {} }
            }
        });

        const projectsResult = await prisma.project.deleteMany({
            where: {
                deletedAt: { lte: thirtyDaysAgo },
                zones: { none: {} },
                teams: { none: {} },
                missions: { none: {} }
            }
        });

        const totalCleaned =
            householdsResult.count +
            teamsResult.count +
            missionsResult.count +
            zonesResult.count +
            projectsResult.count;

        // 3. Exécuter un VACUUM (Optimisation PostgreSQL) si natif
        try {
            await prisma.$executeRawUnsafe('VACUUM ANALYZE;');
            console.log('[SYSTEM] DB Vacuum Analyze successful.');
        } catch (dbErr) {
            console.warn('[SYSTEM] DB Vacuum non supporté ou ignoré:', dbErr.message);
        }

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'MAINTENANCE_DB',
            resource: 'Base de données',
            resourceId: 'PROD',
            details: { initiator: email, recordsCleaned: totalCleaned },
            req
        });

        res.json({ 
            message: 'Maintenance terminée avec succès !', 
            details: `${totalCleaned} anciens enregistrements (corbeille) purgés. Base optimisée.` 
        });

    } catch (error) {
        console.error('Database Maintenance error:', error);
        res.status(500).json({ error: 'Erreur lors de la maintenance de la base de données' });
    }
};
