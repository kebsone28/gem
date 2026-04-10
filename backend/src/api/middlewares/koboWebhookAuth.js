import crypto from 'crypto';
import { config } from '../../core/config/config.js';

/**
 * Middleware to verify KoboToolbox HMAC-SHA256 webhook signatures.
 * Requires the raw body to check the signature properly.
 */
export const verifyKoboWebhook = (req, res, next) => {
    try {
        const koboSignature = req.headers['x-kobo-webhook-signature'];
        
        if (!koboSignature) {
            console.warn('[WEBHOOK] Missing X-Kobo-Webhook-Signature header.');
            return res.status(401).json({ error: 'Missing security signature' });
        }

        const secret = config.kobo?.webhookSecret || process.env.KOBO_WEBHOOK_SECRET;

        if (!secret) {
            console.error('[WEBHOOK] KOBO_WEBHOOK_SECRET is not configured on the server.');
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        // We assume req.rawBody contains the raw unprocessed payload string.
        // Express needs `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })`
        const payload = req.rawBody || JSON.stringify(req.body);
        
        // Kobo computes signature using HMAC-SHA256 and base64 encodes it.
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('base64');

        if (koboSignature !== expectedSignature) {
            console.warn('[WEBHOOK] Security mismatch. Invalid signature attempt.', {
                expected: expectedSignature,
                received: koboSignature
            });
            return res.status(403).json({ error: 'Invalid crypto signature' });
        }

        return next();
    } catch (error) {
        console.error('[WEBHOOK-AUTH] Error checking signature:', error);
        return res.status(500).json({ error: 'Internal server error validating webhook' });
    }
};
