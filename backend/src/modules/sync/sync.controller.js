import prisma from '../../core/utils/prisma.js';

// @desc    Pull changes from server
// @route   GET /api/sync/pull
export const pullChanges = async (req, res) => {
    try {
        const { since } = req.query; // timestamp ISO string
        const { organizationId } = req.user;

        const lastSync = since ? new Date(since) : new Date(0);

        // Fetch all changes for this organization since last sync
        // In a real app, you would iterate over all relevant tables
        const projects = await prisma.project.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            }
        });

        const households = await prisma.household.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            }
        });

        const zones = await prisma.zone.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            }
        });

        const teams = await prisma.team.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            }
        });

        res.json({
            timestamp: new Date().toISOString(),
            changes: {
                projects,
                households,
                zones,
                teams
            }
        });

    } catch (error) {
        console.error('Sync pull error:', error);
        res.status(500).json({ error: 'Failed to pull changes' });
    }
};

// @desc    Push changes to server
// @route   POST /api/sync/push
export const pushChanges = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { changes } = req.body; // { households: [...], projects: [...] }

        const results = {
            success: [],
            conflicts: []
        };

        // Transactional batch update
        await prisma.$transaction(async (tx) => {
            // Processing Households as an example
            if (changes.households) {
                for (const h of changes.households) {
                    // 1. Get current server version
                    const serverH = await tx.household.findUnique({ where: { id: h.id } });

                    if (serverH && serverH.version !== h.version) {
                        results.conflicts.push({ id: h.id, type: 'household', serverVersion: serverH });
                        continue;
                    }

                    // 2. Upsert (update version on server)
                    const updated = await tx.household.upsert({
                        where: { id: h.id },
                        update: {
                            ...h,
                            organizationId,
                            version: h.version + 1,
                            updatedAt: new Date()
                        },
                        create: {
                            ...h,
                            organizationId,
                            version: 1,
                            updatedAt: new Date()
                        }
                    });
                    results.success.push({ id: updated.id, type: 'household' });
                }
            }

            // Repeat for projects, zones, etc.
        });

        res.json({
            message: 'Push processed',
            results
        });

    } catch (error) {
        console.error('Sync push error:', error);
        res.status(500).json({ error: 'Failed to push changes' });
    }
};
