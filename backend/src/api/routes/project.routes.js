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
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import * as projectConfig from '../../modules/projectConfig/projectConfig.controller.js';
import { getProjectAnalytics } from '../../modules/project/project_analytics.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Gestion et configuration des projets
 */

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
router.post('/:id/recalculate-grappes', triggerRecalculateGrappes);

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

/**
 * @swagger
 * /api/projects/assign-user:
 *   post:
 *     summary: Assigner un utilisateur aux projets
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Utilisateur assigné
 */
router.post('/assign-user', verifierPermission(PERMISSIONS.CREER_PROJET), assignUserToProjects);

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Créer un nouveau projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Projet créé
 */
router.post('/', verifierPermission(PERMISSIONS.CREER_PROJET), createProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   patch:
 *     summary: Mettre à jour un projet existant
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Projet mis à jour
 */
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('projet'), updateProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Supprimer un projet
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Projet supprimé
 */
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('projet'), deleteProject);

/**
 * @swagger
 * /api/projects/system/deploy:
 *   post:
 *     summary: Déployer une mise à jour serveur
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déploiement initié
 */
router.post('/system/deploy', deployServerUpdate);

/**
 * @swagger
 * /api/projects/system/db-maintenance:
 *   post:
 *     summary: Lancer la maintenance de la base de données
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Maintenance initiée
 */
router.post('/system/db-maintenance', dbMaintenance);

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
