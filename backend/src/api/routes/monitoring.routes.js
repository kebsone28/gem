import express from 'express';
import { getActivityFeed, getPerformanceStats, getSystemHealth, logClientError, getSystemErrors, resolveSystemError } from '../../modules/monitoring/monitoring.controller.js';
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
router.post('/client-errors', logClientError);
router.get('/system-errors', getSystemErrors);
router.patch('/system-errors/:id/resolve', resolveSystemError);

export default router;
