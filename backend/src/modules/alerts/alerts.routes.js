/**
 * Routes Alertes - Endpoints du flux d'alertes
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as alertsController from './alerts.controller.js';

const router = express.Router();

// Middlewares d'authentification
router.use(authenticate);

// Alertes CRUD
router.get('/:projectId', alertsController.getProjectAlerts);
router.post('/', alertsController.createAlert);
router.patch('/:alertId/acknowledge', alertsController.acknowledgeAlert);
router.patch('/:alertId/resolve', alertsController.resolveAlert);

// Stats et analytics
router.get('/:projectId/stats', alertsController.getAlertStats);

// Configuration
router.get('/config/organization', alertsController.getAlertConfig);
router.patch('/config/organization', alertsController.updateAlertConfig);

export default router;
