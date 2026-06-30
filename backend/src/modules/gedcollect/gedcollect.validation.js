import Joi from 'joi';
import { JoiSchemas } from '../../middleware/validate.js';

/**
 * Schémas de validation Joi pour le module gedcollect
 * Utilise le middleware validate() existant
 */

// Schémas d'authentification PIN
const phoneSchema = Joi.string().min(8).max(20).pattern(/^[\d\s\-\+\(\)]+$/).required().messages({
  'string.min': 'Le numéro de téléphone doit contenir au moins 8 caractères',
  'string.max': 'Le numéro de téléphone ne peut pas dépasser 20 caractères',
  'string.pattern.base': 'Format de numéro de téléphone invalide',
  'any.required': 'Le numéro de téléphone est requis',
});

const pinSchema = Joi.string().min(4).max(6).pattern(/^\d+$/).required().messages({
  'string.min': 'Le PIN doit contenir au moins 4 chiffres',
  'string.max': 'Le PIN ne peut pas dépasser 6 chiffres',
  'string.pattern.base': 'Le PIN doit contenir uniquement des chiffres',
  'any.required': 'Le PIN est requis',
});

export const registerPinSchema = {
  body: Joi.object({
    phone: phoneSchema,
    pin: pinSchema,
  }),
};

export const loginWithPinSchema = {
  body: Joi.object({
    phone: phoneSchema,
    pin: pinSchema,
  }),
};

// Schéma pour la liste des formulaires (query params)
export const getAssignedFormsSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('all', 'active', 'draft').optional(),
  }),
};

// Schéma pour créer une assignation
export const createAssignmentSchema = {
  body: Joi.object({
    userId: JoiSchemas.id,
    formKey: Joi.string().min(1).max(100).required().messages({
      'string.min': 'La clé de formulaire est requise',
      'string.max': 'La clé de formulaire ne peut pas dépasser 100 caractères',
      'any.required': 'formKey est requis',
    }),
    role: Joi.string().valid('collector', 'supervisor', 'viewer').default('collector'),
  }),
};

// Schéma pour supprimer une assignation (params)
export const deleteAssignmentSchema = {
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

// Schéma pour créer un utilisateur gedcollect
export const createGedcollectUserSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'any.required': 'Le nom est requis',
    }),
    phone: Joi.string().min(8).max(20).pattern(/^[\d\s\-\+\(\)]+$/).required().messages({
      'string.min': 'Le numéro de téléphone doit contenir au moins 8 caractères',
      'string.pattern.base': 'Format de numéro de téléphone invalide',
      'any.required': 'Le numéro de téléphone est requis',
    }),
    email: Joi.string().email().optional().allow('', null),
    role: Joi.string().valid('collector', 'supervisor', 'admin').default('collector'),
    language: Joi.string().valid('fr', 'en').default('fr'),
  }),
};

// Schéma pour mise à jour utilisateur (toggle activation, set phone)
export const updateGedcollectUserSchema = {
  body: Joi.object({
    phone: Joi.string().min(8).max(20).pattern(/^[\d\s\-\+\(\)]+$/).optional(),
    active: Joi.boolean().optional(),
    role: Joi.string().valid('collector', 'supervisor', 'admin').optional(),
    language: Joi.string().valid('fr', 'en').optional(),
  }).min(1).messages({
    'object.min': 'Au moins un champ doit être fourni pour la mise à jour',
  }),
  params: Joi.object({
    id: JoiSchemas.id,
  }),
};

// Schéma pour liste des soumissions (query params)
export const listSubmissionsSchema = {
  query: Joi.object({
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(200).default(50),
    format: Joi.string().valid('json', 'csv').default('json'),
    formKey: Joi.string().optional(),
    status: Joi.string().valid('draft', 'pending', 'syncing', 'synced', 'error').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

// Schéma pour liste des formulaires admin
export const listFormsSchema = {
  query: Joi.object({
    offset: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(200).default(50),
    search: JoiSchemas.search,
  }),
};
