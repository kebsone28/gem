/**
 * Webhook Service — Envoi de notifications HTTP pour les soumissions
 * Permet à GED OS Toolbox de notifier des systèmes externes (Slack, Zapier, API custom)
 * comme KoboToolbox REST Services, mais avec retry, signature HMAC et file d'attente.
 */
import crypto from 'crypto';
import logger from '../utils/logger.js';
import prisma from '../core/utils/prisma.js';

/**
 * @typedef {Object} WebhookPayload
 * @property {'submission.create'|'submission.update'|'submission.delete'|'form.deploy'|'form.archive'} event
 * @property {string} formKey
 * @property {string} [submissionId]
 * @property {string} [clientSubmissionId]
 * @property {string} timestamp
 * @property {Object} [data]
 */

/**
 * @typedef {Object} WebhookConfig
 * @property {string} url
 * @property {string} [secret]
 * @property {string[]} events
 * @property {number} [retryCount]
 * @property {number} [timeout]
 * @property {string} [hookId]
 * @property {string} [organizationId]
 */

const DEFAULT_TIMEOUT = 15000; // 15s
const MAX_RETRIES = 3;

/** @type {Array<{ config: WebhookConfig, payload: WebhookPayload, retriesLeft: number }>} */
const WEBHOOK_QUEUE = [];

/**
 * Signe un payload HMAC-SHA256 pour vérifier l'intégrité côté récepteur
 * @param {WebhookPayload} payload
 * @param {string} secret
 * @returns {string}
 */
function signPayload(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Log une exécution de webhook dans la base de données
 * @param {WebhookConfig} config
 * @param {WebhookPayload} payload
 * @param {boolean} success
 * @param {number} [responseStatus]
 * @param {string} [responseBody]
 * @param {string} [error]
 */
async function logWebhookExecution(config, payload, success, responseStatus, responseBody, error) {
  try {
    await prisma.toolboxWebhookExecution.create({
      data: {
        hookId: config.hookId || 'unknown',
        organizationId: config.organizationId || 'unknown',
        event: payload.event,
        submissionId: payload.submissionId,
        clientSubmissionId: payload.clientSubmissionId,
        formKey: payload.formKey,
        payload: payload.data || {},
        responseStatus,
        responseBody: responseBody?.slice(0, 1000),
        success,
        error,
      },
    });
  } catch (e) {
    logger.error('[Webhook] Failed to log execution:', e.message);
  }
}

/**
 * Envoie un webhook avec retry et timeout
 * @param {WebhookConfig} config
 * @param {WebhookPayload} payload
 * @returns {Promise<boolean>}
 */
async function sendWebhook(config, payload) {
  const url = config.url;
  const timeout = config.timeout || DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    /** @type {Record<string, string>} */
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'GED-OS-Webhook/1.0',
      'X-Webhook-Event': payload.event,
    };

    if (config.secret) {
      headers['X-Webhook-Signature'] = signPayload(payload, config.secret);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseBody = await response.text().catch(() => '');
    const success = response.ok;

    await logWebhookExecution(
      config,
      payload,
      success,
      response.status,
      responseBody,
      success ? null : `HTTP ${response.status}`
    );

    if (!success) {
      logger.warn(`[Webhook] HTTP ${response.status} from ${url}`);
      return false;
    }

    logger.info(`[Webhook] Successfully sent ${payload.event} to ${url}`);
    return true;
  } catch (error) {
    const message = error.name === 'AbortError' ? `Timeout after ${timeout}ms` : error.message;
    await logWebhookExecution(config, payload, false, null, null, message);
    if (error.name === 'AbortError') {
      logger.error(`[Webhook] Timeout after ${timeout}ms for ${url}`);
    } else {
      logger.error(`[Webhook] Failed to send to ${url}: ${error.message}`);
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Traite la file d'attente des webhooks en échec
 * @returns {Promise<void>}
 */
async function processRetryQueue() {
  while (WEBHOOK_QUEUE.length > 0) {
    const job = WEBHOOK_QUEUE.shift();
    if (!job) continue;

    const success = await sendWebhook(job.config, job.payload);
    if (!success && job.retriesLeft > 0) {
      const backoff = Math.pow(2, MAX_RETRIES - job.retriesLeft + 1) * 1000;
      logger.info(`[Webhook] Will retry in ${backoff}ms (${job.retriesLeft} retries left)`);
      setTimeout(() => {
        WEBHOOK_QUEUE.push({ ...job, retriesLeft: job.retriesLeft - 1 });
        processRetryQueue();
      }, backoff);
    }
  }
}

/**
 * Déclenche un événement webhook pour toutes les configurations abonnées
 * @param {WebhookConfig[]} configs Liste des webhooks configurés
 * @param {WebhookPayload} payload Données de l'événement
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function triggerWebhooks(configs, payload) {
  let sent = 0;
  let failed = 0;

  const relevantConfigs = configs.filter((cfg) => cfg.events.includes(payload.event));

  for (const config of relevantConfigs) {
    const success = await sendWebhook(config, payload);
    if (success) {
      sent++;
    } else {
      failed++;
      WEBHOOK_QUEUE.push({ config, payload, retriesLeft: MAX_RETRIES });
    }
  }

  if (WEBHOOK_QUEUE.length > 0) {
    processRetryQueue();
  }

  return { sent, failed };
}

/**
 * Route handler Express pour gérer les webhooks entrants (ex: confirmation de livraison)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function handleIncomingWebhook(req, res) {
  const signature = req.headers['x-webhook-signature'];
  const secret = req.query.secret;

  if (secret && signature) {
    const expected = signPayload(req.body, secret);
    if (expected !== signature) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  // Traitement générique : logging + réponse
  logger.info(`[Webhook] Received ${req.body?.event || 'unknown'} from ${req.ip}`);
  res.status(200).json({ received: true });
}
