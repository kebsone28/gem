/**
 * SolarAdapter
 *
 * Domain adapter for solar panel installations (mini-grids, home systems).
 * Handles Panels, Inverters, Batteries, and Energy Generation Tracking.
 *
 * Registered under domainType: 'solar'
 */

import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '../DomainAdapter';

export class SolarAdapter implements DomainAdapter {
  domainType = 'solar';

  async normalizeEntity(rawData: any): Promise<NormalizedEntity> {
    return {
      id: rawData.id || rawData.uuid,
      name: rawData.name || `Solar System ${rawData.id?.slice(0, 8)}`,
      location: rawData.location || (rawData.latitude && rawData.longitude
        ? { lat: rawData.latitude, lng: rawData.longitude }
        : undefined),
      status: rawData.status || 'active',
      domainData: {
        systemType: rawData.systemType || 'shs', // "shs" (Solar Home System) | "mini_grid"
        capacityWp: rawData.capacityWp || null,
        batteryCapacityAh: rawData.batteryCapacityAh || null,
        dailyGenerationWh: rawData.dailyGenerationWh || 0,
        batteryHealth: rawData.batteryHealth || 100, // percentage
        installationDate: rawData.installationDate || null,
      },
      metadata: {
        source: rawData.source || 'manual',
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
    const { batteryHealth, dailyGenerationWh } = entity.domainData || {};

    if (batteryHealth !== null && batteryHealth < 40) return 'degraded';
    if (dailyGenerationWh === 0 && entity.domainData.installationDate && new Date(entity.domainData.installationDate) < new Date()) {
       // Only if it's supposed to be active but generating 0
       return 'faulty';
    }

    return 'active';
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    const d = entity.domainData || {};
    
    if (d.batteryHealth !== null && d.batteryHealth < 50) {
      alerts.push({
        type: 'battery_degradation',
        severity: d.batteryHealth < 20 ? 'critical' : 'high',
        message: `Battery health has dropped to ${d.batteryHealth}%`,
      });
    }

    return alerts;
  }

  getEntityFields(): string[] {
    return [
      'name', 'systemType', 'capacityWp', 'batteryCapacityAh', 
      'dailyGenerationWh', 'batteryHealth', 'status'
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
