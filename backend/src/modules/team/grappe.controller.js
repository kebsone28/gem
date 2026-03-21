import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all grappes (clusters)
// @route   GET /api/grappes
export const getGrappes = async (req, res) => {
    try {
        const { regionId } = req.query;
        
        const grappes = await prisma.grappe.findMany({
            where: regionId ? { regionId } : {},
            include: {
                region: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        
        res.json({ grappes });
    } catch (error) {
        console.error('Get grappes error:', error);
        res.status(500).json({ error: 'Server error while fetching clusters' });
    }
};

// @desc    Sync grappes (Bulk UPSERT)
// @route   POST /api/teams/grappes/sync
export const syncGrappes = async (req, res) => {
    try {
        const { grappes } = req.body; // Expecting [{ name: string, regionName: string }, ...]
        const { organizationId, id: userId } = req.user;

        if (!Array.isArray(grappes)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const results = [];
        for (const g of grappes) {
            // Find region by name (since clustering utility handles names)
            const region = await prisma.region.findFirst({
                where: { name: g.regionName, organizationId }
            });

            if (!region) {
                console.warn(`Region not found for grappe sync: ${g.regionName}`);
                continue;
            }

            // Upsert Grappe
            const grappe = await prisma.grappe.upsert({
                where: {
                    name_regionId: {
                        name: g.name,
                        regionId: region.id
                    }
                },
                update: {}, // No update needed if exists, or update other fields
                create: {
                    name: g.name,
                    regionId: region.id,
                    organizationId
                }
            });
            results.push(grappe);
        }

        // Audit Log
        if (results.length > 0) {
            await tracerAction({
                userId,
                organizationId,
                action: 'SYNC_GRAPPES',
                resource: 'Grappe',
                details: { count: results.length },
                req
            });
        }

        res.json({ success: true, count: results.length });
    } catch (error) {
        console.error('Sync grappes error:', error);
        res.status(500).json({ error: 'Server error while syncing clusters' });
    }
};

// @desc    Get single grappe
// @route   GET /api/grappes/:id
export const getGrappeById = async (req, res) => {
    try {
        const { id } = req.params;
        const grappe = await prisma.grappe.findUnique({
            where: { id },
            include: { region: true }
        });
        
        if (!grappe) {
            return res.status(404).json({ error: 'Cluster not found' });
        }
        
        res.json(grappe);
    } catch (error) {
        console.error('Get grappe error:', error);
        res.status(500).json({ error: 'Server error while fetching cluster' });
    }
};
