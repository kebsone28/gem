/**
 * DataCollectionAdapter
 *
 * Domain adapter for data collection operations (Collecte de données).
 * Handles generic survey campaigns, censuses, and field data gathering.
 *
 * Registered under domainType: 'data_collection'
 */
export class DataCollectionAdapter {
    constructor() {
        this.domainType = 'data_collection';
    }
    async normalizeEntity(rawData) {
        return {
            id: rawData.id || rawData.uuid,
            name: rawData.name || `Data Point ${rawData.id?.slice(0, 8)}`,
            location: rawData.location || (rawData.latitude && rawData.longitude
                ? { lat: rawData.latitude, lng: rawData.longitude }
                : undefined),
            status: rawData.status || 'draft',
            domainData: {
                formId: rawData.formId || null,
                surveyorId: rawData.surveyorId || null,
                ecosystem: rawData.ecosystem || 'ged', // Choix du système: "ged" (GEDcollect/GEDtoolbox) ou "kobo" (KoboCollect/KoboToolbox)
                platform: rawData.platform || (rawData.ecosystem === 'kobo' ? 'kobo_collect' : 'gedcollect'),
                completeness: rawData.completeness || 0, // percentage
                qualityScore: rawData.qualityScore || null, // validation score
                submissionDate: rawData.submissionDate || null,
            },
            metadata: {
                source: rawData.source || (rawData.ecosystem === 'kobo' ? 'kobo_api' : 'gedcollect_api'),
                lastSync: new Date(),
            },
        };
    }
    validateEntity(entity) {
        const errors = [];
        if (!entity.domainData?.formId) {
            errors.push({ field: 'formId', message: 'Form ID is required for data collection', code: 'REQUIRED' });
        }
        return errors;
    }
    deriveStatus(entity) {
        const { completeness, qualityScore } = entity.domainData || {};
        if (completeness === 100) {
            if (qualityScore !== null && qualityScore < 50)
                return 'flagged';
            return 'completed';
        }
        if (completeness > 0)
            return 'in_progress';
        return 'draft';
    }
    generateAlerts(entity) {
        const alerts = [];
        const d = entity.domainData || {};
        if (d.qualityScore !== null && d.qualityScore < 50) {
            alerts.push({
                type: 'poor_data_quality',
                severity: 'high',
                message: `Data quality score is very low (${d.qualityScore}/100)`,
            });
        }
        return alerts;
    }
    getEntityFields() {
        return [
            'name', 'formId', 'surveyorId', 'ecosystem', 'platform', 'completeness',
            'qualityScore', 'submissionDate', 'status'
        ];
    }
    getOptimalQueryShape() {
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
