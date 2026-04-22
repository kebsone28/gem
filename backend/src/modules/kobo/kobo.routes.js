/**
 * kobo.routes.js
 *
 * Routes for KoboToolbox synchronization.
 *   GET  /api/kobo/status — Get last Kobo sync status
 */

import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifyKoboWebhook } from '../../api/middlewares/koboWebhookAuth.js';
import { getKoboStatus, handleKoboWebhook, testKoboConnection, autoDetectMapping, getMapping, migrateMapping, transformData } from './kobo.controller.js';

const router = Router();

// Webhooks don't have JWT Authorization header, so we protect it with HMAC
router.post('/webhook', verifyKoboWebhook, handleKoboWebhook);

// Protected manual endpoints
router.use(authProtect);

router.post('/test-connection', testKoboConnection);
router.get('/status',  getKoboStatus);

// Mapping dynamique (Kobo Engine Master v2.0)
router.post('/auto-detect', autoDetectMapping);     // Auto-détection des champs
router.get('/mapping', getMapping);                 // Obtenir le mapping actuel
router.post('/migrate', migrateMapping);            // Migrer lors de changement de formulaire
router.post('/transform', transformData);           // Transformer des données avec le mapping

export default router;
