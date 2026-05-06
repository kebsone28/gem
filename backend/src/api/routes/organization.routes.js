import express from 'express';
import { getConfig, updateConfig } from '../../modules/organization/organization.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Toutes les routes d'organisation sont protégées
router.use(authProtect);

router.get('/config', getConfig);
router.patch('/config', verifierPermission(PERMISSIONS.GERER_PARAMETRES), updateConfig);

export default router;
