import express from 'express';
import multer from 'multer';
import { authProtect, authorize } from '../../api/middlewares/auth.js';
import {
  compareToolboxFormDefinitions,
  createToolboxFormDefinition,
  deleteToolboxFormDefinition,
  exportToolboxSubmissions,
  exportToolboxMedia,
  getToolboxDiagnostics,
  getToolboxFormDefinition,
  getToolboxFormStats,
  getToolboxImportedFormDefinition,
  getToolboxSubmission,
  deleteToolboxSubmission,
  importToolboxXlsForm,
  importToolboxXlsFormFromUrl,
  listToolboxFormDefinitions,
  listToolboxSubmissions,
  reportToolboxClientQueue,
  reviewToolboxSubmission,
  submitToolboxSubmission,
  updateToolboxFormDefinitionStatus,
} from './toolbox.controller.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(authProtect);

router.get('/form-definition', authorize('toolbox.settings.read'), getToolboxFormDefinition);
router.get('/form-definitions', authorize('toolbox.settings.read'), listToolboxFormDefinitions);
router.get('/form-definitions/:formKey/compare/:targetFormKey', authorize('toolbox.settings.read'), compareToolboxFormDefinitions);
router.patch('/form-definitions/:formKey/status', authorize('toolbox.settings.manage'), updateToolboxFormDefinitionStatus);
router.delete('/form-definitions/:formKey', authorize('toolbox.settings.manage'), deleteToolboxFormDefinition);
router.post('/form-definition/create', authorize('toolbox.settings.manage'), createToolboxFormDefinition);
router.post('/form-definition/import', authorize('toolbox.settings.manage'), upload.single('file'), importToolboxXlsForm);
router.post('/form-definition/import-url', authorize('toolbox.settings.manage'), importToolboxXlsFormFromUrl);
router.get('/form-definitions/:formKey', authorize('toolbox.settings.read'), getToolboxImportedFormDefinition);
router.get('/diagnostics', authorize('toolbox.settings.read'), getToolboxDiagnostics);
router.get('/form-stats', authorize('toolbox.settings.read'), getToolboxFormStats);
router.post('/client-queue-report', reportToolboxClientQueue);
router.get('/submissions', authorize('toolbox.submission.edit'), listToolboxSubmissions);
router.get('/submissions/export', authorize('toolbox.submission.edit'), exportToolboxSubmissions);
router.get('/submissions/export-media', authorize('toolbox.submission.edit'), exportToolboxMedia);
router.patch('/submissions/:id/review', authorize('toolbox.submission.validate'), reviewToolboxSubmission);
router.delete('/submissions/:id', authorize('toolbox.submission.delete'), deleteToolboxSubmission);
router.get('/submissions/:id', authorize('toolbox.submission.edit'), getToolboxSubmission);
router.post('/submissions', authorize('toolbox.submission.create'), submitToolboxSubmission);

export default router;
