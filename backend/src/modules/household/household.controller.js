import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all households for an organization
// @route   GET /api/households
export const getHouseholds = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId, zoneId, status } = req.query;

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
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ households });
    } catch (error) {
        console.error('Get households error:', error);
        res.status(500).json({ error: 'Server error while fetching households' });
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
        const { zoneId, status, location, owner } = req.body;
        const { organizationId } = req.user;

        const household = await prisma.household.create({
            data: {
                zoneId,
                status: status || 'planned',
                location: location || {},
                owner: owner || {},
                organizationId
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
            details: { zoneId, status: household.status },
            req
        });

        res.status(201).json(household);
    } catch (error) {
        console.error('Create household error:', error);
        res.status(500).json({ error: 'Server error while creating household' });
    }
};

// @desc    Update household
// @route   PATCH /api/households/:id
export const updateHousehold = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, location, owner } = req.body;
        const { organizationId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id, organizationId }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        const updated = await prisma.household.update({
            where: { id },
            data: {
                status,
                location: location !== undefined ? location : household.location,
                owner: owner !== undefined ? owner : household.owner,
                version: household.version + 1
            }
        });

        // Sync PostGIS point
        if (location && Array.isArray(location.coordinates)) {
            await prisma.$executeRaw`
                UPDATE "Household"
                SET location_gis = ST_SetSRID(ST_MakePoint(${location.coordinates[0]}, ${location.coordinates[1]}), 4326)
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

        res.json(updated);
    } catch (error) {
        console.error('Update household error:', error);
        res.status(500).json({ error: 'Server error while updating household' });
    }
};
