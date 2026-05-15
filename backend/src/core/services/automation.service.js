import prisma from '../utils/prisma.js';
import { eventBus } from './eventBus.service.js';
import logger from '../../utils/logger.js';

class AutomationService {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    // 🎧 Écouter les événements métier pour préparer des actions
    eventBus.on('WORKFLOW_TRANSITION', async (event) => {
      if (event.data?.to === 'APPROVED' && event.resource === 'MISSION') {
        await this.prepareClientReport(event);
      }
    });

    eventBus.on('PROJECT_CREATED', async (event) => {
      await this.queueWelcomeAutomation(event);
    });
  }

  /**
   * Prépare un rapport pour le client mais le met en attente de validation
   */
  async prepareClientReport(event) {
    const { projectId, organizationId, resourceId } = event;

    logger.info(`[AutomationService] Préparation du rapport client pour Mission ${resourceId}`);

    // Ici, on simulerait la génération d'un contenu pro
    // Dans GED OS réel, on appellerait le DocumentService ou GED IA
    const payload = {
      recipient: "client@example.com",
      subject: `Rapport d'intervention : Mission ${resourceId}`,
      content: `L'intervention sur le site ${resourceId} a été validée. Voici les détails...`,
      attachments: [`report_${resourceId}.pdf`]
    };

    try {
      await prisma.automatedAction.create({
        data: {
          organizationId,
          projectId,
          type: 'SEND_CLIENT_REPORT',
          status: 'PENDING', // 🛡️ SÉCURITÉ : Toujours en attente par défaut
          payload,
          triggeredBy: `EVENT:WORKFLOW_TRANSITION:${event.type}`
        }
      });
      logger.info(`[AutomationService] Action 'SEND_CLIENT_REPORT' mise en file d'attente pour validation Admin.`);
    } catch (err) {
      logger.error(`[AutomationService] Erreur lors de la mise en file d'attente :`, err);
    }
  }

  /**
   * Exécute une action après validation humaine
   */
  async executeAction(actionId, userId) {
    const action = await prisma.automatedAction.findUnique({
      where: { id: actionId }
    });

    if (!action || action.status !== 'PENDING') {
      throw new Error("Action non valide ou déjà traitée.");
    }

    // TODO: Intégration avec un service d'envoi (Email, SMS, API externe)
    logger.info(`[AutomationService] EXECUTION FINALE de l'action ${action.type} par l'admin ${userId}`);

    await prisma.automatedAction.update({
      where: { id: actionId },
      data: {
        status: 'EXECUTED',
        validatedById: userId,
        executedAt: new Date()
      }
    });

    return { success: true };
  }

  async queueWelcomeAutomation(event) {
    // Exemple d'action de bienvenue
  }
}

export const automationService = new AutomationService();
