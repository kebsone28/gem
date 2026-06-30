import Joi from 'joi';

const attachmentSchema = Joi.object({
  fieldName: Joi.string().required(),
  fileName: Joi.string().optional(),
  mimeType: Joi.string().optional(),
  dataUrl: Joi.string().required(),
  capturedAt: Joi.string().isoDate().optional(),
  originalBytes: Joi.number().integer().positive().optional(),
});

export const submissionSchema = Joi.object({
  formKey: Joi.string().required().messages({
    'any.required': 'formKey est requis.',
    'string.empty': 'formKey ne doit pas être vide.',
  }),
  formVersion: Joi.string().default('1.0'),
  clientSubmissionId: Joi.string().required().messages({
    'any.required': 'clientSubmissionId est requis.',
    'string.empty': 'clientSubmissionId ne doit pas être vide.',
  }),
  status: Joi.string().valid('submitted', 'pending', 'error', 'synced').required().messages({
    'any.required': 'status est requis.',
    'string.empty': 'status ne doit pas être vide.',
    'any.only': 'Le statut doit être "submitted", "pending", "error" ou "synced".',
  }),
  values: Joi.object().pattern(Joi.string(), Joi.any()).required().messages({
    'any.required': 'values est requis.',
    'object.base': 'values doit être un objet.',
  }),
  metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  attachments: Joi.array().items(attachmentSchema).optional(),
});
