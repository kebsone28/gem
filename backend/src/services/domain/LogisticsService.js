import prisma from '../../core/utils/prisma.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';
import EventPublisher from '../../core/utils/EventPublisher.js';

export class LogisticsService {
  /**
   * Créer un entrepôt via l'Adapter (Uniformité)
   */
  static async createWarehouse(organizationId, projectId, rawData) {
    const adapter = DomainAdapterFactory.getAdapter('gem');
    const normalized = await adapter.normalizeEntity(rawData);
    const validationErrors = adapter.validateEntity(normalized);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }
    const alerts = adapter.generateAlerts(normalized);
    const status = adapter.deriveStatus(normalized);
    
    const warehouse = await prisma.warehouse.create({
      data: {
        id: normalized.id,
        organizationId,
        projectId,
        name: normalized.name,
        location: normalized.location,
        domainData: normalized.domainData,
        status: status,
        alerts: alerts,
      }
    });

    await EventPublisher.publish({
      organizationId,
      projectId,
      type: 'logistics:warehouse_created',
      resource: 'warehouse',
      resourceId: warehouse.id,
      data: { warehouse }
    });

    return warehouse;
  }

  /**
   * Créer une livraison/expédition via l'Adapter (Uniformité)
   */
  static async createShipment(organizationId, projectId, rawData) {
    const shipment = await prisma.shipment.create({
      data: {
        organizationId,
        projectId,
        name: rawData.name,
        status: rawData.status || 'pending',
        domainData: rawData.domainData || {},
      }
    });

    await EventPublisher.publish({
      organizationId,
      projectId,
      type: 'logistics:shipment_created',
      resource: 'shipment',
      resourceId: shipment.id,
      data: { shipment }
    });

    return shipment;
  }
}
