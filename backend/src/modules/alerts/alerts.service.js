/**
 * Service Alertes - Logique métier du flux d'alertes
 * Gère: notifications, escalade, règles, déclenchement automatique
 */

import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { sendSMSViaProvider, sendEmailViaProvider } from '../../services/notificationProviders.js';

const buildSmsMessage = (params = {}) => {
  if (params.message) return params.message;

  const severity = params.severity || 'INFO';
  const title = params.title || 'Alerte';
  const description = params.description ? `\n${params.description}` : '';
  return `🚨 ALERTE ${severity}: ${title}${description}`;
};

const buildEmailPayload = (params = {}) => {
  const alertData = params.alertData || {};
  const subject = params.subject || `Alerte: ${params.title || alertData.title || 'Notification'}`;
  const severity = params.severity || alertData.severity || 'INFO';
  const type = params.type || alertData.type || 'SYSTEM';
  const description = params.description || alertData.message || alertData.description || '';

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d32f2f; margin-bottom: 10px;">🚨 ALERTE: ${subject}</h2>
          <p><strong>Sévérité:</strong> ${severity}</p>
          <p><strong>Type:</strong> ${type}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>${description}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">
            Alerte générée le ${new Date().toLocaleString('fr-FR')}
          </p>
        </div>
      </body>
    </html>
  `;

  return { subject, htmlContent };
};

export async function sendSMSAlert(params = {}) {
  const alertId = params.alertId;
  const to = params.to || params.phoneNumber;
  const message = buildSmsMessage(params);

  if (!to || !message) {
    return { success: false, error: 'Missing recipient or message' };
  }

  try {
    const result = await sendSMSViaProvider(to, message);

    if (result.success && alertId) {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          smsNotified: true,
          smsNotifiedAt: new Date(),
        },
      });
    }

    return result;
  } catch (error) {
    logger.error(`[ALERTS] Erreur SMS: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendEmailAlert(params = {}) {
  const alertId = params.alertId;
  const to = params.to || params.email;
  const { subject, htmlContent } = buildEmailPayload(params);

  if (!to) {
    return { success: false, error: 'Missing email recipient' };
  }

  try {
    const result = await sendEmailViaProvider(to, subject, htmlContent);

    if (result.success && alertId) {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          emailNotified: true,
          emailNotifiedAt: new Date(),
        },
      });
    }

    return result;
  } catch (error) {
    logger.error(`[ALERTS] Erreur Email: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function handleEscalation(params = null) {
  try {
    if (params?.organizationId) {
      const alertsToEscalate = await prisma.alert.findMany({
        where: {
          organizationId: params.organizationId,
          status: 'OPEN',
        },
      });

      let escalatedCount = 0;
      const now = Date.now();
      const thresholdMs = (params.escalationDelay || 0) * 1000;

      for (const alert of alertsToEscalate) {
        const createdAt = alert.createdAt ? new Date(alert.createdAt).getTime() : now;
        if (now - createdAt < thresholdMs) continue;

        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            status: 'ESCALATED',
            escalatedAt: new Date(),
          },
        });

        escalatedCount += 1;
      }

      return { escalatedCount };
    }

    if (!prisma.alertConfiguration?.findMany) {
      logger.warn('[ALERTS] prisma.alertConfiguration.findMany unavailable. Skipping escalation.');
      return { escalatedCount: 0, skipped: true };
    }

    const configs = await prisma.alertConfiguration.findMany({});
    let escalatedCount = 0;

    for (const config of configs) {
      const now = new Date();
      const escalationThresholdTime = new Date(now.getTime() - config.escalationDelay * 1000);

      const alertsToEscalate = await prisma.alert.findMany({
        where: {
          organizationId: config.organizationId,
          severity: { in: ['CRITICAL', 'HIGH'] },
          status: { in: ['OPEN'] },
          createdAt: { lt: escalationThresholdTime },
          escalatedAt: null,
        },
      });

      for (const alert of alertsToEscalate) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            status: 'ESCALATED',
            escalatedAt: new Date(),
            escalationLevel: (alert.escalationLevel || 0) + 1,
            escalationNotificationSent: true,
            metadata: {
              ...(alert.metadata || {}),
              escalationReason: 'No acknowledgment within threshold',
              escalationTime: new Date().toISOString(),
            },
          },
        });

        escalatedCount += 1;

        if (config.escalationLoop) {
          await alertsService.triggerNotifications(alert);
        }
      }
    }

    return { escalatedCount };
  } catch (err) {
    logger.error('[ALERTS] handleEscalation error:', err);
    return { escalatedCount: 0, error: err.message };
  }
}

export async function createIGPPAlerts(projectIdOrParams, kpiDataArg = {}) {
  try {
    const params =
      typeof projectIdOrParams === 'object' && projectIdOrParams !== null
        ? projectIdOrParams
        : { projectId: projectIdOrParams, kpiData: kpiDataArg };

    let { projectId, organizationId, kpiData = {} } = params;

    if (!organizationId && projectId && prisma.project?.findUnique) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      organizationId = project?.organizationId;
    }

    if (!organizationId) {
      return { alertsCreated: 0, duplicatesPrevented: 0, skipped: 'missing organization' };
    }

    const existingAlerts = prisma.alert.findMany
      ? await prisma.alert.findMany({
          where: {
            projectId,
            status: 'OPEN',
          },
        })
      : [];

    const hasOpenAlert = (type) =>
      Array.isArray(existingAlerts) && existingAlerts.some((alert) => alert.type === type);

    let duplicatesPrevented = ['IGPP_STOCK', 'IGPP_BUDGET', 'IGPP_ELECTRICITY'].reduce(
      (count, type) => (hasOpenAlert(type) ? count + 1 : count),
      0
    );

    const config = prisma.alertConfiguration?.findFirst
      ? await prisma.alertConfiguration.findFirst({ where: { organizationId } })
      : await prisma.alertConfiguration.findUnique?.({ where: { organizationId } });

    if (!config) {
      return { alertsCreated: 0, duplicatesPrevented, skipped: 'missing configuration' };
    }

    const alertsToCreate = [];

    const kitPrepared = Number(kpiData.kitPrepared ?? Number.NaN);
    if (Number.isFinite(kitPrepared) && Number.isFinite(config.stockCritical) && kitPrepared < config.stockCritical) {
      if (hasOpenAlert('IGPP_STOCK')) {
        duplicatesPrevented += 1;
      } else {
        alertsToCreate.push({
          organizationId,
          projectId,
          type: 'IGPP_STOCK',
          severity: 'critical',
          status: 'OPEN',
          message: `Stock niveau critique (${kitPrepared})`,
        });
      }
    }

    const budgetUsagePercent = Number(kpiData.budgetUsagePercent ?? Number.NaN);
    if (
      Number.isFinite(budgetUsagePercent) &&
      Number.isFinite(config.budgetThreshold) &&
      budgetUsagePercent > config.budgetThreshold
    ) {
      if (hasOpenAlert('IGPP_BUDGET')) {
        duplicatesPrevented += 1;
      } else {
        alertsToCreate.push({
          organizationId,
          projectId,
          type: 'IGPP_BUDGET',
          severity: 'high',
          status: 'OPEN',
          message: `Budget seuil dépassé (${budgetUsagePercent}%)`,
        });
      }
    }

    const electricityAccess = Number(
      kpiData.electricityAccess ?? kpiData.electrifiedHouseholds ?? Number.NaN
    );
    if (
      Number.isFinite(electricityAccess) &&
      Number.isFinite(config.electricityMin) &&
      electricityAccess < config.electricityMin
    ) {
      if (hasOpenAlert('IGPP_ELECTRICITY')) {
        duplicatesPrevented += 1;
      } else {
        alertsToCreate.push({
          organizationId,
          projectId,
          type: 'IGPP_ELECTRICITY',
          severity: 'medium',
          status: 'OPEN',
          message: `Accès électricité insuffisant (${electricityAccess})`,
        });
      }
    }

    let alertsCreated = 0;
    for (const alert of alertsToCreate) {
      if (prisma.alert.create) {
        await prisma.alert.create({ data: alert });
        alertsCreated += 1;
      }
    }

    return { alertsCreated, duplicatesPrevented };
  } catch (err) {
    logger.error('[ALERTS] createIGPPAlerts error:', err);
    return { alertsCreated: 0, duplicatesPrevented: 0, error: err.message };
  }
}

export const alertsService = {
  /**
   * Déclenche les notifications SMS/Email pour une alerte critique
   */
  async triggerNotifications(alert) {
    try {
      const config = await prisma.alertConfiguration.findUnique({
        where: { organizationId: alert.organizationId },
      });

      if (!config) return;

      // Récupérer les informations du destinataire
      let household = null;
      if (alert.householdId) {
        household = await prisma.household.findUnique({
          where: { id: alert.householdId },
        });
      }

      const phoneNumber = household?.phone;
      const email = household?.owner?.email || '';

      // Envoyer SMS si activé
      if (config.enableSMS && phoneNumber) {
        await sendSMSAlert({
          alertId: alert.id,
          to: phoneNumber,
          title: alert.title,
          type: alert.type,
        });
      }

      // Envoyer Email si activé
      if (config.enableEmail && email) {
        await sendEmailAlert({
          alertId: alert.id,
          to: email,
          title: alert.title,
          description: alert.description,
          type: alert.type,
          severity: alert.severity,
        });
      }

      // Mettre à jour le flag de notification
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          notified: true,
          smsNotified: config.enableSMS && !!phoneNumber,
          emailNotified: config.enableEmail && !!email,
        },
      });

      logger.info(`[ALERTS] Notifications sent for alert ${alert.id}`);
    } catch (err) {
      logger.error('[ALERTS] triggerNotifications error:', err);
    }
  },

  /**
   * Envoie un SMS via Twilio (réel)
   */
  sendSMSAlert,

  /**
   * Envoie un email via SendGrid (réel)
   */
  sendEmailAlert,

  /**
   * Gère l'escalade automatique des alertes critiques non reconnues
   */
  handleEscalation,

  /**
   * Crée les alertes IGPP basées sur les KPI du projet
   */
  createIGPPAlerts,

  /**
   * Crée une alerte PV automatiquement
   */
  async createPVAlert(householdId, pvType, metadata = {}) {
    try {
      const household = await prisma.household.findUnique({
        where: { id: householdId },
      });

      if (!household) return;

      const severityMap = {
        PVHSE: 'CRITICAL',
        PVRES: 'CRITICAL',
        PVNC: 'HIGH',
        PVRET: 'HIGH',
        PVR: 'LOW',
        PVRD: 'MEDIUM',
      };

      const alert = await prisma.alert.create({
        data: {
          organizationId: household.organizationId,
          projectId: household.zone?.projectId || 'unknown',
          householdId,
          type: pvType,
          severity: severityMap[pvType] || 'MEDIUM',
          title: `${pvType} généré pour ${household.name || 'Ménage inconnu'}`,
          description: `Un procès-verbal de type ${pvType} a été automatiquement généré.`,
          recommendedAction: `Consulter le PV et signer électroniquement dans votre espace GEM.`,
          metadata,
          status: 'OPEN',
        },
      });

      // Déclencher notifications si critique
      if (severityMap[pvType] === 'CRITICAL') {
        await this.triggerNotifications(alert);
      }

      return alert;
    } catch (err) {
      logger.error('[ALERTS] createPVAlert error:', err);
    }
  },

  /**
   * Résout automatiquement une alerte quand son objet est réglé
   * Ex: PVNC -> RESOLVED quand PVR généré
   */
  async resolveRelatedAlerts(householdId, pvType) {
    try {
      // Si PVR généré, résoudre PVNC
      if (pvType === 'PVR') {
        await prisma.alert.updateMany({
          where: {
            householdId,
            type: 'PVNC',
            status: 'OPEN',
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            metadata: {
              resolutionReason: 'PVR generated',
            },
          },
        });
      }

      // Si PVRD généré, résoudre PVHSE
      if (pvType === 'PVRD') {
        await prisma.alert.updateMany({
          where: {
            householdId,
            type: { in: ['PVHSE', 'PVRET'] },
            status: 'OPEN',
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            metadata: {
              resolutionReason: 'PVRD generated',
            },
          },
        });
      }
    } catch (err) {
      logger.error('[ALERTS] resolveRelatedAlerts error:', err);
    }
  },
};
