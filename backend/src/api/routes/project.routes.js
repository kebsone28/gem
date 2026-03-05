import express from 'express';
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject
} from '../../modules/project/project.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', verifierPermission(PERMISSIONS.CREER_PROJET), createProject);
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('projet'), updateProject);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('projet'), deleteProject);

export default router;
