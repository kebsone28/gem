import express from 'express';
import rateLimit from 'express-rate-limit';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { validate } from '../../middleware/validate.js';
import * as alertsController from './alerts.controller.js';
import {
  getAlertConfigSchema,
  updateAlertConfigSchema,
  getProjectAlertsSchema,
  getAlertStatsSchema,
  createAlertSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
} from './alerts.validation.schemas.js';

const router = express.Router();

// Rate limiter pour les endpoints d'alertes
const alertsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.', code: 'ALERTS_RATE_LIMIT' },
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiter pour création d'alertes (plus strict)
const alertsCreateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de créations d'alertes. Réessayez dans une minute.",
    code: 'ALERTS_CREATE_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

router.use(authProtect);
router.use(alertsLimiter);

// ⚠️ Routes STATIQUES en premier (avant les routes dynamiques /:id)
// Configuration
router.get('/config/organization', validate(getAlertConfigSchema), alertsController.getAlertConfig);
router.patch(
  '/config/organization',
  verifierPermission(PERMISSIONS.GERER_PARAMETRES),
  validate(updateAlertConfigSchema),
  alertsController.updateAlertConfig
);

// Stats et analytics
router.get('/:projectId/stats', validate(getAlertStatsSchema), alertsController.getAlertStats);

// Alertes CRUD
router.get('/:projectId', validate(getProjectAlertsSchema), alertsController.getProjectAlerts);
router.post(
  '/',
  verifierPermission(PERMISSIONS.GERER_PV),
  alertsCreateLimiter,
  validate(createAlertSchema),
  alertsController.createAlert
);
router.patch(
  '/:alertId/acknowledge',
  verifierPermission(PERMISSIONS.GERER_PV),
  validate(acknowledgeAlertSchema),
  alertsController.acknowledgeAlert
);
router.patch(
  '/:alertId/resolve',
  verifierPermission(PERMISSIONS.GERER_PV),
  validate(resolveAlertSchema),
  alertsController.resolveAlert
);

export default router;
