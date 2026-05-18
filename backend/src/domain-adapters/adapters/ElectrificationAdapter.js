/**
 * ElectrificationAdapter
 *
 * Legacy wrapper for GEM (Gestion Électrification Massive)
 * Adapts existing Household model to multidomaine DomainAdapter pattern
 *
 * This is a SHORT-TERM adapter. Eventually Household-specific
 * logic will be refactored into this adapter.
 */
export class ElectrificationAdapter {
    constructor() {
        this.domainType = 'electricity';
    }
    /**
     * Normalize raw household data to standard format
     */
    async normalizeEntity(rawData) {
        // For now, return as-is with basic transformation
        // In future, apply Kobo normalization here
        return {
            id: rawData.id || rawData.uuid || rawData.numeroordre,
            name: rawData.name || `Household ${rawData.numeroordre}`,
            location: rawData.location ||
                (rawData.latitude && rawData.longitude
                    ? {
                        lat: rawData.latitude,
                        lng: rawData.longitude,
                    }
                    : undefined),
            status: rawData.status || 'planning',
            domainData: {
                numeroordre: rawData.numeroordre,
                owner: rawData.owner,
                koboData: rawData.koboData || {},
                voltage: rawData.voltage || null,
                connectionDate: rawData.connectionDate,
                region: rawData.region,
                departement: rawData.departement,
                village: rawData.village,
                phone: rawData.phone,
                source: rawData.source,
                // ... other electricity fields
            },
            metadata: {
                source: 'kobo' || rawData.source,
                lastSync: new Date(),
            },
        };
    }
    /**
     * Validate household according to electricity rules
     */
    validateEntity(entity) {
        const errors = [];
        // Required fields
        if (!entity.name) {
            errors.push({
                field: 'name',
                message: 'Household name is required',
                code: 'REQUIRED',
            });
        }
        if (!entity.location?.lat || !entity.location?.lng) {
            errors.push({
                field: 'location',
                message: 'Location (latitude, longitude) is required',
                code: 'REQUIRED',
            });
        }
        // Domain-specific rules
        if (entity.domainData?.numeroordre && typeof entity.domainData.numeroordre !== 'string') {
            errors.push({
                field: 'numeroordre',
                message: 'Household order number must be string',
                code: 'TYPE_ERROR',
            });
        }
        return errors;
    }
    /**
     * Derive status from household data
     * Electricity-specific status logic
     */
    deriveStatus(entity) {
        const { status, voltage, connectionDate } = entity.domainData || {};
        // If explicitly set, use that
        if (status && ['planning', 'connected', 'maintenance', 'disconnected'].includes(status)) {
            return status;
        }
        // Infer from voltage
        if (voltage && voltage > 200) {
            return 'connected';
        }
        // Infer from connection date
        if (connectionDate) {
            return 'connected';
        }
        return 'planning';
    }
    /**
     * Generate electricity-specific alerts
     */
    generateAlerts(entity) {
        const alerts = [];
        const { voltage, status } = entity.domainData || {};
        // Low voltage alert
        if (voltage && voltage < 180) {
            alerts.push({
                type: 'low_voltage',
                severity: voltage < 150 ? 'critical' : 'high',
                message: `Voltage is low: ${voltage}V (normal: 220V)`,
                metadata: { voltage },
            });
        }
        // Status issues
        if (status === 'maintenance') {
            alerts.push({
                type: 'maintenance_required',
                severity: 'medium',
                message: 'Household requires maintenance',
                metadata: { status },
            });
        }
        if (status === 'disconnected') {
            alerts.push({
                type: 'disconnection',
                severity: 'high',
                message: 'Household is disconnected',
                metadata: { status },
            });
        }
        return alerts;
    }
    /**
     * Fields to display/monitor for electricity domain
     */
    getEntityFields() {
        return [
            'name',
            'numeroordre',
            'phone',
            'status',
            'voltage',
            'connectionDate',
            'region',
            'departement',
            'village',
        ];
    }
    /**
     * Optimal query shape for Household entity
     */
    getOptimalQueryShape() {
        return {
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                latitude: true,
                longitude: true,
                location: true,
                numeroordre: true,
                region: true,
                departement: true,
                village: true,
                owner: true,
                koboData: true,
                alerts: true,
                updatedAt: true,
                // Don't select large fields by default
                // constructionData: false,
            },
        };
    }
    /**
     * Build query for households with filters
     */
    buildEntityQuery(filters) {
        const where = {};
        if (filters.organizationId) {
            where.organizationId = filters.organizationId;
        }
        if (filters.projectId) {
            where.projectId = filters.projectId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.region) {
            where.region = filters.region;
        }
        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { numeroordre: { contains: filters.search, mode: 'insensitive' } },
                { phone: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return { where };
    }
}
