import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
    getInternalKoboDiagnostics,
    getInternalKoboFormDefinition,
    getInternalKoboSubmission,
    listInternalKoboSubmissions,
    submitInternalKoboSubmission
} from './internalKobo.controller.js';

const router = express.Router();

router.use(authProtect);

router.get('/form-definition', getInternalKoboFormDefinition);
router.get('/diagnostics', getInternalKoboDiagnostics);
router.get('/submissions', listInternalKoboSubmissions);
router.get('/submissions/:id', getInternalKoboSubmission);
router.post('/submissions', submitInternalKoboSubmission);

export default router;
