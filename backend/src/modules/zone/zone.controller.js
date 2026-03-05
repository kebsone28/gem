import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all zones for a project
// @route   GET /api/zones
export const getZones = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        const where = {
            organizationId,
            deletedAt: null
        };

        if (projectId) {
            where.projectId = projectId;
        }

        const zones = await prisma.zone.findMany({
            where,
            include: {
                _count: {
                    select: { households: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json({ zones });
    } catch (error) {
        console.error('Get zones error:', error);
        res.status(500).json({ error: 'Server error while fetching zones' });
    }
};

// @desc    Create new zone
// @route   POST /api/zones
export const createZone = async (req, res) => {
    try {
        const { projectId, name } = req.body;
        const { organizationId } = req.user;

        const zone = await prisma.zone.create({
            data: {
                name,
                projectId,
                organizationId
            }
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_ZONE',
            resource: 'Zone',
            resourceId: zone.id,
            details: { name, projectId },
            req
        });

        res.status(201).json(zone);
    } catch (error) {
        console.error('Create zone error:', error);
        res.status(500).json({ error: 'Server error while creating zone' });
    }
};

// @desc    Delete zone
export const deleteZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const zone = await prisma.zone.findFirst({
            where: { id, organizationId }
        });

        if (!zone) return res.status(404).json({ error: 'Zone not found' });

        await prisma.zone.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_ZONE',
            resource: 'Zone',
            resourceId: id,
            details: { name: zone.name, projectId: zone.projectId },
            req
        });

        res.json({ message: 'Zone deleted successfully' });
    } catch (error) {
        console.error('Delete zone error:', error);
        res.status(500).json({ error: 'Server error while deleting zone' });
    }
};
