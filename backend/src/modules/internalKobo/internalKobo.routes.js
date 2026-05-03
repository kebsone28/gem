import express from 'express';
import multer from 'multer';
import { authProtect } from '../../api/middlewares/auth.js';
import {
    exportInternalKoboSubmissions,
    getInternalKoboDiagnostics,
    getInternalKoboFormDefinition,
    getInternalKoboImportedFormDefinition,
    getInternalKoboSubmission,
    importInternalKoboXlsForm,
    listInternalKoboFormDefinitions,
    listInternalKoboSubmissions,
    reviewInternalKoboSubmission,
    submitInternalKoboSubmission
} from './internalKobo.controller.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

router.use(authProtect);

router.get('/form-definition', getInternalKoboFormDefinition);
router.get('/form-definitions', listInternalKoboFormDefinitions);
router.get('/form-definitions/:formKey', getInternalKoboImportedFormDefinition);
router.post('/form-definition/import', upload.single('file'), importInternalKoboXlsForm);
router.get('/diagnostics', getInternalKoboDiagnostics);
router.get('/submissions', listInternalKoboSubmissions);
router.get('/submissions/export', exportInternalKoboSubmissions);
router.patch('/submissions/:id/review', reviewInternalKoboSubmission);
router.get('/submissions/:id', getInternalKoboSubmission);
router.post('/submissions', submitInternalKoboSubmission);

export default router;
