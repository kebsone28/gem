/**
 * kobo.routes.js
 *
 * Routes for KoboToolbox synchronization.
 *   POST /api/kobo/sync   — Trigger a Kobo sync
 *   GET  /api/kobo/status — Get last Kobo sync status
 */

import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifyKoboWebhook } from '../../api/middlewares/koboWebhookAuth.js';
import { triggerKoboSync, getKoboStatus, handleKoboWebhook, testKoboConnection } from './kobo.controller.js';

const router = Router();

// Webhooks don't have JWT Authorization header, so we protect it with HMAC
router.post('/webhook', verifyKoboWebhook, handleKoboWebhook);

// Protected manual endpoints
router.use(authProtect);

router.post('/sync',   triggerKoboSync);
router.post('/test-connection', testKoboConnection);
router.get('/status',  getKoboStatus);

export default router;
