import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
    getInternalKoboSubmission,
    listInternalKoboSubmissions,
    submitInternalKoboSubmission
} from './internalKobo.controller.js';

const router = express.Router();

router.use(authProtect);

router.get('/submissions', listInternalKoboSubmissions);
router.get('/submissions/:id', getInternalKoboSubmission);
router.post('/submissions', submitInternalKoboSubmission);

export default router;
