import express from 'express';
import {
    getProjectKPIs,
    getGlobalSummary
} from '../../modules/kpi/kpi.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

router.get('/summary', verifierPermission(PERMISSIONS.VOIR_RAPPORTS), getGlobalSummary);
router.get('/:projectId', verifierPermission(PERMISSIONS.VOIR_RAPPORTS), getProjectKPIs);

export default router;
