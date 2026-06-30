/**
 * Routes API pour les rapports programmés
 */
import Joi from 'joi';
import express from 'express';
import { authProtect, authorize } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  getGeneratedReports,
  downloadGeneratedReport,
} from './reports.controller.js';

const router = express.Router();

router.use(authProtect);

const reportSchemas = {
  createScheduledReportSchema: {
    body: Joi.object({
      formKey: Joi.string().required(),
      name: Joi.string().min(1).max(255).required(),
      format: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
      schedule: Joi.string().valid('daily', 'weekly', 'monthly').required(),
      recipients: Joi.array().items(Joi.string().email()).min(1).required(),
      filters: Joi.object().optional(),
    }),
  },
  updateScheduledReportSchema: {
    body: Joi.object({
      name: Joi.string().min(1).max(255).optional(),
      format: Joi.string().valid('csv', 'json', 'xlsx').optional(),
      schedule: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
      recipients: Joi.array().items(Joi.string().email()).min(1).optional(),
      filters: Joi.object().optional(),
      active: Joi.boolean().optional(),
    }).min(1),
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
  deleteScheduledReportSchema: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
  downloadGeneratedReportSchema: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
};

router.get('/scheduled', authorize('toolbox.settings.manage'), listScheduledReports);
router.post('/scheduled', authorize('toolbox.settings.manage'), validate(reportSchemas.createScheduledReportSchema), createScheduledReport);
router.put('/scheduled/:id', authorize('toolbox.settings.manage'), validate(reportSchemas.updateScheduledReportSchema), updateScheduledReport);
router.delete('/scheduled/:id', authorize('toolbox.settings.manage'), validate(reportSchemas.deleteScheduledReportSchema), deleteScheduledReport);
router.get('/generated', authorize('toolbox.settings.manage'), getGeneratedReports);
router.get('/generated/:id/download', authorize('toolbox.settings.manage'), validate(reportSchemas.downloadGeneratedReportSchema), downloadGeneratedReport);

export default router;
