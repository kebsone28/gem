import prisma from '../../core/utils/prisma.js';
import { pushSchema } from './sync.validation.js';
import { socketService } from '../../services/socket.service.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Pull changes from server
// @route   GET /api/sync/pull
export const pullChanges = async (req, res) => {
    try {
        const { since } = req.query; // timestamp ISO string
        const { organizationId } = req.user;

        const lastSync = since ? new Date(since) : new Date(0);

        // Fetch all changes for this organization since last sync
        const projects = await prisma.project.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            }
        });

        const rawHouseholds = await prisma.household.findMany({
            where: {
                organizationId,
                updatedAt: { gt: lastSync }
            },
            include: {
                zone: {
                    select: { projectId: true }
                }
            }
        });

        // Flatten projectId for frontend compatibility
        const households = rawHouseholds.map(h => ({
            ...h,
            projectId: h.zone?.projectId,
            zone: undefined // Remove nested object to save bandwidth
        }));

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

export const pushChanges = async (req, res) => {
    const { organizationId, id: userId } = req.user;
    const { changes } = req.body;

    console.log(`[SYNC-DEBUG] 🔄 Start Push for Organization: ${organizationId} (User: ${userId})`);

    // Log payload summary for diagnostic
    const payloadSize = JSON.stringify(req.body).length;
    console.log(`[SYNC-DEBUG] Payload Size: ${(payloadSize / 1024).toFixed(2)} KB`);

    const results = {
        success: [],
        conflicts: [],
        errors: []
    };

    if (!changes) {
        return res.status(400).json({ error: 'No changes provided' });
    }

    // --- NEW: Schema Validation Layer ---
    const { error: validationError } = pushSchema.validate({ changes }, { abortEarly: false });
    if (validationError) {
        console.warn(`[SYNC-VALIDATION-WARNING] Schema mismatch detected:`, validationError.details.length, 'errors');
        // We don't block the whole sync if some metadata is wrong, but we log it.
        // For critical missing fields (IDs), the individual loops below will catch them.
    }

    // Process each entity type sequentially but NOT in a single transaction
    // to avoid rolling back everything if one record is bad.

    // 0. Sync Projects
    if (changes.projects?.length > 0) {
        console.log(`[SYNC-DEBUG] Processing ${changes.projects.length} projects...`);
        for (const p of changes.projects) {
            const { id, name, status, budget, duration, totalHouses, config, version } = p;
            if (!id) continue;
            try {
                await prisma.project.upsert({
                    where: { id },
                    update: {
                        name,
                        status: status || 'active',
                        budget: budget ? String(budget) : "0", // Decimal fields accept strings reliably
                        duration: parseInt(duration) || 0,
                        totalHouses: parseInt(totalHouses) || 0,
                        config: config || {},
                        updatedAt: new Date(),
                        version: (parseInt(version) || 1) + 1
                    },
                    create: {
                        id,
                        name,
                        organizationId,
                        status: status || 'active',
                        budget: budget ? String(budget) : "0",
                        duration: parseInt(duration) || 0,
                        totalHouses: parseInt(totalHouses) || 0,
                        config: config || {},
                        version: 1
                    }
                });
                results.success.push({ id, type: 'project' });
            } catch (e) {
                console.error(`[SYNC-ERROR] Project [${id}]:`, e.message);
                results.errors.push({ id, type: 'project', error: e.message });
            }
        }
    }

    // 1. Sync Zones
    if (changes.zones?.length > 0) {
        console.log(`[SYNC-DEBUG] Processing ${changes.zones.length} zones...`);
        for (const z of changes.zones) {
            const { id, name, projectId, metadata } = z;
            if (!id || !projectId) {
                results.errors.push({ id, type: 'zone', error: 'Missing ID or ProjectID' });
                continue;
            }
            try {
                // Verify project exists or just try upsert (Prisma will throw if foreign key fails)
                await prisma.zone.upsert({
                    where: { id },
                    update: { name, metadata: metadata || {}, updatedAt: new Date() },
                    create: { id, name, projectId, organizationId, metadata: metadata || {} }
                });
                results.success.push({ id, type: 'zone' });
            } catch (e) {
                console.error(`[SYNC-ERROR] Zone [${id}]:`, e.message);
                results.errors.push({ id, type: 'zone', error: e.message });
            }
        }
    }

    // 2. Sync Households
    if (changes.households?.length > 0) {
        console.log(`[SYNC-DEBUG] Processing ${changes.households.length} households...`);
        for (const h of changes.households) {
            const { id, zoneId, status, location, owner, koboData, version } = h;
            if (!id || !zoneId) {
                results.errors.push({ id, type: 'household', error: 'Missing ID or ZoneID' });
                continue;
            }
            try {
                const serverH = await prisma.household.findUnique({ where: { id } });
                if (serverH && serverH.version > (parseInt(version) || 0)) {
                    results.conflicts.push({ id, type: 'household', server: serverH });
                    continue;
                }

                await prisma.household.upsert({
                    where: { id },
                    update: {
                        status: status || 'planned',
                        location: location || {},
                        owner: owner || {},
                        koboData: koboData || {},
                        version: (parseInt(version) || 0) + 1,
                        updatedAt: new Date()
                    },
                    create: {
                        id,
                        zoneId,
                        organizationId,
                        status: status || 'planned',
                        location: location || {},
                        owner: owner || {},
                        koboData: koboData || {},
                        version: 1
                    }
                });
                results.success.push({ id, type: 'household' });
            } catch (e) {
                console.error(`[SYNC-ERROR] Household [${id}]:`, e.message);
                results.errors.push({ id, type: 'household', error: e.message });
            }
        }
    }

    // 3. Sync Teams
    if (changes.teams?.length > 0) {
        console.log(`[SYNC-DEBUG] Processing ${changes.teams.length} teams...`);
        for (const t of changes.teams) {
            const { id, name, type, status } = t;
            if (!id) continue;
            try {
                await prisma.team.upsert({
                    where: { id },
                    update: {
                        name,
                        type: type || 'field',
                        status: status || 'active',
                        updatedAt: new Date()
                    },
                    create: {
                        id,
                        name,
                        type: type || 'field',
                        organizationId,
                        status: status || 'active'
                    }
                });
                results.success.push({ id, type: 'team' });
            } catch (e) {
                console.error(`[SYNC-ERROR] Team [${id}]:`, e.message);
                results.errors.push({ id, type: 'team', error: e.message });
            }
        }
    }

    console.log(`[SYNC-DEBUG] ✅ Push complete. Success: ${results.success.length}, Errors: ${results.errors.length}`);

    // Broadcast real-time notification to all connected clients except sender
    if (results.success.length > 0) {
        socketService.emit('notification', {
            type: 'SYNC',
            message: `${results.success.length} changements enregistrés par ${req.user.firstName || 'un utilisateur'}`,
            data: { user: req.user.id, results: results.success.length }
        });

        // Déterminer l'action spécifique basée sur le rôle/username
        let specificAction = 'SYNCHRONISATION_TERRAIN';
        const username = req.user.username?.toLowerCase() || '';

        if (username.includes('maçon')) specificAction = 'VALIDATION_MAÇONNERIE';
        else if (username.includes('reseau')) specificAction = 'VALIDATION_RÉSEAU';
        else if (username.includes('elec')) specificAction = 'VALIDATION_ÉLECTRICITÉ';
        else if (username.includes('livreur')) specificAction = 'VALIDATION_LOGISTIQUE';

        // Audit Log détaillé
        await tracerAction({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: specificAction,
            resource: 'Terrain',
            resourceId: null,
            details: {
                successCount: results.success.length,
                householdsUpdated: changes.households?.length || 0,
                zonesUpdated: changes.zones?.length || 0,
                team: req.user.specialty || req.user.role
            },
            req
        });
    }

    // Still return 200/201 even if some records had errors, but report them.
    // However, if EVERY record failed, we might want to return 500 or 207 Multi-status.
    res.json({
        message: 'Push processing complete',
        summary: {
            successCount: results.success.length,
            conflictCount: results.conflicts.length,
            errorCount: results.errors.length
        },
        results
    });
};
