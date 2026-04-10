import express from 'express';
import { getConfig, updateConfig } from '../../modules/organization/organization.controller.js';
import { authProtect } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes d'organisation sont protégées
router.use(authProtect);

router.get('/config', getConfig);
router.patch('/config', updateConfig);

export default router;
