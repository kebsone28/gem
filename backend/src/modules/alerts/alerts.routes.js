/**
 * Routes Alertes - Endpoints du flux d'alertes
 */

import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import * as alertsController from './alerts.controller.js';

const router = express.Router();

// Middlewares d'authentification
router.use(authProtect);

// ⚠️ Routes STATIQUES en premier (avant les routes dynamiques /:id)
// Configuration
router.get('/config/organization', alertsController.getAlertConfig);
router.patch('/config/organization', verifierPermission(PERMISSIONS.GERER_PARAMETRES), alertsController.updateAlertConfig);

// Stats et analytics
router.get('/:projectId/stats', alertsController.getAlertStats);

// Alertes CRUD
router.get('/:projectId', alertsController.getProjectAlerts);
router.post('/', verifierPermission(PERMISSIONS.GERER_PV), alertsController.createAlert);
router.patch('/:alertId/acknowledge', verifierPermission(PERMISSIONS.GERER_PV), alertsController.acknowledgeAlert);
router.patch('/:alertId/resolve', verifierPermission(PERMISSIONS.GERER_PV), alertsController.resolveAlert);

export default router;
