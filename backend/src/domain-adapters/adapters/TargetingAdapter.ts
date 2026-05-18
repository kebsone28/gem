/**
 * TargetingAdapter
 *
 * Domain adapter for targeting operations (Ciblage).
 * Handles identification of eligible populations, geographic clusters, and socioeconomic surveys.
 *
 * Registered under domainType: 'targeting'
 */

import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '../DomainAdapter';

export class TargetingAdapter implements DomainAdapter {
  domainType = 'targeting';

  async normalizeEntity(rawData: any): Promise<NormalizedEntity> {
    return {
      id: rawData.id || rawData.uuid,
      name: rawData.name || `Target ${rawData.id?.slice(0, 8)}`,
      location: rawData.location || (rawData.latitude && rawData.longitude
        ? { lat: rawData.latitude, lng: rawData.longitude }
        : undefined),
      status: rawData.status || 'identified',
      domainData: {
        score: rawData.score || 0, // Socioeconomic score
        eligibilityStatus: rawData.eligibilityStatus || 'pending', // "eligible" | "ineligible" | "pending"
        vulnerabilityFactors: rawData.vulnerabilityFactors || [],
        householdSize: rawData.householdSize || null,
        incomeLevel: rawData.incomeLevel || null,
      },
      metadata: {
        source: rawData.source || 'survey',
        lastSync: new Date(),
      },
    };
  }

  validateEntity(entity: any): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!entity.name) {
      errors.push({ field: 'name', message: 'Name is required', code: 'REQUIRED' });
    }
    return errors;
  }

  deriveStatus(entity: any): string {
    const { eligibilityStatus } = entity.domainData || {};
    if (eligibilityStatus === 'eligible') return 'approved';
    if (eligibilityStatus === 'ineligible') return 'rejected';
    return 'identified';
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    const d = entity.domainData || {};
    
    if (d.vulnerabilityFactors && d.vulnerabilityFactors.length >= 3) {
      alerts.push({
        type: 'high_vulnerability',
        severity: 'high',
        message: `Subject has multiple vulnerability factors: ${d.vulnerabilityFactors.join(', ')}`,
      });
    }

    return alerts;
  }

  getEntityFields(): string[] {
    return [
      'name', 'score', 'eligibilityStatus', 'vulnerabilityFactors', 
      'householdSize', 'incomeLevel', 'status'
    ];
  }

  getOptimalQueryShape(): Record<string, any> {
    return {
      select: {
        id: true,
        name: true,
        status: true,
        location: true,
        domainData: true,
        alerts: true,
        updatedAt: true,
      },
    };
  }
}
