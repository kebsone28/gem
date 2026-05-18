/**
 * HighVoltageAdapter
 *
 * Domain adapter for high voltage power networks operations.
 * Handles Substations, Pylons, High Voltage Lines, and Maintenance.
 *
 * Registered under domainType: 'high_voltage'
 */

import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '../DomainAdapter';

export class HighVoltageAdapter implements DomainAdapter {
  domainType = 'high_voltage';

  async normalizeEntity(rawData: any): Promise<NormalizedEntity> {
    return {
      id: rawData.id || rawData.uuid,
      name: rawData.name || `HV Node ${rawData.id?.slice(0, 8)}`,
      location: rawData.location || (rawData.latitude && rawData.longitude
        ? { lat: rawData.latitude, lng: rawData.longitude }
        : undefined),
      status: rawData.status || 'operational',
      domainData: {
        type: rawData.type || 'substation', // "substation" | "pylon" | "line"
        voltageCapacity: rawData.voltageCapacity || null, // in kV
        currentLoad: rawData.currentLoad || 0,
        maxLoad: rawData.maxLoad || 100,
        lastMaintenance: rawData.lastMaintenance || null,
        nextMaintenance: rawData.nextMaintenance || null,
        connectedNodes: rawData.connectedNodes || [],
      },
      metadata: {
        source: rawData.source || 'scada',
        lastSync: new Date(),
      },
    };
  }

  validateEntity(entity: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const d = entity.domainData || {};

    if (!entity.name) {
      errors.push({ field: 'name', message: 'Name is required', code: 'REQUIRED' });
    }
    if (!['substation', 'pylon', 'line'].includes(d.type)) {
      errors.push({ field: 'type', message: 'Invalid node type', code: 'INVALID' });
    }
    if (d.voltageCapacity && isNaN(d.voltageCapacity)) {
      errors.push({ field: 'voltageCapacity', message: 'Voltage capacity must be a number', code: 'INVALID' });
    }

    return errors;
  }

  deriveStatus(entity: any): string {
    const { currentLoad, maxLoad, nextMaintenance } = entity.domainData || {};

    if (currentLoad >= maxLoad * 0.95) return 'overloaded';
    
    if (nextMaintenance && new Date(nextMaintenance) < new Date()) {
      return 'maintenance_overdue';
    }

    return 'operational';
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    const d = entity.domainData || {};
    
    // Overload alert
    if (d.currentLoad >= d.maxLoad * 0.9) {
      alerts.push({
        type: 'high_load',
        severity: d.currentLoad >= d.maxLoad ? 'critical' : 'high',
        message: `Network element is operating at ${(d.currentLoad/d.maxLoad*100).toFixed(1)}% capacity`,
        metadata: { loadRatio: d.currentLoad / d.maxLoad },
      });
    }

    // Maintenance alert
    if (d.nextMaintenance && new Date(d.nextMaintenance) < new Date()) {
      alerts.push({
        type: 'maintenance_required',
        severity: 'high',
        message: `Maintenance is overdue since ${new Date(d.nextMaintenance).toLocaleDateString()}`,
      });
    }

    return alerts;
  }

  getEntityFields(): string[] {
    return [
      'name', 'type', 'voltageCapacity', 'currentLoad', 'maxLoad', 
      'lastMaintenance', 'nextMaintenance', 'status'
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

  buildEntityQuery(filters: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};
    if (filters.status) where.status = filters.status;
    return { where };
  }
}
