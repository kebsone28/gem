import express from 'express';
import { getActivityFeed, getPerformanceStats, getSystemHealth } from '../../modules/monitoring/monitoring.controller.js';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Toutes les routes de monitoring sont protégées
router.use(authProtect);
router.use(verifierPermission(PERMISSIONS.VOIR_DIAGNOSTIC));

router.get('/activity', getActivityFeed);
router.get('/performance', getPerformanceStats);
router.get('/system-health', getSystemHealth);

export default router;
