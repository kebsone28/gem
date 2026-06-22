import { DOMAIN_TYPES } from '../../core/config/businessRules.js';

export class MESAdapter {
    constructor() {
        this.domainType = DOMAIN_TYPES.MES;
    }

    async normalizeEntity(rawData) {
        return {
            id: rawData.id || rawData.uuid,
            name: rawData.name || rawData.client || `MES ${rawData.id?.slice(0, 8) || ''}`,
            location: rawData.location ||
                (rawData.latitude && rawData.longitude
                    ? { lat: rawData.latitude, lng: rawData.longitude }
                    : undefined),
            status: rawData.status || 'en_attente',
            domainData: {
                prestataire: rawData.prestataire,
                client: rawData.client,
                zone: rawData.zone,
                poste: rawData.poste,
                agent: rawData.agent,
                phase: rawData.phase,
                branchement: rawData.branchement,
                compteur: rawData.compteur,
            },
            metadata: {
                source: rawData.source || 'manual',
                lastSync: new Date(),
            },
        };
    }

    validateEntity(entity) {
        const errors = [];
        if (!entity.name) {
            errors.push({
                field: 'name',
                message: 'Le nom du client est requis',
                code: 'REQUIRED',
            });
        }
        return errors;
    }

    deriveStatus(entity) {
        const { status, validationDate } = entity.domainData || {};
        if (status) return status;
        if (validationDate) return 'termine';
        return 'en_attente';
    }

    generateAlerts(entity) {
        const alerts = [];
        const { status } = entity.domainData || {};
        if (status === 'en_attente') {
            alerts.push({
                type: 'pending_validation',
                severity: 'medium',
                message: 'MES en attente de validation',
            });
        }
        return alerts;
    }

    getEntityFields() {
        return ['name', 'prestataire', 'client', 'status', 'zone', 'poste', 'agent', 'phase', 'branchement', 'compteur'];
    }

    getOptimalQueryShape() {
        return {
            select: {
                id: true,
                name: true,
                status: true,
                location: true,
                prestataire: true,
                client: true,
                zone: true,
                poste: true,
                agent: true,
                phase: true,
                branchement: true,
                compteur: true,
                alerts: true,
                updatedAt: true,
            },
        };
    }
}