import Joi from 'joi';
import { JoiSchemas } from '../../middleware/validate.js';

/**
 * Schémas de validation Joi pour le module Toolbox
 * Utilise le middleware validate() existant (src/middleware/validate.js)
 */

// Schéma pour création définition formulaire
export const createToolboxFormDefinitionSchema = {
  body: Joi.object({
    formKey: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9_-]+$/).required().messages({
      'string.pattern.base': 'La clé de formulaire ne peut contenir que des lettres, chiffres, tirets et underscores',
      'any.required': 'formKey est requis',
    }),
    formVersion: Joi.string().max(50).required(),
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(5000).optional().allow('', null),
    survey: Joi.array().items(Joi.object()).required(),
    choices: Joi.array().items(Joi.object()).optional(),
    settings: Joi.array().items(Joi.object()).optional(),
  }),
};

// Schéma pour mise à jour définition formulaire
export const updateToolboxFormDefinitionSchema = {
  body: Joi.object({
    formVersion: Joi.string().max(50).optional(),
    title: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
    survey: Joi.array().items(Joi.object()).optional(),
    choices: Joi.array().items(Joi.object()).optional(),
    settings: Joi.array().items(Joi.object()).optional(),
    status: Joi.string().valid('draft', 'published', 'archived').optional(),
  }).min(1),
  params: Joi.object({
    formKey: Joi.string().required(),
  }),
};

// Schéma pour import XLSForm
export const importToolboxXlsFormSchema = {
  body: Joi.object({
    formKey: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9_-]+$/).optional(),
    formVersion: Joi.string().max(50).optional(),
    title: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(5000).optional().allow('', null),
  }).optional(),
};

// Schéma pour import XLSForm depuis URL
export const importToolboxXlsFormFromUrlSchema = {
  body: Joi.object({
    url: Joi.string().uri().required().messages({
      'string.uri': 'URL invalide',
      'any.required': 'L\'URL du fichier XLSForm est requise',
    }),
    formKey: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9_-]+$/).optional(),
    formVersion: Joi.string().max(50).optional(),
    title: Joi.string().min(1).max(255).optional(),
  }),
};

// Schéma pour liste soumissions (query params)
export const listToolboxSubmissionsSchema = {
  query: Joi.object({
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(500).default(100),
    format: Joi.string().valid('json', 'csv').default('json'),
    status: Joi.string().valid('draft', 'submitted', 'validated', 'rejected', 'synced').optional(),
    formKey: Joi.string().optional(),
    formVersion: Joi.string().optional(),
    role: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    search: JoiSchemas.search,
    sortBy: Joi.string().valid('savedAt', 'submittedAt', 'formKey', 'status').default('savedAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

// Schéma pour export soumissions
export const exportToolboxSubmissionsSchema = {
  query: Joi.object({
    format: Joi.string().valid('csv', 'xlsx', 'json', 'geojson', 'kml').default('csv'),
    limit: Joi.number().integer().min(1).max(5000).default(500),
    columns: Joi.string().optional(),
    status: Joi.string().valid('draft', 'submitted', 'validated', 'rejected', 'synced').optional(),
    formKey: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

// Schéma pour révision soumission
export const reviewToolboxSubmissionSchema = {
  body: Joi.object({
    status: Joi.string().valid('validated', 'rejected').required().messages({
      'any.required': 'Le statut (validated/rejected) est requis',
      'any.only': 'Le statut doit être "validated" ou "rejected"',
    }),
    reviewComment: Joi.string().max(5000).optional().allow('', null),
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

// Schéma pour suppression soumission
export const deleteToolboxSubmissionSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

// Schéma pour soumission toolbox
export const submitToolboxSubmissionSchema = {
  body: Joi.object({
    formKey: Joi.string().required(),
    formVersion: Joi.string().optional(),
    clientSubmissionId: Joi.string().required(),
    status: Joi.string().valid('draft', 'submitted').default('draft'),
    values: Joi.object().pattern(Joi.string(), Joi.any()).required(),
    metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    role: Joi.string().optional(),
    numeroOrdre: Joi.string().optional(),
    householdId: Joi.string().uuid().optional(),
  }),
};

// Schéma pour rapport queue client
export const reportToolboxClientQueueSchema = {
  body: Joi.object({
    queue: Joi.array().items(Joi.object({
      clientSubmissionId: Joi.string().required(),
      formKey: Joi.string().required(),
      formVersion: Joi.string().optional(),
      status: Joi.string().valid('draft', 'submitted', 'pending').default('pending'),
      values: Joi.object().pattern(Joi.string(), Joi.any()).required(),
      metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
      createdAt: Joi.date().iso().optional(),
      updatedAt: Joi.date().iso().optional(),
    })).min(1).required().messages({
      'array.min': 'Au moins une soumission est requise dans la queue',
      'any.required': 'La queue de soumissions est requise',
    }),
  }),
};

// Schéma pour diagnostics
export const getToolboxDiagnosticsSchema = {
  query: Joi.object({
    formKey: Joi.string().optional(),
    formVersion: Joi.string().optional(),
  }),
};

// Schéma pour stats formulaire
export const getToolboxFormStatsSchema = {
  query: Joi.object({
    formKey: Joi.string().optional(),
    formVersion: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

// Schéma pour comparaison formulaires
export const compareToolboxFormDefinitionsSchema = {
  params: Joi.object({
    formKey: Joi.string().required(),
    targetFormKey: Joi.string().required(),
  }),
  query: Joi.object({
    targetFormVersion: Joi.string().optional(),
  }),
};

// Schéma pour mise à jour statut définition
export const updateToolboxFormDefinitionStatusSchema = {
  body: Joi.object({
    status: Joi.string().valid('draft', 'published', 'archived').required().messages({
      'any.required': 'Le statut est requis',
      'any.only': 'Le statut doit être "draft", "published" ou "archived"',
    }),
  }),
  params: Joi.object({
    formKey: Joi.string().required(),
  }),
};
