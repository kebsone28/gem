/**
 * kobo.routes.js
 *
 * Routes for KoboToolbox synchronization.
 *   POST /api/kobo/sync   — Trigger a Kobo sync
 *   GET  /api/kobo/status — Get last Kobo sync status
 */

import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { triggerKoboSync, getKoboStatus } from './kobo.controller.js';

const router = Router();

router.use(authProtect);

router.post('/sync',   triggerKoboSync);
router.get('/status',  getKoboStatus);

export default router;
