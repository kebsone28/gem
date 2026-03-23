import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all grappes (clusters)
// @route   GET /api/teams/grappes
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
    console.log('📥 [SYNC GRAPPES] Body reçu:', JSON.stringify(req.body).slice(0, 300));

    try {
        const { grappes } = req.body;
        const { organizationId, id: userId } = req.user;

        if (!Array.isArray(grappes)) {
            return res.status(400).json({ error: 'Format invalide : grappes doit être un tableau' });
        }

        if (grappes.length === 0) {
            return res.status(400).json({ error: 'Tableau de grappes vide' });
        }

        console.log(`📊 [SYNC GRAPPES] ${grappes.length} grappes à synchroniser pour org: ${organizationId}`);

        const results = [];

        for (const g of grappes) {
            if (!g.name || !g.regionName) {
                console.warn(`⚠️ [SYNC GRAPPES] Grappe invalide ignorée:`, g);
                continue;
            }

            // ✅ Upsert Region (la table Region n'a pas d'organizationId)
            const region = await prisma.region.upsert({
                where: { name: g.regionName },
                update: {},
                create: { name: g.regionName }
            });

            // ✅ Upsert Grappe avec organizationId
            const grappe = await prisma.grappe.upsert({
                where: {
                    name_regionId: {
                        name: g.name,
                        regionId: region.id
                    }
                },
                update: {},
                create: {
                    name: g.name,
                    regionId: region.id,
                    organizationId
                }
            });

            results.push(grappe);
        }

        console.log(`✅ [SYNC GRAPPES] ${results.length} grappes synchronisées`);

        // Audit log
        if (results.length > 0) {
            await tracerAction({
                userId,
                organizationId,
                action: 'SYNC_GRAPPES',
                resource: 'Grappe',
                details: { count: results.length },
                req
            }).catch(e => console.warn('Audit log failed (non-blocking):', e.message));
        }

        res.json({ success: true, count: results.length, synced: results.length });
    } catch (error) {
        console.error('🔥 [SYNC GRAPPES] Erreur:', error.message, error.stack);
        res.status(500).json({
            error: 'Erreur lors de la synchronisation des grappes',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get single grappe
// @route   GET /api/teams/grappes/:id
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
