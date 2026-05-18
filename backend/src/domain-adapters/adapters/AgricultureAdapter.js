/**
 * AgricultureAdapter
 *
 * Domain adapter for agriculture operations.
 * Handles Fields (parcelles), Crops (cultures), and Livestock (élevage).
 *
 * Registered under domainType: 'agriculture'
 */
export class AgricultureAdapter {
    constructor() {
        this.domainType = 'agriculture';
    }
    async normalizeEntity(rawData) {
        return {
            id: rawData.id || rawData.uuid,
            name: rawData.name || rawData.ownerName || `Field ${rawData.id?.slice(0, 8)}`,
            location: rawData.location || (rawData.latitude && rawData.longitude
                ? { lat: rawData.latitude, lng: rawData.longitude }
                : undefined),
            status: rawData.status || 'prepared',
            domainData: {
                // Owner
                owner: rawData.owner || { name: rawData.ownerName, phone: rawData.ownerPhone },
                // Field
                area: rawData.area || null, // hectares
                soilType: rawData.soilType || null,
                waterSource: rawData.waterSource || 'rain', // "rain" | "well" | "irrigation"
                // Crop
                currentCrop: rawData.currentCrop || null,
                plantedDate: rawData.plantedDate || null,
                expectedHarvest: rawData.expectedHarvest || null,
                estimatedYield: rawData.estimatedYield || null,
                actualYield: rawData.actualYield || null,
                // Location
                region: rawData.region || null,
                village: rawData.village || null,
            },
            metadata: {
                source: rawData.source || 'manual',
                lastSync: new Date(),
            },
        };
    }
    validateEntity(entity) {
        const errors = [];
        const d = entity.domainData || {};
        if (!entity.name) {
            errors.push({ field: 'name', message: 'Field name is required', code: 'REQUIRED' });
        }
        if (!entity.location?.lat || !entity.location?.lng) {
            errors.push({ field: 'location', message: 'Field location is required', code: 'REQUIRED' });
        }
        if (d.area !== null && d.area !== undefined && (isNaN(d.area) || d.area <= 0)) {
            errors.push({ field: 'area', message: 'Area must be a positive number (hectares)', code: 'INVALID' });
        }
        if (!['rain', 'well', 'irrigation', 'other'].includes(d.waterSource)) {
            errors.push({ field: 'waterSource', message: 'Invalid water source', code: 'INVALID' });
        }
        return errors;
    }
    deriveStatus(entity) {
        const { plantedDate, expectedHarvest, actualYield, currentCrop } = entity.domainData || {};
        const now = new Date();
        if (actualYield !== null && actualYield !== undefined)
            return 'harvested';
        if (!currentCrop)
            return 'prepared';
        if (expectedHarvest && new Date(expectedHarvest) < now)
            return 'ready';
        if (plantedDate && new Date(plantedDate) <= now)
            return 'growing';
        if (plantedDate)
            return 'planted';
        return 'prepared';
    }
    generateAlerts(entity) {
        const alerts = [];
        const d = entity.domainData || {};
        const now = new Date();
        // Overdue harvest
        if (d.expectedHarvest && new Date(d.expectedHarvest) < now && !d.actualYield) {
            const daysOverdue = Math.floor((now.getTime() - new Date(d.expectedHarvest).getTime()) / 86400000);
            alerts.push({
                type: 'harvest_overdue',
                severity: daysOverdue > 14 ? 'critical' : 'high',
                message: `Harvest is ${daysOverdue} day(s) overdue`,
                metadata: { expectedHarvest: d.expectedHarvest, daysOverdue },
            });
        }
        // No water source in dry season
        if (d.waterSource === 'rain' && d.currentCrop) {
            alerts.push({
                type: 'water_dependency',
                severity: 'medium',
                message: 'Field depends solely on rain water — risk during dry season',
                metadata: { waterSource: d.waterSource },
            });
        }
        // Yield below expected
        if (d.estimatedYield && d.actualYield && d.actualYield < d.estimatedYield * 0.7) {
            const shortfall = Math.round(((d.estimatedYield - d.actualYield) / d.estimatedYield) * 100);
            alerts.push({
                type: 'low_yield',
                severity: 'high',
                message: `Actual yield is ${shortfall}% below estimate`,
                metadata: { estimatedYield: d.estimatedYield, actualYield: d.actualYield },
            });
        }
        return alerts;
    }
    getEntityFields() {
        return [
            'name', 'owner', 'area', 'soilType', 'waterSource',
            'currentCrop', 'plantedDate', 'expectedHarvest',
            'estimatedYield', 'actualYield', 'status', 'region', 'village',
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
    buildEntityQuery(filters) {
        const where = {};
        if (filters.organizationId)
            where.organizationId = filters.organizationId;
        if (filters.projectId)
            where.projectId = filters.projectId;
        if (filters.status)
            where.status = filters.status;
        if (filters.region) {
            where.domainData = { path: ['region'], equals: filters.region };
        }
        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return { where };
    }
}
