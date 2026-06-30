import express from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { authProtect } from '../../api/middlewares/auth.js';
import { authorize } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getToolboxFormDefinition,
  listToolboxFormDefinitions,
  compareToolboxFormDefinitions,
  updateToolboxFormDefinitionStatus,
  updateToolboxFormDefinition,
  deleteToolboxFormDefinition,
  createToolboxFormDefinition,
  importToolboxXlsForm,
  importToolboxXlsFormFromUrl,
  getToolboxImportedFormDefinition,
  getToolboxDiagnostics,
  getToolboxFormStats,
  reportToolboxClientQueue,
  listToolboxSubmissions,
  exportToolboxSubmissions,
  exportToolboxMedia,
  reviewToolboxSubmission,
  deleteToolboxSubmission,
  getToolboxSubmission,
  submitToolboxSubmission,
  exportToolboxSubmissionPdf,
  listToolboxFormTemplates,
  getToolboxFormTemplate,
  uploadToolboxMedia,
} from './toolbox.controller.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import {
  createToolboxFormDefinitionSchema,
  updateToolboxFormDefinitionSchema,
  importToolboxXlsFormSchema,
  importToolboxXlsFormFromUrlSchema,
  listToolboxSubmissionsSchema,
  exportToolboxSubmissionsSchema,
  reviewToolboxSubmissionSchema,
  deleteToolboxSubmissionSchema,
  submitToolboxSubmissionSchema,
  reportToolboxClientQueueSchema,
  getToolboxDiagnosticsSchema,
  getToolboxFormStatsSchema,
  compareToolboxFormDefinitionsSchema,
  updateToolboxFormDefinitionStatusSchema,
} from './toolbox.validation.schemas.js';

const router = express.Router();

// Rate limiter pour les endpoints de configuration (settings)
const toolboxSettingsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes. Réessayez dans une minute.',
    code: 'TOOLBOX_SETTINGS_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiter pour les soumissions (plus permissif pour usage mobile)
const toolboxSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de soumissions. Réessayez dans une minute.',
    code: 'TOOLBOX_SUBMISSION_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiter pour exports (lourds)
const toolboxExportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop d'exports demandés. Réessayez dans une minute.",
    code: 'TOOLBOX_EXPORT_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

router.use(authProtect);

// =============================================
// Form Templates (Pré-faits)
// =============================================

router.get('/form-templates', listToolboxFormTemplates);
router.get('/form-templates/:key', getToolboxFormTemplate);

// =============================================
// Form Definitions (Settings)
// =============================================

router.get('/form-definition', authorize('toolbox.settings.read'), getToolboxFormDefinition);
router.get('/form-definitions', authorize('toolbox.settings.read'), listToolboxFormDefinitions);
router.get(
  '/form-definitions/:formKey/compare/:targetFormKey',
  authorize('toolbox.settings.read'),
  validate(compareToolboxFormDefinitionsSchema),
  compareToolboxFormDefinitions
);
router.put(
  '/form-definitions/:formKey',
  authorize('toolbox.settings.manage'),
  validate(updateToolboxFormDefinitionSchema),
  updateToolboxFormDefinition
);
router.patch(
  '/form-definitions/:formKey/status',
  authorize('toolbox.settings.manage'),
  validate(updateToolboxFormDefinitionStatusSchema),
  updateToolboxFormDefinitionStatus
);
router.delete(
  '/form-definitions/:formKey',
  authorize('toolbox.settings.manage'),
  validate({ params: { formKey: Joi.string().required() } }),
  deleteToolboxFormDefinition
);
router.post(
  '/form-definition/create',
  authorize('toolbox.settings.manage'),
  toolboxSettingsLimiter,
  validate(createToolboxFormDefinitionSchema),
  createToolboxFormDefinition
);
router.post(
  '/form-definition/import',
  authorize('toolbox.settings.manage'),
  toolboxSettingsLimiter,
  validate(importToolboxXlsFormSchema),
  importToolboxXlsForm
);
router.post(
  '/form-definition/import-url',
  authorize('toolbox.settings.manage'),
  toolboxSettingsLimiter,
  validate(importToolboxXlsFormFromUrlSchema),
  importToolboxXlsFormFromUrl
);
router.get(
  '/form-definitions/:formKey',
  authorize('toolbox.settings.read'),
  validate({ params: { formKey: Joi.string().required() } }),
  getToolboxImportedFormDefinition
);

// =============================================
// Diagnostics & Stats
// =============================================

router.get(
  '/diagnostics',
  authorize('toolbox.settings.read'),
  validate(getToolboxDiagnosticsSchema),
  getToolboxDiagnostics
);
router.get(
  '/form-stats',
  authorize('toolbox.settings.read'),
  validate(getToolboxFormStatsSchema),
  getToolboxFormStats
);

// =============================================
// Submissions
// =============================================

router.post(
  '/client-queue-report',
  toolboxSubmissionLimiter,
  validate(reportToolboxClientQueueSchema),
  reportToolboxClientQueue
);

router.get(
  '/submissions',
  authorize('toolbox.submission.edit'),
  validate(listToolboxSubmissionsSchema),
  listToolboxSubmissions
);
router.get(
  '/submissions/export',
  authorize('toolbox.submission.edit'),
  toolboxExportLimiter,
  validate(exportToolboxSubmissionsSchema),
  exportToolboxSubmissions
);
router.get(
  '/submissions/export-media',
  authorize('toolbox.submission.edit'),
  toolboxExportLimiter,
  exportToolboxMedia
);

router.get(
  '/submissions/:id',
  authorize('toolbox.submission.edit'),
  validate({ params: { id: Joi.string().uuid().required() } }),
  getToolboxSubmission
);
router.post(
  '/submissions',
  authorize('toolbox.submission.create'),
  toolboxSubmissionLimiter,
  validate(submitToolboxSubmissionSchema),
  submitToolboxSubmission
);
router.patch(
  '/submissions/:id/review',
  authorize('toolbox.submission.validate'),
  validate(reviewToolboxSubmissionSchema),
  reviewToolboxSubmission
);
router.get(
  '/submissions/:id/pdf',
  authorize('toolbox.submission.edit'),
  validate({ params: { id: Joi.string().uuid().required() } }),
  exportToolboxSubmissionPdf
);

router.delete(
  '/submissions/:id',
  authorize('toolbox.submission.delete'),
  validate(deleteToolboxSubmissionSchema),
  deleteToolboxSubmission
);

// =============================================
// Media Upload (Standalone)
// =============================================

router.post(
  '/media/upload',
  authorize('toolbox.settings.manage'),
  toolboxSubmissionLimiter,
  validate({
    body: Joi.object({
      formKey: Joi.string().required(),
      fieldName: Joi.string().required(),
      fileName: Joi.string().required(),
      mimeType: Joi.string().required(),
      dataUrl: Joi.string().required(),
      originalBytes: Joi.number().optional(),
    }),
  }),
  uploadToolboxMedia
);

export default router;
