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
    deployServerUpdate
} from '../../modules/project/project.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.get('/:id/bordereau', getProjectBordereau);
router.post('/:id/recalculate-grappes', triggerRecalculateGrappes);
router.post('/:id/reset-data', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), resetProjectData);
router.post('/', verifierPermission(PERMISSIONS.CREER_PROJET), createProject);
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('projet'), updateProject);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('projet'), deleteProject);
router.post('/system/deploy', deployServerUpdate);

export default router;
