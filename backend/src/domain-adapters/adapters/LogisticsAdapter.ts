/**
 * LogisticsAdapter
 *
 * Domain adapter for logistics & supply chain operations.
 * Handles Warehouses, Shipments, Stock management and delivery tracking.
 *
 * Registered under domainType: 'logistics'
 */

import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '../DomainAdapter';

export class LogisticsAdapter implements DomainAdapter {
  domainType = 'logistics';

  async normalizeEntity(rawData: any): Promise<NormalizedEntity> {
    return {
      id: rawData.id || rawData.uuid,
      name: rawData.name || rawData.warehouseName || `Warehouse ${rawData.id?.slice(0, 8)}`,
      location: rawData.location || (rawData.latitude && rawData.longitude
        ? { lat: rawData.latitude, lng: rawData.longitude }
        : undefined),
      status: rawData.status || 'operational',
      domainData: {
        capacity: rawData.capacity || null,         // tonnes
        // Stock
        stock: rawData.stock || [],                 // [{name, qty, unit, minAlert}]
        stockValue: rawData.stockValue || 0,
        // Shipments
        activeShipments: rawData.activeShipments || 0,
        pendingDeliveries: rawData.pendingDeliveries || 0,
        // Performance
        fulfillmentRate: rawData.fulfillmentRate || null,
        avgDeliveryDays: rawData.avgDeliveryDays || null,
        // Location
        region: rawData.region || null,
        address: rawData.address || null,
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
      errors.push({ field: 'name', message: 'Warehouse name is required', code: 'REQUIRED' });
    }
    if (!entity.location?.lat || !entity.location?.lng) {
      errors.push({ field: 'location', message: 'Warehouse location is required', code: 'REQUIRED' });
    }
    if (d.capacity !== null && d.capacity !== undefined && (isNaN(d.capacity) || d.capacity <= 0)) {
      errors.push({ field: 'capacity', message: 'Capacity must be a positive number (tonnes)', code: 'INVALID' });
    }

    return errors;
  }

  deriveStatus(entity: any): string {
    const { stock, capacity, fulfillmentRate } = entity.domainData || {};

    // Check for critical stock shortages
    const criticalItems = (stock || []).filter(
      (item: any) => item.minAlert !== undefined && item.qty <= item.minAlert
    );

    if (criticalItems.length >= 3) return 'critical_shortage';

    if (fulfillmentRate !== null && fulfillmentRate < 60) return 'understocked';

    if (capacity && stock) {
      const totalQty = stock.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
      if (totalQty >= capacity * 0.95) return 'full';
    }

    return 'operational';
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    const d = entity.domainData || {};

    // Stock threshold alerts
    const lowStockItems = (d.stock || []).filter(
      (item: any) => item.minAlert !== undefined && item.qty <= item.minAlert
    );

    lowStockItems.forEach((item: any) => {
      alerts.push({
        type: 'low_stock',
        severity: item.qty === 0 ? 'critical' : 'high',
        message: item.qty === 0
          ? `Out of stock: ${item.name}`
          : `Low stock: ${item.name} (${item.qty} ${item.unit || 'units'}, min: ${item.minAlert})`,
        metadata: { itemName: item.name, qty: item.qty, minAlert: item.minAlert },
      });
    });

    // Low fulfillment rate
    if (d.fulfillmentRate !== null && d.fulfillmentRate < 70) {
      alerts.push({
        type: 'low_fulfillment',
        severity: d.fulfillmentRate < 50 ? 'critical' : 'high',
        message: `Fulfillment rate is ${d.fulfillmentRate}% (target: 90%+)`,
        metadata: { fulfillmentRate: d.fulfillmentRate },
      });
    }

    // Overdue deliveries
    if (d.pendingDeliveries > 10) {
      alerts.push({
        type: 'delivery_backlog',
        severity: d.pendingDeliveries > 25 ? 'high' : 'medium',
        message: `${d.pendingDeliveries} pending deliveries in queue`,
        metadata: { pendingDeliveries: d.pendingDeliveries },
      });
    }

    // High average delivery time
    if (d.avgDeliveryDays && d.avgDeliveryDays > 7) {
      alerts.push({
        type: 'slow_delivery',
        severity: d.avgDeliveryDays > 14 ? 'high' : 'medium',
        message: `Average delivery time is ${d.avgDeliveryDays} days (target: ≤3 days)`,
        metadata: { avgDeliveryDays: d.avgDeliveryDays },
      });
    }

    return alerts;
  }

  getEntityFields(): string[] {
    return [
      'name', 'capacity', 'stock', 'stockValue',
      'activeShipments', 'pendingDeliveries',
      'fulfillmentRate', 'avgDeliveryDays',
      'status', 'region', 'address',
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
