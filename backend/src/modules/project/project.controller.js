import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { tracerAction } from '../../services/audit.service.js';
import { socketService } from '../../services/socket.service.js';
import { recalculateProjectGrappes } from '../../services/project_config.service.js';
import { exec } from 'child_process';
import path from 'path';
import {
  DEFAULT_WANEKOO_DEPLOY_PATH,
  buildWanekooDeployCommand,
} from '../../core/config/serverDeploy.config.js';
import { eventBus } from '../../core/services/eventBus.service.js';
import { workflowService } from '../../core/services/workflow.service.js';
import { securityService } from '../../core/services/security.service.js';
import { getModuleMetadata } from '../../core/config/modules.js';
import { ROLES } from '../../core/config/permissions.js';
import { checkPermission } from '../../core/constants/permissions.js';
import { PROJECT_STATUS, isValidProjectTransition } from '../../core/config/businessRules.js';

const DONE_STATUSES = new Set([PROJECT_STATUS.COMPLETED, 'Terminé', 'Réception: Validée', 'Conforme']);

const isCompletedStatus = (status) => DONE_STATUSES.has(status);

// @desc    Get all projects for an organization (paginated)
// @route   GET /api/projects
export const getProjects = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      deletedAt: null,
    };

    const [rawProjects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          updatedBy: {
            select: { name: true, email: true },
          },
          _count: {
            select: { zones: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    const { email, id: userId, role: userRole } = req.user;

    const isGlobalAdmin = userRole === ROLES.ADMIN ||
                         userRole === ROLES.DIRECTEUR ||
                         userRole === ROLES.ADMIN_ALT ||
                         userRole === 'ADMIN_PROQUELEC' ||
                         userRole === 'DG_PROQUELEC';

    let projects = rawProjects.map(p => {
      try {
        const config = p.config || {};
        return {
          ...p,
          assignedUsers: (config && typeof config === 'object' ? config.assignedUsers : []) || []
        };
      } catch (err) {
        logger.error('Error mapping project:', p.id, err);
        return p;
      }
    });

    if (!isGlobalAdmin) {
      projects = projects.filter(p =>
        (p.assignedUsers || []).includes(userId) ||
        (p.assignedUsers || []).includes(email)
      );
    }

    res.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des projets' });
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
        deletedAt: null,
      },
      include: {
        updatedBy: {
          select: {
            name: true,
          },
        },
        zones: {
          where: { deletedAt: null },
        },
        projectModules: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const enrichedProject = {
      ...project,
      assignedUsers: (project.config || {}).assignedUsers || []
    };

    res.json(enrichedProject);
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: 'Server error while fetching project' });
  }
};

// @desc    Create new project
// @route   POST /api/projects
export const createProject = async (req, res) => {
  try {
    const { id, name, budget, duration, totalHouses, config } = req.body;
    const { organizationId, id: userId } = req.user;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du projet est requis.' });
    }

    if (!req.body.client || typeof req.body.client !== 'string' || !req.body.client.trim()) {
      return res.status(400).json({ error: 'Le champ client est requis.' });
    }

    const safeName = name.trim();
    const safeClient = req.body.client.trim();

    // Check for duplicate name
    const existing = await prisma.project.findFirst({
      where: { organizationId, name: safeName, deletedAt: null },
    });

    if (existing) {
      return res.status(400).json({ error: 'Un projet avec ce nom existe déjà.' });
    }

    // 🚀 CRÉATION ROBUSTE (SERVER-SIDE INITIALIZATION)
    const { enabledModules = [], customFields = [], sector = 'elec_bt' } = config || {};

    const project = await prisma.$transaction(async (tx) => {
      logger.info('[DEBUG] Creating base project...');
      // 1. Créer le projet de base
      const newProject = await tx.project.create({
        data: {
          id: id || undefined,
          name: safeName,
          status: PROJECT_STATUS.ACTIVE,
          budget: budget || 0,
          duration: duration || 12,
          totalHouses: totalHouses || 0,
          templateKey: sector,
          config: {
            ...config,
            client: safeClient,
            assignedUsers: Array.isArray(req.body.assignedUsers) && req.body.assignedUsers.length > 0
              ? req.body.assignedUsers
              : [userId],
          },
          organizationId,
          updatedById: userId,
        },
      });

      logger.info('[DEBUG] Base project created:', newProject.id);

      // 2. Instancier RÉELLEMENT les modules en base de données (Anti-simulation)
      if (enabledModules.length > 0) {
        logger.info('[DEBUG] Instantiating modules:', enabledModules);
        const modulePromises = enabledModules.map(moduleKey => {
          const meta = getModuleMetadata(moduleKey);
          return tx.projectModule.create({
            data: {
              projectId: newProject.id,
              key: moduleKey,
              name: meta.name,
              enabled: true,
              config: {
                initializedAt: new Date(),
                sector: sector,
                customFields: moduleKey === 'terrain' ? customFields : []
              }
            }
          });
        });
        await Promise.all(modulePromises);
      }

      // 3. Initialiser les Workflows par défaut (Phase 3 Engine)
      await workflowService.seedDefaultWorkflow(newProject.id, sector, organizationId, tx);

      // 4. Initialiser la Gouvernance (Phase 3.5 Security Engine)
      await securityService.seedDefaultPolicies(organizationId, tx);

      return newProject;
    });

    // 📡 EVENT-DRIVEN ARCHITECTURE (PHASE 3)
    await eventBus.publish('PROJECT_CREATED', {
      projectId: project.id,
      organizationId,
      userId,
      resource: 'Projet',
      resourceId: project.id,
      data: { 
        name: project.name, 
        modulesInitialises: enabledModules.length,
        secteur: sector 
      },
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
    });

    res.status(201).json(project);
  } catch (error) {
    logger.error('Create project error:', error);
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
      where: { id, organizationId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    if (status && status !== project.status) {
      if (!isValidProjectTransition(project.status, status)) {
        return res.status(400).json({
          error: `Transition de statut invalide: "${project.status}" → "${status}".`
        });
      }
    }

    // ── Calcul du nouveau config (merge profond) ──────────────────────────
    const newConfig = config !== undefined ? {
      ...(project.config || {}),
      ...config,
      assignedUsers: req.body.assignedUsers !== undefined
        ? req.body.assignedUsers
        : (project.config?.assignedUsers || [])
    } : project.config;

    // ── Transaction atomique : mise à jour projet + synchronisation modules ──
    const updatedProject = await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le projet
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(status !== undefined && { status }),
          ...(budget !== undefined && { budget }),
          ...(duration !== undefined && { duration }),
          ...(totalHouses !== undefined && { totalHouses }),
          config: newConfig,
          updatedById: userId,
          version: project.version + 1,
        },
      });

      // 2. [FIX] Synchroniser la table ProjectModule si enabledModules est fourni
      if (config?.enabledModules !== undefined) {
        const enabledKeys = Array.isArray(config.enabledModules) ? config.enabledModules : [];

        // Récupérer les modules existants
        const existingModules = await tx.projectModule.findMany({
          where: { projectId: id },
        });
        const existingKeys = new Set(existingModules.map(m => m.key));

        // Upsert les modules à activer
        for (const moduleKey of enabledKeys) {
          if (existingKeys.has(moduleKey)) {
            // Réactiver si désactivé
            await tx.projectModule.update({
              where: { projectId_key: { projectId: id, key: moduleKey } },
              data: { enabled: true },
            });
          } else {
            // Créer le nouveau module
            const meta = getModuleMetadata(moduleKey);
            await tx.projectModule.create({
              data: {
                projectId: id,
                key: moduleKey,
                name: meta.name,
                enabled: true,
                config: { activatedAt: new Date(), sector: project.templateKey },
              },
            });
          }
        }

        // Désactiver les modules retirés (soft-disable, pas de suppression)
        const enabledSet = new Set(enabledKeys);
        for (const existing of existingModules) {
          if (!enabledSet.has(existing.key) && existing.enabled) {
            await tx.projectModule.update({
              where: { projectId_key: { projectId: id, key: existing.key } },
              data: { enabled: false },
            });
          }
        }

        logger.info(`[updateProject] Modules synchronisés pour ${id}: activés=[${enabledKeys.join(',')}]`);
      }

      return updated;
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
        new: { name, status },
        modulesUpdated: config?.enabledModules !== undefined,
      },
      req,
    });

    // Notifier les clients via WebSocket
    try {
      socketService.emit('notification', {
        type: 'SYNC',
        message: `La configuration du projet a été mise à jour`,
        data: { user: userId, action: 'PROJECT_UPDATED', id },
      });
    } catch (wsError) {
      logger.error('WebSocket Emit error during project update:', wsError);
    }

    res.json(updatedProject);
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({ error: 'Server error while updating project' });
  }
};

// @desc    Assign user to multiple projects atomically with validation & optimization
// @route   POST /api/projects/assign-user
export const assignUserToProjects = async (req, res) => {
  try {
    const { userId, projectIds } = req.body;
    const { organizationId, id: adminId } = req.user;

    // 1️⃣ VALIDATION: Input validation
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }
    if (!Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'projectIds doit être un tableau' });
    }
    if (projectIds.length === 0) {
      return res.status(400).json({ error: 'Veuillez sélectionner au moins un projet' });
    }

    // 2️⃣ PERMISSION CHECK: Verify admin has permission to assign projects
    if (!checkPermission(req.user, 'SYSTEM_USERS')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission d\'assigner des projets' });
    }

    // 3️⃣ VALIDATION: Verify all projectIds exist and belong to organization
    const validProjects = await prisma.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
        id: { in: projectIds }
      },
      select: { id: true }
    });

    const validProjectIds = new Set(validProjects.map(p => p.id));
    const invalidIds = projectIds.filter(id => !validProjectIds.has(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'Certains projets sont invalides ou appartiennent à une autre organisation' });
    }

    // Verify target user exists in same organization
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true }
    });

    if (!targetUser || targetUser.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Utilisateur non trouvé dans cette organisation' });
    }

    // 4️⃣ OPTIMIZATION: Get all org projects for bulk update (only if <100)
    const allProjects = await prisma.project.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, config: true }
    });

    const updates = [];

    // Prepare updates only for changed projects
    for (const p of allProjects) {
      const currentAssigned = (p.config || {}).assignedUsers || [];
      const isCurrentlyAssigned = currentAssigned.includes(userId);
      const shouldBeAssigned = projectIds.includes(p.id);

      if (shouldBeAssigned && !isCurrentlyAssigned) {
        updates.push({
          id: p.id,
          action: 'ADD',
          config: { ...p.config, assignedUsers: [...currentAssigned, userId] }
        });
      } else if (!shouldBeAssigned && isCurrentlyAssigned) {
        updates.push({
          id: p.id,
          action: 'REMOVE',
          config: { ...p.config, assignedUsers: currentAssigned.filter(id => id !== userId) }
        });
      }
    }

    // Execute updates atomically
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map(u =>
          prisma.project.update({
            where: { id: u.id },
            data: { config: u.config }
          })
        )
      );

      // Audit Log
      await tracerAction({
        userId: adminId,
        organizationId,
        action: 'ASSIGNATION_PROJETS_UTILISATEUR',
        resource: 'Utilisateur',
        resourceId: userId,
        details: {
          projectIds,
          changesCount: updates.length,
          addCount: updates.filter(u => u.action === 'ADD').length,
          removeCount: updates.filter(u => u.action === 'REMOVE').length
        },
        req,
      });

      try {
        socketService.emit('notification', {
          type: 'SYNC',
          message: `Les assignations de projets de ${targetUser.id} ont été mises à jour`,
          data: { user: adminId, action: 'USER_ASSIGNMENTS_UPDATED', targetUser: userId },
        });
      } catch (wsError) {
        logger.error('WebSocket Emit error during assignment:', wsError);
      }
    }

    res.json({
      message: 'Assignations mises à jour avec succès',
      summary: {
        totalProjects: allProjects.length,
        assignedProjects: projectIds.length,
        changesCount: updates.length,
        success: true
      }
    });
  } catch (error) {
    logger.error('Assign user to projects error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour des assignations' });
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
      where: { id: req.user.id },
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
      where: { id, organizationId, deletedAt: null },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 4b. PROTECT BASE PROJECT
    if (
      project.name === 'GEM' ||
      project.name === 'GEM SAAS' ||
      project.name === 'GEM SAAS - LSE' ||
      project.name === 'Projet LSE - Électrification' ||
      project.name.includes('LSE')
    ) {
      return res.status(403).json({ error: 'Le projet système est protégé et ne peut pas être supprimé.' });
    }

    // 5. Soft delete
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // 6. Audit Log
    await tracerAction({
      userId: req.user.id,
      organizationId,
      action: 'SUPPRESSION_PROJET',
      resource: 'Projet',
      resourceId: id,
      details: { name: project.name },
      req,
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ error: 'Server error while deleting project' });
  }
};

// -------------------------------------------------------------
// BORDEREAU GENERATION (Spatial assignment on the fly)
// -------------------------------------------------------------
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getProjectBordereau = async (req, res) => {
  try {
    logger.info(`[BORDEREAU] Starting getProjectBordereau for projectId: ${req.params.id}`);
    const { id: projectId } = req.params;
    const { organizationId } = req.user;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
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
        deletedAt: null,
      },
      _count: true,
    });

    // Structure stats for easy access: grappeId -> { total, done }
    const statsMap = {};
    grappeStats.forEach((gs) => {
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
          select: { id: true, name: true },
        },
      },
    });

    // 3. Fetch all teams for this project
    const teams = await prisma.team.findMany({
      where: { organizationId, projectId, deletedAt: null },
      select: { id: true, name: true, tradeKey: true, role: true, grappeId: true },
    });

    const mappedTeams = teams.map((t) => {
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
          teams: mappedTeams.filter((t) => t.grappeId === g.id),
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
          deletedAt: null,
        },
        _count: true,
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
          teams: [],
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
      grappes: enrichedGrappes,
    });
  } catch (error) {
    logger.error('Bordereau calculation error:', error);
    res.status(500).json({ error: 'Failed to generate bordereau' });
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
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await recalculateProjectGrappes(projectId, organizationId, true);

    res.json({
      message: 'Recalculation triggered and completed',
      result,
    });
  } catch (error) {
    logger.error('Manual recalculate error:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    res
      .status(status)
      .json({ error: status === 404 ? 'Project not found' : 'Failed to recalculate grappes' });
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
        deletedAt: null,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Supprimer TOUS les ménages du projet
    const deletedHouseholds = await prisma.household.deleteMany({
      where: {
        zone: {
          projectId,
        },
      },
    });

    // Supprimer TOUTES les grappes associées (optionnel, elles seront recréées si nécessaire)
    const deletedGrappes = await prisma.grappe.deleteMany({
      where: {
        households: {
          none: {}, // Grappes sans ménages
        },
      },
    });

    logger.info(`[RESET] Supprimé ${deletedHouseholds.count} ménages du projet ${projectId}`);
    logger.info(`[RESET] Supprimé ${deletedGrappes.count} grappes orphelines`);

    // Tracer l'action
    await tracerAction({
      userId: req.user.id,
      organizationId,
      action: 'RESET_DATA',
      resource: 'Projet',
      resourceId: projectId,
      details: { name: project.name },
      req,
    });

    res.json({
      message: 'Project data reset successfully',
      deleted: {
        households: deletedHouseholds.count,
        grappes: deletedGrappes.count,
      },
    });
  } catch (error) {
    logger.error('Project reset error:', error);
    res.status(500).json({ error: 'Failed to reset project data' });
  }
};

/**
 * 🚀 DEPLOY: Lance la mise à jour du VPS depuis l'interface
 */
export const deployServerUpdate = async (req, res) => {
  try {
    const { email, organizationId, role: userRole } = req.user;

// 🛡️ SÉCURITÉ : Seul l'administrateur principal ou un ADMIN_PROQUELEC peut déployer
      const { ROLES, isSuperAdminEmail } = await import('../../core/config/permissions.js');
      const isSuperAdmin = isSuperAdminEmail(email);
      const hasAdminRole = userRole === ROLES.ADMIN || userRole === ROLES.DIRECTEUR || userRole === ROLES.ADMIN_ALT || userRole === 'ADMIN_PROQUELEC';
      if (!isSuperAdmin && !hasAdminRole) {
        return res.status(403).json({ error: 'Privilèges insuffisants pour cette opération.' });
      }

    const projectPath = DEFAULT_WANEKOO_DEPLOY_PATH;
    const command = buildWanekooDeployCommand(projectPath);

    logger.info(`[SYSTEM] Déploiement initié par ${email}`);

    // On lance en arrière-plan pour ne pas bloquer la requête HTTP
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error(`[DEPLOY ERROR]: ${error.message}`);
        return;
      }
      logger.info(`[DEPLOY SUCCESS]: ${stdout}`);

      // Notification via Socket.io quand c'est fini
      socketService.emit('notification', {
        type: 'SUCCESS',
        message: 'Le serveur a été mis à jour avec succès !',
        data: { action: 'DEPLOY_COMPLETED' },
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
      req,
    });

    res.json({
      message: 'Déploiement lancé avec succès.',
      details: "L'opération dure environ 60 secondes en arrière-plan.",
    });
  } catch (error) {
    logger.error('Deploy route error:', error);
    res.status(500).json({ error: "Erreur lors de l'initialisation du déploiement" });
  }
};

/**
 * 🗄️ DB MAINTENANCE: Nettoie les enregistrements supprimés (soft deletes) et optimise la base
 */
export const dbMaintenance = async (req, res) => {
  try {
    const { email, organizationId, role: userRole } = req.user;

// 🛡️ SÉCURITÉ : Seul l'administrateur principal ou un ADMIN_PROQUELEC peut lancer la maintenance
     const { ROLES, isSuperAdminEmail } = await import('../../core/config/permissions.js');
     const isSuperAdmin = isSuperAdminEmail(email);
     const hasAdminRole = userRole === ROLES.ADMIN || userRole === ROLES.DIRECTEUR || userRole === ROLES.ADMIN_ALT || userRole === 'ADMIN_PROQUELEC';
     if (!isSuperAdmin && !hasAdminRole) {
       return res.status(403).json({ error: 'Privilèges insuffisants pour cette opération.' });
     }

    logger.info(`[SYSTEM] Maintenance BD initiée par ${email}`);

    // 1. Nettoyage des Soft Deletes (Vieux de plus de 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Purge ordonnée uniquement sur les modèles réellement soft-deletés
    // Household -> Team/Mission -> Zone -> Project
    const [householdsResult, teamsResult, missionsResult] = await prisma.$transaction([
      prisma.household.deleteMany({
        where: {
          deletedAt: { lte: thirtyDaysAgo },
        },
      }),
      prisma.team.deleteMany({
        where: {
          deletedAt: { lte: thirtyDaysAgo },
        },
      }),
      prisma.mission.deleteMany({
        where: {
          deletedAt: { lte: thirtyDaysAgo },
        },
      }),
    ]);

    const zonesResult = await prisma.zone.deleteMany({
      where: {
        deletedAt: { lte: thirtyDaysAgo },
        households: { none: {} },
        teams: { none: {} },
      },
    });

    const projectsResult = await prisma.project.deleteMany({
      where: {
        deletedAt: { lte: thirtyDaysAgo },
        zones: { none: {} },
        teams: { none: {} },
        missions: { none: {} },
      },
    });

    const totalCleaned =
      householdsResult.count +
      teamsResult.count +
      missionsResult.count +
      zonesResult.count +
      projectsResult.count;

    // 3. Exécuter un VACUUM (Optimisation PostgreSQL) si natif
    try {
      await prisma.$executeRaw`VACUUM ANALYZE;`;
      logger.info('[SYSTEM] DB Vacuum Analyze successful.');
    } catch (dbErr) {
      logger.warn('[SYSTEM] DB Vacuum non supporté ou ignoré:', dbErr.message);
    }

    // Audit Log
    await tracerAction({
      userId: req.user.id,
      organizationId,
      action: 'MAINTENANCE_DB',
      resource: 'Base de données',
      resourceId: 'PROD',
      details: { initiator: email, recordsCleaned: totalCleaned },
      req,
    });

    res.json({
      message: 'Maintenance terminée avec succès !',
      details: `${totalCleaned} anciens enregistrements (corbeille) purgés. Base optimisée.`,
    });
  } catch (error) {
    logger.error('Database Maintenance error:', error);
    res.status(500).json({ error: 'Erreur lors de la maintenance de la base de données' });
  }
};
