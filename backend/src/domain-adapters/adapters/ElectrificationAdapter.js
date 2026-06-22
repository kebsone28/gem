import { HOUSEHOLD_STATUS, DOMAIN_TYPES } from '../../core/config/businessRules.js';

// Technical statuses (physical state of the electrical connection)
const TECH_STATUS = {
  PLANNING: 'planning',
  CONNECTED: 'connected',
  MAINTENANCE: 'maintenance',
  DISCONNECTED: 'disconnected',
};

// Map technical status → workflow status
const TECH_TO_WORKFLOW = {
  [TECH_STATUS.PLANNING]: HOUSEHOLD_STATUS.DRAFT,
  [TECH_STATUS.CONNECTED]: HOUSEHOLD_STATUS.VALIDATED,
  [TECH_STATUS.MAINTENANCE]: HOUSEHOLD_STATUS.PENDING_APPROVAL,
  [TECH_STATUS.DISCONNECTED]: HOUSEHOLD_STATUS.REJECTED,
};

export class ElectrificationAdapter {
    constructor() {
        this.domainType = DOMAIN_TYPES.GEM;
    }

    async normalizeEntity(rawData) {
        return {
            id: rawData.id || rawData.uuid || rawData.numeroordre,
            name: rawData.name || `Ménage ${rawData.numeroordre || ''}`,
            location: rawData.location ||
                (rawData.latitude && rawData.longitude
                    ? {
                        lat: rawData.latitude,
                        lng: rawData.longitude,
                    }
                    : undefined),
            status: rawData.status || TECH_STATUS.PLANNING,
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
            },
            metadata: {
                source: rawData.source || 'kobo',
                lastSync: new Date(),
            },
        };
    }

    validateEntity(entity) {
        const errors = [];
        if (!entity.name) {
            errors.push({
                field: 'name',
                message: 'Le nom du ménage est requis',
                code: 'REQUIRED',
            });
        }
        if (!entity.location?.lat || !entity.location?.lng) {
            errors.push({
                field: 'location',
                message: 'La localisation (latitude, longitude) est requise',
                code: 'REQUIRED',
            });
        }
        if (entity.domainData?.numeroordre && typeof entity.domainData.numeroordre !== 'string') {
            errors.push({
                field: 'numeroordre',
                message: 'Le numéro d\'ordre doit être une chaîne',
                code: 'TYPE_ERROR',
            });
        }
        return errors;
    }

    deriveStatus(entity) {
        const rawStatus = entity.status;
        const { voltage, connectionDate } = entity.domainData || {};

        if (rawStatus && Object.values(TECH_STATUS).includes(rawStatus)) {
            return rawStatus;
        }

        if (voltage && voltage > 200) {
            return TECH_STATUS.CONNECTED;
        }
        if (connectionDate) {
            return TECH_STATUS.CONNECTED;
        }
        return TECH_STATUS.PLANNING;
    }

    toWorkflowStatus(techStatus) {
        return TECH_TO_WORKFLOW[techStatus] || HOUSEHOLD_STATUS.DRAFT;
    }

    generateAlerts(entity) {
        const alerts = [];
        const { voltage, status } = entity.domainData || {};

        if (voltage && voltage < 180) {
            alerts.push({
                type: 'low_voltage',
                severity: voltage < 150 ? 'critical' : 'high',
                message: `Tension basse : ${voltage}V (normale : 220V)`,
                metadata: { voltage },
            });
        }
        if (status === TECH_STATUS.MAINTENANCE) {
            alerts.push({
                type: 'maintenance_required',
                severity: 'medium',
                message: 'Ce ménage nécessite une maintenance',
                metadata: { status },
            });
        }
        if (status === TECH_STATUS.DISCONNECTED) {
            alerts.push({
                type: 'disconnection',
                severity: 'high',
                message: 'Ce ménage est déconnecté du réseau',
                metadata: { status },
            });
        }
        return alerts;
    }

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
                version: true,
                updatedAt: true,
            },
        };
    }

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
