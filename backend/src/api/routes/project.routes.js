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

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.get('/:id/bordereau', getProjectBordereau);
router.post('/:id/recalculate-grappes', triggerRecalculateGrappes);
router.post('/:id/reset-data', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), resetProjectData);
router.post('/assign-user', verifierPermission(PERMISSIONS.CREER_PROJET), assignUserToProjects);
router.post('/', verifierPermission(PERMISSIONS.CREER_PROJET), createProject);
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('projet'), updateProject);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('projet'), deleteProject);
router.post('/system/deploy', deployServerUpdate);
router.post('/system/db-maintenance', dbMaintenance);

// Project pages & modules (scoped by :id project)
router.get('/:id/template', projectConfig.getProjectTemplate);
router.get('/:id/pages', projectConfig.listPages);
router.post('/:id/pages', verifierPermission('project.module.manage'), projectConfig.createPage);
router.patch('/:id/pages/:pageId', verifierPermission('project.module.manage'), projectConfig.updatePage);
router.delete('/:id/pages/:pageId', verifierPermission('project.module.manage'), projectConfig.deletePage);

router.get('/:id/modules', projectConfig.listModules);
router.post('/:id/modules', verifierPermission('project.module.manage'), projectConfig.createModule);
router.patch('/:id/modules/:moduleId', verifierPermission('project.module.manage'), projectConfig.updateModule);
router.delete('/:id/modules/:moduleId', verifierPermission('project.module.manage'), projectConfig.deleteModule);

router.get('/:id/analytics', getProjectAnalytics);

export default router;
