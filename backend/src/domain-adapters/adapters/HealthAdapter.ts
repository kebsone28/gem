/**
 * HealthAdapter
 *
 * Domain adapter for health sector operations.
 * Handles HealthCenters, Campaigns (vaccination, screening), and Patient tracking.
 *
 * Registered under domainType: 'health'
 */

import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '../DomainAdapter';

export class HealthAdapter implements DomainAdapter {
  domainType = 'health';

  async normalizeEntity(rawData: any): Promise<NormalizedEntity> {
    return {
      id: rawData.id || rawData.uuid,
      name: rawData.name || rawData.facilityName || `Health Center ${rawData.id?.slice(0, 8)}`,
      location: rawData.location || (rawData.latitude && rawData.longitude
        ? { lat: rawData.latitude, lng: rawData.longitude }
        : undefined),
      status: rawData.status || 'operational',
      domainData: {
        type: rawData.type || 'clinic',          // "clinic" | "hospital" | "maternity" | "post"
        // Infrastructure
        beds: rawData.beds || 0,
        equipment: rawData.equipment || {},
        medications: rawData.medications || {},
        // Staffing
        staff: rawData.staff || [],
        // Campaigns
        activeCampaigns: rawData.activeCampaigns || [],
        // Stats
        weeklyPatients: rawData.weeklyPatients || 0,
        coverageRate: rawData.coverageRate || null,
        // Location
        region: rawData.region || null,
        district: rawData.district || null,
      },
      metadata: {
        source: rawData.source || 'manual',
        lastSync: new Date(),
      },
    };
  }

  validateEntity(entity: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const d = entity.domainData || {};

    if (!entity.name) {
      errors.push({ field: 'name', message: 'Health center name is required', code: 'REQUIRED' });
    }
    if (!entity.location?.lat || !entity.location?.lng) {
      errors.push({ field: 'location', message: 'Location is required', code: 'REQUIRED' });
    }
    if (!['clinic', 'hospital', 'maternity', 'post', 'pharmacy'].includes(d.type)) {
      errors.push({ field: 'type', message: 'Invalid facility type', code: 'INVALID' });
    }
    if (d.beds !== undefined && (isNaN(d.beds) || d.beds < 0)) {
      errors.push({ field: 'beds', message: 'Beds must be a non-negative number', code: 'INVALID' });
    }

    return errors;
  }

  deriveStatus(entity: any): string {
    const { beds, staff, medications } = entity.domainData || {};

    if (!staff || staff.length === 0) return 'unstaffed';

    // Check critical medication stock
    const meds = medications || {};
    const criticalShortage = Object.values(meds).some((qty: any) => qty === 0);
    if (criticalShortage) return 'critical_shortage';

    if (!beds || beds < 2) return 'understaffed';

    return 'operational';
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    const d = entity.domainData || {};

    // No staff
    if (!d.staff || d.staff.length === 0) {
      alerts.push({
        type: 'no_staff',
        severity: 'critical',
        message: 'Health center has no registered staff',
        metadata: { staffCount: 0 },
      });
    }

    // Medication shortage
    const meds = d.medications || {};
    const outOfStock = Object.entries(meds)
      .filter(([, qty]) => (qty as number) === 0)
      .map(([name]) => name);

    if (outOfStock.length > 0) {
      alerts.push({
        type: 'medication_shortage',
        severity: outOfStock.length >= 3 ? 'critical' : 'high',
        message: `Out of stock: ${outOfStock.join(', ')}`,
        metadata: { medications: outOfStock },
      });
    }

    // Low coverage rate
    if (d.coverageRate !== null && d.coverageRate < 50) {
      alerts.push({
        type: 'low_coverage',
        severity: d.coverageRate < 30 ? 'high' : 'medium',
        message: `Coverage rate is critically low: ${d.coverageRate}%`,
        metadata: { coverageRate: d.coverageRate },
      });
    }

    // Overcapacity
    if (d.weeklyPatients && d.beds && d.weeklyPatients > d.beds * 14) {
      alerts.push({
        type: 'overcapacity',
        severity: 'high',
        message: `Weekly patient load (${d.weeklyPatients}) exceeds bed capacity`,
        metadata: { weeklyPatients: d.weeklyPatients, beds: d.beds },
      });
    }

    return alerts;
  }

  getEntityFields(): string[] {
    return [
      'name', 'type', 'beds', 'staff', 'medications',
      'equipment', 'activeCampaigns', 'weeklyPatients',
      'coverageRate', 'status', 'region', 'district',
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

    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.region) {
      where.domainData = { path: ['region'], equals: filters.region };
    }
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    return { where };
  }
}
