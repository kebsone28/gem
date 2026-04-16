import twilio from 'twilio';
import sgMail from '@sendgrid/mail';
import logger from '../utils/logger.js';

// Initialiser les clients
const twilioClient = process.env.TWILIO_ACCOUNT_SID
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Envoyer un SMS via Twilio
 */
export async function sendSMSViaProvider(to, message) {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    logger.warn('[TWILIO] Client non configuré - SMS non envoyé');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const response = await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body: message,
    });

    logger.info(`[TWILIO] SMS envoyé (SID: ${response.sid})`);
    return { success: true, messageId: response.sid };
  } catch (error) {
    logger.error(`[TWILIO] Erreur SMS: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Envoyer un email via SendGrid
 */
export async function sendEmailViaProvider(to, subject, htmlContent) {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('[SENDGRID] API key non configuré - Email non envoyé');
    return { success: false, error: 'SendGrid not configured' };
  }

  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@proquelec.com',
      subject,
      html: htmlContent,
      replyTo: process.env.SENDGRID_REPLY_TO || 'support@proquelec.com',
    };

    const response = await sgMail.send(msg);

    logger.info(`[SENDGRID] Email envoyé à ${to}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    logger.error(`[SENDGRID] Erreur Email: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Vérifier si les fournisseurs sont configurés
 */
export function getNotificationStatus() {
  return {
    smsConfigured: !!(twilioClient && process.env.TWILIO_PHONE_NUMBER),
    emailConfigured: !!process.env.SENDGRID_API_KEY,
  };
}
