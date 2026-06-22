import express from 'express';
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getProjectBordereau,
    triggerRecalculateGrappes,
    resetProjectData,
    deployServerUpdate,
    dbMaintenance,
    assignUserToProjects
} from '../../modules/project/project.controller.js';
import { authProtect, authorize } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { validateSchema } from '../../middleware/validation.js';
import { getValidProjectStatuses } from '../../core/config/businessRules.js';
import * as projectConfig from '../../modules/projectConfig/projectConfig.controller.js';
import { getProjectAnalytics } from '../../modules/project/project_analytics.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Gestion et configuration des projets
 */

// Define project schemas for validation
const VALID_PROJECT_STATUSES = getValidProjectStatuses();

const projectCreateSchema = {
  required: ['name'],
  fields: {
    name: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 255,
    },
    status: {
      type: 'string',
      enum: VALID_PROJECT_STATUSES,
    },
    budget: {
      type: 'number',
      minimum: 0,
    },
    description: {
      type: 'string',
      maxLength: 5000,
    },
  },
};

const projectUpdateSchema = {
  fields: {
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 255,
    },
    status: {
      type: 'string',
      enum: VALID_PROJECT_STATUSES,
    },
    budget: {
      type: 'number',
      minimum: 0,
    },
    description: {
      type: 'string',
      maxLength: 5000,
    },
  },
};

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Lister les projets
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des projets
 */
router.get('/', getProjects);

// [FIX M-2] Routes fixes avant /:id pour éviter les conflits d'interprétation
router.post('/assign-user', verifierPermission(PERMISSIONS.CREER_PROJET), assignUserToProjects);

// [FIX M-5] Routes système renforcees avec authorize() expléicité Admin uniquement
router.post('/system/deploy', authorize('ADMIN_PROQUELEC'), deployServerUpdate);
router.post('/system/db-maintenance', authorize('ADMIN_PROQUELEC'), dbMaintenance);

// Routes spécifiques au projet (segment fixe) AVANT les routes /:id
router.post('/', validateSchema(projectCreateSchema), verifierPermission(PERMISSIONS.CREER_PROJET), createProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Obtenir un projet par ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du projet
 */
router.get('/:id', getProjectById);

/**
 * @swagger
 * /api/projects/{id}/bordereau:
 *   get:
 *     summary: Obtenir le bordereau du projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Données du bordereau
 */
router.get('/:id/bordereau', getProjectBordereau);

/**
 * @swagger
 * /api/projects/{id}/recalculate-grappes:
 *   post:
 *     summary: Recalculer les grappes d'un projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Grappes recalculées
 */
router.post('/:id/recalculate-grappes', verifierPermission(PERMISSIONS.MODIFIER_CARTE), triggerRecalculateGrappes);

/**
 * @swagger
 * /api/projects/{id}/reset-data:
 *   post:
 *     summary: Réinitialiser les données d'un projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Données réinitialisées avec succès
 */
router.post('/:id/reset-data', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), resetProjectData);

// CRUD projet — modif et suppression (apr\u00e8s les routes fixes)
router.patch('/:id', validateSchema(projectUpdateSchema), verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('projet'), updateProject);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('projet'), deleteProject);

// Project pages & modules (scoped by :id project)
/**
 * @swagger
 * /api/projects/{id}/template:
 *   get:
 *     summary: Obtenir le modèle (template) d'un projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Modèle de projet
 */
router.get('/:id/template', projectConfig.getProjectTemplate);

/**
 * @swagger
 * /api/projects/{id}/pages:
 *   get:
 *     summary: Lister les pages du projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Liste des pages
 */
router.get('/:id/pages', projectConfig.listPages);

/**
 * @swagger
 * /api/projects/{id}/pages:
 *   post:
 *     summary: Créer une page de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       201:
 *         description: Page créée
 */
router.post('/:id/pages', verifierPermission('project.module.manage'), projectConfig.createPage);

/**
 * @swagger
 * /api/projects/{id}/pages/{pageId}:
 *   patch:
 *     summary: Mettre à jour une page de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: pageId
 *         required: true
 *     responses:
 *       200:
 *         description: Page mise à jour
 */
router.patch('/:id/pages/:pageId', verifierPermission('project.module.manage'), projectConfig.updatePage);

/**
 * @swagger
 * /api/projects/{id}/pages/{pageId}:
 *   delete:
 *     summary: Supprimer une page de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: pageId
 *         required: true
 *     responses:
 *       200:
 *         description: Page supprimée
 */
router.delete('/:id/pages/:pageId', verifierPermission('project.module.manage'), projectConfig.deletePage);

/**
 * @swagger
 * /api/projects/{id}/modules:
 *   get:
 *     summary: Lister les modules du projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Liste des modules
 */
router.get('/:id/modules', projectConfig.listModules);

/**
 * @swagger
 * /api/projects/{id}/modules:
 *   post:
 *     summary: Créer un module de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       201:
 *         description: Module créé
 */
router.post('/:id/modules', verifierPermission('project.module.manage'), projectConfig.createModule);

/**
 * @swagger
 * /api/projects/{id}/modules/{moduleId}:
 *   patch:
 *     summary: Mettre à jour un module de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: moduleId
 *         required: true
 *     responses:
 *       200:
 *         description: Module mis à jour
 */
router.patch('/:id/modules/:moduleId', verifierPermission('project.module.manage'), projectConfig.updateModule);

/**
 * @swagger
 * /api/projects/{id}/modules/{moduleId}:
 *   delete:
 *     summary: Supprimer un module de projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: path
 *         name: moduleId
 *         required: true
 *     responses:
 *       200:
 *         description: Module supprimé
 */
router.delete('/:id/modules/:moduleId', verifierPermission('project.module.manage'), projectConfig.deleteModule);

/**
 * @swagger
 * /api/projects/{id}/analytics:
 *   get:
 *     summary: Obtenir les analyses (analytics) du projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Données d'analyse
 */
router.get('/:id/analytics', getProjectAnalytics);

export default router;
