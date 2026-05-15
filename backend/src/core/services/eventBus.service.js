import { EventEmitter } from 'events';
import prisma from '../utils/prisma.js';
import logger from '../../utils/logger.js';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setupInternalListeners();
  }

  /**
   * Émet un événement métier et le loggue de manière asynchrone
   */
  async publish(eventType, payload) {
    const { projectId, organizationId, userId, resource, resourceId, data, metadata } = payload;

    // 1. Émettre l'événement pour les listeners en temps réel (ex: Socket.io, Automations)
    this.emit(eventType, payload);

    // 2. Persister l'événement dans EventLog (Audit Trail Indélébile)
    try {
      await prisma.eventLog.create({
        data: {
          type: eventType,
          projectId,
          organizationId,
          userId,
          resource,
          resourceId,
          data: data || {},
          metadata: metadata || {}
        }
      });
      
      logger.info(`[EventBus] Persisted: ${eventType} on ${resource}:${resourceId}`);
    } catch (err) {
      logger.error(`[EventBus] Error persisting ${eventType}:`, err);
    }
  }

  /**
   * Configuration des écouteurs par défaut
   */
  setupInternalListeners() {
    // Listener pour la synchronisation en temps réel via Sockets (exemple)
    this.on('PROJECT_CREATED', (payload) => {
      logger.debug(`[EventBus] Automation: Project ${payload.resourceId} initialized.`);
    });

    this.on('MISSION_VALIDATED', (payload) => {
      logger.debug(`[EventBus] Automation: Mission ${payload.resourceId} validated, checking dependencies...`);
    });
  }
}

export const eventBus = new EventBus();
