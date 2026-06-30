import Joi from 'joi';
import { JoiSchemas } from '../../middleware/validate.js';

/**
 * Schémas de validation Joi pour le module Mission
 */

const MISSION_STATUS_ENUM = [
  'draft',
  'soumise',
  'en_attente_validation',
  'approuvee',
  'rejetee',
  'en_cours',
  'terminee',
  'annulee',
  'archivee',
];

export const getMissionsSchema = {
  query: Joi.object({
    status: Joi.string()
      .valid(...MISSION_STATUS_ENUM)
      .optional(),
    projectId: Joi.string().uuid().optional(),
    assignedToId: Joi.string().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    search: JoiSchemas.search,
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(100).default(50),
    sortBy: Joi.string()
      .valid('createdAt', 'orderNumber', 'title', 'status', 'budget')
      .default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

export const getMissionStatsSchema = {
  query: Joi.object({
    projectId: Joi.string().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    groupBy: Joi.string().valid('status', 'projectId', 'assignedToId', 'month').optional(),
  }),
};

export const missionCreateSchema = {
  body: Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
      'string.min': 'title must have at least 3 characters',
      'any.required': 'title is required',
    }),
    description: Joi.string().max(5000).optional().allow('', null),
    budget: Joi.number().min(0).optional(),
    projectId: Joi.string().uuid().optional(),
    status: Joi.string()
      .valid(...MISSION_STATUS_ENUM)
      .optional(),
    orderNumber: Joi.string().max(50).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    assignedToId: Joi.string().uuid().optional(),
    data: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  }),
};

export const missionUpdateSchema = {
  body: Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    budget: Joi.number().min(0).optional(),
    projectId: Joi.string().uuid().optional(),
    status: Joi.string()
      .valid(...MISSION_STATUS_ENUM)
      .optional(),
    orderNumber: Joi.string().max(50).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    assignedToId: Joi.string().uuid().optional(),
    data: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
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

export const missionAssignSchema = {
  body: Joi.object({
    projectId: Joi.string().uuid().required().messages({
      'any.required': 'projectId est requis',
    }),
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const duplicateMissionSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
  body: Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    projectId: Joi.string().uuid().optional(),
    assignedToId: Joi.string().uuid().optional(),
  }).optional(),
};

export const overrideOrderNumberSchema = {
  body: Joi.object({
    orderNumber: Joi.string().min(1).max(50).required().messages({
      'any.required': "Le numéro d'ordre est requis",
    }),
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

export const approveMissionStepSchema = {
  body: Joi.object({
    pin: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .optional()
      .allow('', null)
      .messages({
        'string.length': 'Le PIN doit contenir exactement 6 chiffres',
        'string.pattern.base': 'Le PIN doit contenir uniquement des chiffres',
      }),
    comment: Joi.string().max(5000).optional().allow('', null),
    confidence: Joi.number().min(0).max(1).optional(),
  }).optional(),
  params: Joi.object({
    missionId: JoiSchemas.id,
  }),
};

export const rejectMissionStepSchema = {
  body: Joi.object({
    rejectionComment: Joi.string().min(1).max(5000).required().messages({
      'string.min': 'Un commentaire de rejet est requis',
      'any.required': 'Un commentaire de rejet est requis',
    }),
    pin: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .optional()
      .allow('', null)
      .messages({
        'string.length': 'Le PIN doit contenir exactement 6 chiffres',
        'string.pattern.base': 'Le PIN doit contenir uniquement des chiffres',
      }),
  }),
  params: Joi.object({
    missionId: JoiSchemas.id,
  }),
};

export const downloadMissionCertifiedDocumentSchema = {
  params: Joi.object({
    missionId: JoiSchemas.id,
  }),
};

export const sendMissionDocumentEmailSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': "Format d'email invalide",
      'any.required': "L'email du destinataire est requis",
    }),
    subject: Joi.string().max(255).optional(),
    message: Joi.string().max(5000).optional().allow('', null),
  }),
  params: Joi.object({
    missionId: JoiSchemas.id,
  }),
};

export const analyzeMissionIaSchema = {
  body: Joi.object({
    prompt: Joi.string().max(10000).optional().allow('', null),
    includeDocuments: Joi.boolean().default(false),
  }).optional(),
  params: Joi.object({
    missionId: JoiSchemas.id,
  }),
};

export const verifyMissionPublicSchema = {
  params: Joi.object({
    identifier: Joi.string().required(),
  }),
};

export const downloadMissionCertifiedDocumentPublicSchema = {
  params: Joi.object({
    identifier: Joi.string().required(),
  }),
};

export const purgeMissionsSchema = {
  query: Joi.object({
    confirm: Joi.string().valid('YES_DELETE_ALL').required().messages({
      'any.required': 'Confirmation requise: confirm=YES_DELETE_ALL',
      'any.only': 'Confirmation invalide',
    }),
    beforeDate: Joi.date().iso().optional(),
    status: Joi.string()
      .valid(...MISSION_STATUS_ENUM)
      .optional(),
  }),
};
