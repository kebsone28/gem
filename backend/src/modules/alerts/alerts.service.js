/**
 * Service Alertes - Logique métier du flux d'alertes
 * Gère: notifications, escalade, règles, déclenchement automatique
 */

import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { sendSMSViaProvider, sendEmailViaProvider } from '../../services/notificationProviders.js';

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
        await this.sendSMSAlert({
          alertId: alert.id,
          to: phoneNumber,
          title: alert.title,
          type: alert.type,
        });
      }

      // Envoyer Email si activé
      if (config.enableEmail && email) {
        await this.sendEmailAlert({
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
  async sendSMSAlert(params) {
    const { alertId, to, title, description, _type, severity } = params;

    try {
      const message = `🚨 ALERTE ${severity}: ${title}\n${description}`;
      const result = await sendSMSViaProvider(to, message);

      if (result.success) {
        logger.info(`[ALERTS] SMS envoyé pour l'alerte ${alertId}`);
        await prisma.alert.update({
          where: { id: alertId },
          data: { smsNotified: true },
        });
      } else {
        logger.warn(`[ALERTS] SMS échoué pour l'alerte ${alertId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error(`[ALERTS] Erreur SMS: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Envoie un email via SendGrid (réel)
   */
  async sendEmailAlert(params) {
    const { alertId, to, title, description, type, severity } = params;

    try {
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #d32f2f; margin-bottom: 10px;">🚨 ALERTE: ${title}</h2>
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

      const result = await sendEmailViaProvider(to, `Alerte: ${title}`, htmlContent);

      if (result.success) {
        logger.info(`[ALERTS] Email envoyé pour l'alerte ${alertId}`);
        await prisma.alert.update({
          where: { id: alertId },
          data: { emailNotified: true },
        });
      } else {
        logger.warn(`[ALERTS] Email échoué pour l'alerte ${alertId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error(`[ALERTS] Erreur Email: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Gère l'escalade automatique des alertes critiques non reconnues
   */
  async handleEscalation() {
    try {
      if (!prisma.alertConfiguration) {
        logger.warn('[ALERTS] prisma.alertConfiguration is undefined. Skipping escalation (Prisma client might need regeneration).');
        return;
      }
      const configs = await prisma.alertConfiguration.findMany({});

      for (const config of configs) {
        const now = new Date();
        const escalationThresholdTime = new Date(
          now.getTime() - config.escalationDelay * 1000
        );

        // Trouver les alertes non reconnues depuis trop longtemps
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
              escalationLevel: alert.escalationLevel + 1,
              escalationNotificationSent: true,
              metadata: {
                ...(alert.metadata || {}),
                escalationReason: 'No acknowledgment within threshold',
                escalationTime: new Date().toISOString(),
              },
            },
          });

          // Re-notifier si la configuration le permet
          if (config.escalationLoop) {
            await this.triggerNotifications(alert);
          }

          logger.info(`[ALERTS] Alert ${alert.id} escalated to level ${alert.escalationLevel + 1}`);
        }
      }
    } catch (err) {
      logger.error('[ALERTS] handleEscalation error:', err);
    }
  },

  /**
   * Crée les alertes IGPP basées sur les KPI du projet
   */
  async createIGPPAlerts(projectId, kpiData) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) return;

      const config = await prisma.alertConfiguration.findUnique({
        where: { organizationId: project.organizationId },
      });

      if (!config) return;

      const alertsToCreate = [];

      // Stock critique
      if (kpiData.stockAlerts && kpiData.stockAlerts.length > config.stockCritical) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            projectId,
            type: 'IGPP_STOCK',
            status: 'OPEN',
          },
        });

        if (!existingAlert) {
          alertsToCreate.push({
            organizationId: project.organizationId,
            projectId,
            type: 'IGPP_STOCK',
            severity: 'HIGH',
            title: `Stock critique détecté (${kpiData.stockAlerts.length} alertes)`,
            description: `Le nombre d'alertes stock dépasse le seuil de ${config.stockCritical}`,
            recommendedAction: 'Consulter le dashboard logistique et réapprovisionner',
            metadata: { alertCount: kpiData.stockAlerts.length },
            status: 'OPEN',
          });
        }
      }

      // Budget épuisé
      if (kpiData.budgetUsagePercent && kpiData.budgetUsagePercent > config.budgetThreshold) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            projectId,
            type: 'IGPP_BUDGET',
            status: 'OPEN',
          },
        });

        if (!existingAlert) {
          alertsToCreate.push({
            organizationId: project.organizationId,
            projectId,
            type: 'IGPP_BUDGET',
            severity: 'HIGH',
            title: `Budget épuisé à ${kpiData.budgetUsagePercent}%`,
            description: `L'utilisation du budget dépasse le seuil de ${config.budgetThreshold}%`,
            recommendedAction: 'Revoir les dépenses ou demander une augmentation de budget',
            metadata: { usagePercent: kpiData.budgetUsagePercent },
            status: 'OPEN',
          });
        }
      }

      // Électricité faible
      if (kpiData.electricityAccess && kpiData.electricityAccess < config.electricityMin) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            projectId,
            type: 'IGPP_ELECTRICITY',
            status: 'OPEN',
          },
        });

        if (!existingAlert) {
          alertsToCreate.push({
            organizationId: project.organizationId,
            projectId,
            type: 'IGPP_ELECTRICITY',
            severity: 'MEDIUM',
            title: `Accès électricité faible (${kpiData.electricityAccess}%)`,
            description: `L'accès électricité est en dessous du seuil de ${config.electricityMin}%`,
            recommendedAction: 'Vérifier les installations électriques',
            metadata: { electricityPercent: kpiData.electricityAccess },
            status: 'OPEN',
          });
        }
      }

      // Créer les alertes en masse
      if (alertsToCreate.length > 0) {
        await prisma.alert.createMany({
          data: alertsToCreate,
          skipDuplicates: true,
        });

        logger.info(`[ALERTS] Created ${alertsToCreate.length} IGPP alerts for project ${projectId}`);
      }
    } catch (err) {
      logger.error('[ALERTS] createIGPPAlerts error:', err);
    }
  },

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
