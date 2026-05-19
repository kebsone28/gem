import prisma from '../../core/utils/prisma.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';
import EventPublisher from '../../core/utils/EventPublisher.js';

export class HealthService {
  /**
   * Créer un centre de santé via l'Adapter (Uniformité)
   */
  static async createHealthCenter(organizationId, projectId, rawData) {
    const adapter = DomainAdapterFactory.getAdapter('health');
    const normalized = await adapter.normalizeEntity(rawData);
    const validationErrors = adapter.validateEntity(normalized);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }
    const alerts = adapter.generateAlerts(normalized);
    const status = adapter.deriveStatus(normalized);
    
    const healthCenter = await prisma.healthCenter.create({
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
      type: 'health:center_created',
      resource: 'healthCenter',
      resourceId: healthCenter.id,
      data: { healthCenter }
    });

    return healthCenter;
  }

  /**
   * Créer une campagne via l'Adapter (Uniformité)
   */
  static async createCampaign(organizationId, projectId, rawData) {
    const campaign = await prisma.campaign.create({
      data: {
        organizationId,
        projectId,
        name: rawData.name,
        status: rawData.status || 'planned',
        domainData: rawData.domainData || {},
      }
    });

    await EventPublisher.publish({
      organizationId,
      projectId,
      type: 'health:campaign_created',
      resource: 'campaign',
      resourceId: campaign.id,
      data: { campaign }
    });

    return campaign;
  }
}
