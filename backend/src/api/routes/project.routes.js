import express from 'express';
import rateLimit from 'express-rate-limit';
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
  assignUserToProjects,
} from '../../modules/project/project.controller.js';
import { authProtect, authorize } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { validate } from '../../middleware/validate.js';
import { getValidProjectStatuses } from '../../core/config/businessRules.js';
import * as projectConfig from '../../modules/projectConfig/projectConfig.controller.js';
import { getProjectAnalytics } from '../../modules/project/project_analytics.controller.js';
import Joi from 'joi';
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectListSchema,
  projectByIdSchema,
  assignUserToProjectsSchema,
  createPageSchema,
  updatePageSchema,
  createModuleSchema,
  updateModuleSchema,
  getProjectAnalyticsSchema,
  getProjectBordereauSchema,
  recalculateGrappesSchema,
  resetProjectDataSchema,
  getProjectTemplateSchema,
} from '../../modules/project/project.validation.schemas.js';

const router = express.Router();

// Rate limiters
const projectLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.', code: 'PROJECT_RATE_LIMIT' },
  skip: () => process.env.NODE_ENV === 'development',
});

const projectWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de modifications. Réessayez dans une minute.',
    code: 'PROJECT_WRITE_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

const projectAdminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes admin. Réessayez dans une minute.',
    code: 'PROJECT_ADMIN_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);
router.use(projectLimiter);

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Gestion et configuration des projets
 */

// [FIX M-2] Routes fixes avant /:id pour éviter les conflits d'interprétation
router.post(
  '/assign-user',
  verifierPermission(PERMISSIONS.CREER_PROJET),
  validate(assignUserToProjectsSchema),
  assignUserToProjects
);

// [FIX M-5] Routes système renforcées avec authorize() explicite Admin uniquement
router.post(
  '/system/deploy',
  authorize('ADMIN_PROQUELEC'),
  projectAdminLimiter,
  deployServerUpdate
);
router.post(
  '/system/db-maintenance',
  authorize('ADMIN_PROQUELEC'),
  projectAdminLimiter,
  dbMaintenance
);

// Liste projets
router.get('/', validate(projectListSchema), getProjects);

// CRUD projet
router.post(
  '/',
  projectWriteLimiter,
  validate(projectCreateSchema),
  verifierPermission(PERMISSIONS.CREER_PROJET),
  createProject
);
router.get('/:id', validate(projectByIdSchema), getProjectById);
router.patch(
  '/:id',
  projectWriteLimiter,
  validate(projectUpdateSchema),
  verifierPermission(PERMISSIONS.MODIFIER_CARTE),
  verifierAssignation('projet'),
  updateProject
);
router.delete(
  '/:id',
  projectWriteLimiter,
  verifierPermission(PERMISSIONS.SUPPRIMER_PROJET),
  verifierAssignation('projet'),
  deleteProject
);

// Bordereau
router.get('/:id/bordereau', validate(getProjectBordereauSchema), getProjectBordereau);

// Recalcul grappes
router.post(
  '/:id/recalculate-grappes',
  projectWriteLimiter,
  verifierPermission(PERMISSIONS.MODIFIER_CARTE),
  validate(recalculateGrappesSchema),
  triggerRecalculateGrappes
);

// Reset data
router.post(
  '/:id/reset-data',
  projectAdminLimiter,
  verifierPermission(PERMISSIONS.SUPPRIMER_PROJET),
  validate(resetProjectDataSchema),
  resetProjectData
);

// Project pages & modules (scoped by :id project)
router.get('/:id/template', validate(projectByIdSchema), projectConfig.getProjectTemplate);
router.get('/:id/pages', validate(projectByIdSchema), projectConfig.listPages);
router.post(
  '/:id/pages',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate(createPageSchema),
  projectConfig.createPage
);
router.patch(
  '/:id/pages/:pageId',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate(updatePageSchema),
  projectConfig.updatePage
);
router.delete(
  '/:id/pages/:pageId',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate({
    params: { id: Joi.string().uuid().required(), pageId: Joi.string().uuid().required() },
  }),
  projectConfig.deletePage
);

router.get('/:id/modules', validate(projectByIdSchema), projectConfig.listModules);
router.post(
  '/:id/modules',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate(createModuleSchema),
  projectConfig.createModule
);
router.patch(
  '/:id/modules/:moduleId',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate(updateModuleSchema),
  projectConfig.updateModule
);
router.delete(
  '/:id/modules/:moduleId',
  projectWriteLimiter,
  verifierPermission('project.module.manage'),
  validate({
    params: { id: Joi.string().uuid().required(), moduleId: Joi.string().uuid().required() },
  }),
  projectConfig.deleteModule
);

// Analytics
router.get('/:id/analytics', validate(getProjectAnalyticsSchema), getProjectAnalytics);

export default router;
