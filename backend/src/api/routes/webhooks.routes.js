/**
 * Webhooks Routes — GED OS Toolbox
 * Permet de gérer les webhooks REST (KoboToolbox REST Services-like)
 * Routes :
 *   POST /api/webhooks/receive — Réception de webhooks externes (confirmation delivery)
 *   GET  /api/webhooks/config  — Configuration des webhooks par organization
 *   POST /api/webhooks/config  — Créer une config webhook
 *   DELETE /api/webhooks/config/:id — Supprimer une config
 */
import express, { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { authProtect, authorize } from '../middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import { handleIncomingWebhook } from '../../services/webhook.service.js';
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

const router = Router();

const webhookConfigLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes webhook.', code: 'WEBHOOK_RATE_LIMIT' },
  skip: () => process.env.NODE_ENV === 'development',
});

// ── Webhook entrant (sans auth, signature HMAC) ──
router.post(
  '/webhooks/receive',
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  handleIncomingWebhook
);

// ── Routes protégées ──
router.use(authProtect);

// Lister les configurations webhook de l'organisation
router.get('/webhooks/config', authorize('toolbox.settings.read'), async (req, res) => {
  try {
    const configs = await prisma.toolboxFormHook.findMany({
      where: {
        organizationId: req.user.organizationId,
        type: 'webhook',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        active: true,
        lastTriggeredAt: true,
        lastStatus: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, configs });
  } catch (err) {
    logger.error('[WEBHOOK] list configs error:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur chargement webhooks' });
  }
});

// Créer une configuration webhook
router.post(
  '/webhooks/config',
  authorize('toolbox.settings.manage'),
  webhookConfigLimiter,
  validate({
    body: {
      name: Joi.string().trim().min(1).max(100).required(),
      url: Joi.string().uri().required(),
      secret: Joi.string().allow('').optional(),
      events: Joi.array()
        .items(
          Joi.string().valid(
            'submission.create',
            'submission.update',
            'submission.delete',
            'form.deploy',
            'form.archive'
          )
        )
        .min(1)
        .required(),
      active: Joi.boolean().optional().default(true),
    },
  }),
  async (req, res) => {
    try {
      const config = await prisma.toolboxFormHook.create({
        data: {
          organizationId: req.user.organizationId,
          name: req.body.name,
          url: req.body.url,
          secret: req.body.secret || null,
          events: req.body.events,
          type: 'webhook',
          active: req.body.active !== false,
          createdBy: req.user.id,
        },
      });
      logger.info(`[WEBHOOK] Config created: ${config.id} for ${req.body.url}`);
      return res.status(201).json({ success: true, config });
    } catch (err) {
      logger.error('[WEBHOOK] create config error:', err.message);
      return res.status(500).json({ success: false, message: 'Erreur création webhook' });
    }
  }
);

// Supprimer une configuration
router.delete(
  '/webhooks/config/:id',
  authorize('toolbox.settings.manage'),
  validate({ params: { id: Joi.string().uuid().required() } }),
  async (req, res) => {
    try {
      const existing = await prisma.toolboxFormHook.findFirst({
        where: { id: req.params.id, organizationId: req.user.organizationId },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Webhook config not found' });
      }
      await prisma.toolboxFormHook.delete({ where: { id: req.params.id } });
      return res.json({ success: true, message: 'Webhook config supprimée' });
    } catch (err) {
      logger.error('[WEBHOOK] delete config error:', err.message);
      return res.status(500).json({ success: false, message: 'Erreur suppression webhook' });
    }
  }
);

export default router;
