import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { logPerformance } from '../../services/performance.service.js';

// @desc    Get all households for an organization
// @route   GET /api/households
// @query   bbox: lng1,lat1,lng2,lat2 for spatial filtering
export const getHouseholds = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId, zoneId, status, bbox, limit = '5000' } = req.query;

        const limitNum = Math.min(parseInt(limit), 10000);

        // If bbox is provided, use PostGIS spatial query
        if (bbox) {
            const [lng1, lat1, lng2, lat2] = bbox.split(',').map(Number);

            // Validate bbox coordinates
            if (isNaN(lng1) || isNaN(lat1) || isNaN(lng2) || isNaN(lat2)) {
                return res.status(400).json({ error: 'Invalid bbox coordinates' });
            }

            try {
                // Build status WHERE clause if provided
                const statusClause = status ? `AND h."status" = '${status.replace(/'/g, "''")}'` : '';

                // PostGIS query using bounding box
                const query = `
                    SELECT h."id", h."zoneId", h."organizationId", h."status", 
                           h."location", h."owner", h."koboData", h."version", 
                           h."updatedAt", h."deletedAt",
                           json_build_object('name', z."name", 'projectId', z."projectId") as zone
                    FROM "Household" h
                    LEFT JOIN "Zone" z ON h."zoneId" = z."id"
                    WHERE h."organizationId" = $1
                      AND h."deletedAt" IS NULL
                      AND h."location_gis" IS NOT NULL
                      AND ST_DWithin(
                        h."location_gis"::geography,
                        ST_MakeEnvelope($2, $3, $4, $5, 4326)::geography,
                        0
                      )
                    ${statusClause}
                    ORDER BY h."updatedAt" DESC
                    LIMIT $6
                `;

                const households = await prisma.$queryRawUnsafe(
                    query,
                    organizationId,
                    lng1,
                    lat1,
                    lng2,
                    lat2,
                    limitNum
                );

                return res.json({ households });
            } catch (gisError) {
                console.warn('PostGIS query failed, falling back to standard query:', gisError.message);
                // Fallback to standard query if PostGIS fails
            }
        }

        // Standard query (no bbox or PostGIS failed)
        const where = {
            organizationId,
            deletedAt: null
        };

        if (zoneId) {
            where.zoneId = zoneId;
        } else if (projectId) {
            where.zone = { projectId };
        }

        if (status) {
            where.status = status;
        }

        const households = await prisma.household.findMany({
            where,
            include: {
                zone: {
                    select: { name: true, projectId: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: limitNum
        });

        res.json({ households });
    } catch (error) {
        console.error('Get households error:', error);
        res.status(500).json({ error: 'Server error while fetching households' });
    }
};

// @desc    Get total households count
// @route   GET /api/households/count
export const getHouseholdsCount = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const count = await prisma.household.count({
            where: {
                organizationId,
                deletedAt: null
            }
        });
        res.json({ count });
    } catch (error) {
        console.error('Get households count error:', error);
        res.status(500).json({ error: 'Server error while fetching household count' });
    }
};

// @desc    Get single household
// @route   GET /api/households/:id
export const getHouseholdById = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: { zone: true }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        res.json(household);
    } catch (error) {
        console.error('Get household error:', error);
        res.status(500).json({ error: 'Server error while fetching household' });
    }
};

// @desc    Create new household
// @route   POST /api/households
export const createHousehold = async (req, res) => {
    try {
        const { 
            zoneId: requestedZoneId, status, location, owner, 
            koboData, koboSync, assignedTeams,
            name, phone, region, departement, village
        } = req.body;
        const { organizationId } = req.user;

        // ── ZONE RESOLUTION (zone fallback automatique) ──
        let resolvedZoneId = requestedZoneId;

        if (resolvedZoneId) {
            // Vérifier que la zone existe bien dans la DB
            const zone = await prisma.zone.findUnique({ where: { id: resolvedZoneId } });
            if (!zone) {
                console.warn(`⚠️ Zone ${resolvedZoneId} introuvable → fallback`);
                resolvedZoneId = null;
            }
        }

        // Fallback : chercher la première zone de l'organisation
        if (!resolvedZoneId) {
            const defaultZone = await prisma.zone.findFirst({
                where: { organizationId },
                orderBy: { id: 'asc' }
            });

            if (!defaultZone) {
                return res.status(400).json({ 
                    error: 'Aucune zone disponible pour cette organisation. Créez une zone d\'abord.' 
                });
            }
            resolvedZoneId = defaultZone.id;
            console.log(`ℹ️ Zone fallback utilisée: ${resolvedZoneId}`);
        }

        const household = await prisma.household.create({
            data: {
                zoneId: resolvedZoneId,
                organizationId,
                status: status || 'planned',
                location: location || {},
                owner: owner || {},
                koboData: koboData ?? {},
                koboSync: koboSync ?? {},
                assignedTeams: assignedTeams || [],
                name: name || null,
                phone: phone || null,
                region: region || null,
                departement: departement || null,
                village: village || null,
            }
        });

        // Sync PostGIS point
        if (location && Array.isArray(location.coordinates)) {
            await prisma.$executeRaw`
                UPDATE "Household"
                SET location_gis = ST_SetSRID(ST_MakePoint(${location.coordinates[0]}, ${location.coordinates[1]}), 4326)
                WHERE id = ${household.id}
            `;
        }

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_MENAGE',
            resource: 'Ménage',
            resourceId: household.id,
            details: { zoneId: resolvedZoneId, status: household.status },
            req
        });

        res.status(201).json(household);
    } catch (error) {
        const prismaCode = error?.code;
        const prismaMessage = error?.message;
        console.error('🔥 Create household error:', { code: prismaCode, message: prismaMessage, meta: error?.meta });
        
        // Retourner le détail Prisma pour debugging
        res.status(500).json({ 
            error: 'Server error while creating household',
            details: prismaMessage,
            code: prismaCode,
            meta: error?.meta
        });
    }
};

// @desc    Update household
// @route   PATCH /api/households/:id
export const updateHousehold = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;
        const updates = req.body;

        const household = await prisma.household.findFirst({
            where: { id, organizationId },
            include: { zone: { select: { projectId: true } } }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        // --- MANAGE OVERRIDES ---
        let currentOverrides = household.manualOverrides || [];
        const { unlockFields, ...otherUpdates } = updates;
        
        // 1. Remove unlocked fields
        if (Array.isArray(unlockFields)) {
            currentOverrides = currentOverrides.filter(f => !unlockFields.includes(f));
        }

        // 2. Add modified fields to overrides (if they are basic model fields)
        const trackableFields = [
            'name', 'phone', 'numeroordre', 'region', 'departement', 'village', 
            'latitude', 'longitude', 'zoneId', 'source', 'assignedTeams',
            'owner', 'constructionData', 'koboSync'
        ];

        Object.keys(otherUpdates).forEach(key => {
            if (trackableFields.includes(key) && !currentOverrides.includes(key)) {
                currentOverrides.push(key);
            }
        });

        // Logic for deep merge on JSON fields if they are objects
        const prepareJsonField = (field, newVal) => {
            if (newVal === undefined) return household[field];
            if (newVal === null) return null;
            if (typeof newVal === 'object' && !Array.isArray(newVal) && typeof household[field] === 'object') {
                return { ...(household[field] || {}), ...newVal };
            }
            return newVal;
        };

        const data = {
            status: updates.status !== undefined ? updates.status : household.status,
            name: updates.name !== undefined ? updates.name : household.name,
            phone: updates.phone !== undefined ? updates.phone : household.phone,
            numeroordre: updates.numeroordre !== undefined ? updates.numeroordre : household.numeroordre,
            region: updates.region !== undefined ? updates.region : household.region,
            departement: updates.departement !== undefined ? updates.departement : household.departement,
            village: updates.village !== undefined ? updates.village : household.village,
            latitude: updates.latitude !== undefined ? Number(updates.latitude) : household.latitude,
            longitude: updates.longitude !== undefined ? Number(updates.longitude) : household.longitude,
            zoneId: updates.zoneId !== undefined ? updates.zoneId : household.zoneId,
            source: updates.source !== undefined ? updates.source : household.source,
            assignedTeams: updates.assignedTeams !== undefined ? updates.assignedTeams : household.assignedTeams,
            
            // JSON Fields with merging capability
            owner: prepareJsonField('owner', updates.owner),
            constructionData: prepareJsonField('constructionData', updates.constructionData),
            koboSync: prepareJsonField('koboSync', updates.koboSync),
            location: prepareJsonField('location', updates.location),
            alerts: prepareJsonField('alerts', updates.alerts),
            
            manualOverrides: currentOverrides,
            version: household.version + 1
        };

        const updated = await prisma.household.update({
            where: { id },
            data
        });

        // Sync PostGIS point if coordinates changed
        const finalLat = data.latitude;
        const finalLng = data.longitude;
        if (finalLat !== null && finalLng !== null && (updates.latitude !== undefined || updates.longitude !== undefined || updates.location !== undefined)) {
            await prisma.$executeRaw`
                UPDATE "Household"
                SET location_gis = ST_SetSRID(ST_MakePoint(${finalLng}, ${finalLat}), 4326)
                WHERE id = ${id}
            `;
        }

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'MODIFICATION_MENAGE',
            resource: 'Ménage',
            resourceId: id,
            details: {
                oldStatus: household.status,
                newStatus: status
            },
            req
        });
        
        // --- PERFORMANCE LOGGING ---
        if (status && status !== household.status) {
            await logPerformance({
                organizationId,
                projectId: household.zone?.projectId,
                userId: req.user.id,
                householdId: id,
                action: 'STATUS_CHANGE',
                oldStatus: household.status,
                newStatus: status,
                details: { source: 'WEB_REALTIME' }
            });
        }

        res.json(updated);
    } catch (error) {
        console.error('Update household error:', error);
        res.status(500).json({ error: 'Server error while updating household' });
    }
};

// @desc    Get household by numeroordre (business identifier for Kobo matching)
// @route   GET /api/households/by-numero/:numeroordre
export const getHouseholdByNumero = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { numeroordre } = req.params;

        if (!numeroordre) {
            return res.status(400).json({ error: 'numeroordre is required' });
        }

        const household = await prisma.household.findFirst({
            where: {
                organizationId,
                numeroordre: String(numeroordre),
                deletedAt: null
            },
            include: {
                zone: {
                    select: { name: true, projectId: true }
                }
            }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        res.json({ household });
    } catch (error) {
        console.error('Get household by numero error:', error);
        res.status(500).json({ error: 'Server error while fetching household' });
    }
};
