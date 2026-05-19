import eventBus from './eventBus.js';
import prisma from './prisma.js';

/**
 * EventPublisher — Centralized service for publishing standardized domain events
 * across all GED OS modules. Emits to the in-memory eventBus and persists
 * the event to the EventLog DB table.
 */
export class EventPublisher {
  /**
   * Publishes a standardized domain event.
   * 
   * @param {Object} event
   * @param {string} event.organizationId
   * @param {string} [event.projectId]
   * @param {string} [event.userId]
   * @param {string} event.type - Event type (e.g., "field.created", "household.status_changed")
   * @param {string} event.resource - Domain resource/entity type (e.g., "field", "household", "healthCenter")
   * @param {string} [event.resourceId] - ID of the mutated entity
   * @param {Object} [event.data] - Main payload (e.g., { previousState, newState })
   * @param {Object} [event.metadata] - Extra context (e.g., ipAddress, userAgent)
   */
  static async publish(event) {
    const {
      organizationId,
      projectId,
      userId,
      type,
      resource,
      resourceId,
      data = {},
      metadata = {},
    } = event;

    const enrichedEvent = {
      ...event,
      timestamp: new Date(),
    };

    // 1. Emit to in-memory NodeJS event bus for real-time reactive workflows
    eventBus.emit(type, enrichedEvent);

    // 2. Persist asynchronously in the database EventLog table for audit/compliance
    try {
      await prisma.eventLog.create({
        data: {
          organizationId,
          projectId,
          userId,
          type,
          resource,
          resourceId,
          data,
          metadata,
        },
      });
    } catch (err) {
      console.error(`[EventPublisher] Failed to persist event log for ${type}:`, err.message);
    }
  }
}

export default EventPublisher;
