/**
 * kobo.routes.js
 *
 * Routes for KoboToolbox synchronization.
 */

import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifyKoboWebhook } from '../../api/middlewares/koboWebhookAuth.js';
import { getKoboStatus, handleKoboWebhook, testKoboConnection, autoDetectMapping, getMapping, migrateMapping, transformData } from './kobo.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  testKoboConnectionSchema,
  autoDetectMappingSchema,
  getMappingSchema,
  migrateMappingSchema,
  transformDataSchema
} from './kobo.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Kobo
 *   description: KoboToolbox synchronization and data mapping
 */

/**
 * @swagger
 * /api/kobo/webhook:
 *   post:
 *     summary: Handle Kobo webhook notifications
 *     tags: [Kobo]
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
// Webhooks don't have JWT Authorization header, so we protect it with HMAC
router.post('/webhook', verifyKoboWebhook, handleKoboWebhook);

// Protected manual endpoints
router.use(authProtect);

/**
 * @swagger
 * /api/kobo/test-connection:
 *   post:
 *     summary: Test KoboToolbox connection
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               assetUid:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection successful
 */
router.post('/test-connection', validate(testKoboConnectionSchema), testKoboConnection);

/**
 * @swagger
 * /api/kobo/status:
 *   get:
 *     summary: Get the latest Kobo sync status
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kobo status retrieved
 */
router.get('/status', getKoboStatus);

// Mapping dynamique (Kobo Engine Master v2.0)
/**
 * @swagger
 * /api/kobo/auto-detect:
 *   post:
 *     summary: Auto-detect fields and generate mapping
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               koboAssetId:
 *                 type: string
 *               koboServerUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mapping generated successfully
 */
router.post('/auto-detect', validate(autoDetectMappingSchema), autoDetectMapping);

/**
 * @swagger
 * /api/kobo/mapping:
 *   get:
 *     summary: Get current Kobo mapping
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: koboAssetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current mapping retrieved
 */
router.get('/mapping', validate(getMappingSchema), getMapping);

/**
 * @swagger
 * /api/kobo/migrate:
 *   post:
 *     summary: Migrate mapping when form changes
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               koboAssetId:
 *                 type: string
 *               koboServerUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Migration successful
 */
router.post('/migrate', validate(migrateMappingSchema), migrateMapping);

/**
 * @swagger
 * /api/kobo/transform:
 *   post:
 *     summary: Transform Kobo data using mapping
 *     tags: [Kobo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               koboAssetId:
 *                 type: string
 *               koboData:
 *                 type: object
 *               koboServerUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Data transformed successfully
 */
router.post('/transform', validate(transformDataSchema), transformData);

export default router;
