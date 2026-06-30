import Joi from 'joi';
import { JoiSchemas } from '../../middleware/validate.js';

/**
 * Schémas de validation Joi pour le module Alerts
 */

export const getAlertConfigSchema = {
  query: Joi.object({
    projectId: Joi.string().uuid().optional(),
  }),
};

export const updateAlertConfigSchema = {
  body: Joi.object({
    enabled: Joi.boolean().optional(),
    channels: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      inApp: Joi.boolean().optional(),
      webhook: Joi.boolean().optional(),
    }).optional(),
    thresholds: Joi.object({
      critical: Joi.number().min(0).optional(),
      warning: Joi.number().min(0).optional(),
      info: Joi.number().min(0).optional(),
    }).optional(),
    recipients: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('email', 'sms', 'webhook').required(),
          value: Joi.string().required(),
          severity: Joi.array()
            .items(Joi.string().valid('critical', 'warning', 'info'))
            .optional(),
        })
      )
      .optional(),
    schedule: Joi.object({
      enabled: Joi.boolean().optional(),
      cron: Joi.string().optional(),
      timezone: Joi.string().optional(),
    }).optional(),
  })
    .min(1)
    .messages({
      'object.min': 'Au moins un paramètre de configuration doit être fourni',
    }),
};

export const getProjectAlertsSchema = {
  params: Joi.object({
    projectId: Joi.string().required(),
  }),
  query: Joi.object({
    status: Joi.string().valid('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED').optional(),
    severity: Joi.string().optional(),
    type: Joi.string().optional(),
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(200).default(50),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sortBy: Joi.string().valid('createdAt', 'severity', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

export const getAlertStatsSchema = {
  params: Joi.object({
    projectId: Joi.string().optional(),
  }),
  query: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    groupBy: Joi.string()
      .valid('day', 'week', 'month', 'severity', 'type', 'status')
      .default('day'),
  }),
};

export const createAlertSchema = {
  body: Joi.object({
    projectId: Joi.string().required().messages({
      'any.required': 'Le projectId est requis',
    }),
    householdId: Joi.string().uuid().optional(),
    pvId: Joi.string().uuid().optional(),
    type: Joi.string().max(100).required().messages({
      'any.required': "Le type d'alerte est requis",
    }),
    severity: Joi.string().required().messages({
      'any.required': 'La sévérité est requise',
    }),
    title: Joi.string().min(1).max(255).required().messages({
      'any.required': 'Le titre est requis',
    }),
    description: Joi.string().max(10000).optional().allow('', null),
    recommendedAction: Joi.string().max(5000).optional().allow('', null),
    metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  }),
};

export const acknowledgeAlertSchema = {
  body: Joi.object({
    comment: Joi.string().max(5000).optional().allow('', null),
  }).optional(),
  params: Joi.object({
    alertId: Joi.string().required(),
  }),
};

export const resolveAlertSchema = {
  body: Joi.object({
    resolution: Joi.string().max(5000).optional(),
    comment: Joi.string().max(5000).optional().allow('', null),
  })
    .or('resolution', 'comment')
    .messages({
      'object.missing': 'La résolution ou un commentaire est requis',
    }),
  params: Joi.object({
    alertId: Joi.string().required(),
  }),
};
