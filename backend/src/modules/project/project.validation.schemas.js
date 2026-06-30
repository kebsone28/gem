import Joi from 'joi';
import { JoiSchemas } from '../../middleware/validate.js';

/**
 * Schémas de validation Joi pour le module Project
 */

const VALID_PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'];

export const projectCreateSchema = {
  body: Joi.object({
    name: Joi.string().min(3).max(255).required().messages({
      'string.min': 'name must be at least 3 characters',
      'any.required': 'name is required',
    }),
    status: Joi.string()
      .valid(...VALID_PROJECT_STATUSES)
      .optional()
      .messages({
        'any.only': 'status must be one of: active, paused, completed, archived',
      }),
    budget: Joi.number().min(0).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    templateKey: Joi.string().optional(),
    organizationId: Joi.string().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  }),
};

export const projectUpdateSchema = {
  body: Joi.object({
    name: Joi.string().min(3).max(255).optional(),
    status: Joi.string()
      .valid(...VALID_PROJECT_STATUSES)
      .optional(),
    budget: Joi.number().min(0).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    templateKey: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  })
    .min(1)
    .messages({
      'object.min': 'Au moins un champ doit être fourni pour la mise à jour',
    }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const projectListSchema = {
  query: Joi.object({
    status: Joi.string()
      .valid(...VALID_PROJECT_STATUSES)
      .optional(),
    templateKey: Joi.string().optional(),
    search: JoiSchemas.search,
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(100).default(50),
    sortBy: Joi.string().valid('createdAt', 'name', 'status', 'budget').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

export const projectByIdSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const assignUserToProjectsSchema = {
  body: Joi.object({
    userId: Joi.string().uuid().required().messages({
      'string.uuid': 'userId invalide',
      'any.required': 'userId invalide',
      'string.base': 'userId invalide',
    }),
    projectIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
      'array.min': 'au moins un projet',
      'array.base': 'tableau',
      'any.required': 'La liste des projectIds est requise',
    }),
    role: Joi.string().valid('CHEF_PROJET', 'MEMBRE', 'OBSERVATEUR').default('MEMBRE'),
  }),
};

export const createPageSchema = {
  body: Joi.object({
    key: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required(),
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(5000).optional().allow('', null),
    layout: Joi.string().optional(),
    config: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    order: Joi.number().integer().min(0).default(0),
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const updatePageSchema = {
  body: Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    layout: Joi.string().optional(),
    config: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    order: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),
  params: Joi.object({
    id: JoiSchemas.id,
    pageId: JoiSchemas.id,
  }),
};

export const createModuleSchema = {
  body: Joi.object({
    key: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required(),
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(5000).optional().allow('', null),
    config: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    isActive: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0),
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const updateModuleSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    config: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    isActive: Joi.boolean().optional(),
    order: Joi.number().integer().min(0).optional(),
  }).min(1),
  params: Joi.object({
    id: JoiSchemas.id,
    moduleId: JoiSchemas.id,
  }),
};

export const getProjectAnalyticsSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
  query: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    metrics: Joi.string().optional(),
  }),
};

export const getProjectBordereauSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const recalculateGrappesSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
  body: Joi.object({
    force: Joi.boolean().default(false),
    clearExisting: Joi.boolean().default(false),
  }).optional(),
};

export const resetProjectDataSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
  body: Joi.object({
    confirm: Joi.string().valid('YES_RESET').required(),
    keepUsers: Joi.boolean().default(true),
    keepConfig: Joi.boolean().default(false),
  }),
};

export const getProjectTemplateSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};
