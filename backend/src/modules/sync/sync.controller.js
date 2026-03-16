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
    try {
        const { organizationId, id: userId } = req.user;
        const { changes } = req.body;

        console.log(`[SYNC-DEBUG] 🔄 Start Push for Organization: ${organizationId} (User: ${userId})`);

        // Log payload summary for diagnostic
        const payloadSize = JSON.stringify(req.body || {}).length;
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
        }

        // Process each entity type sequentially but NOT in a single transaction
        // to avoid rolling back everything if one record is bad.

        // 0. Sync Projects
        if (changes.projects?.length > 0) {
            console.log(`[SYNC-DEBUG] Processing ${changes.projects.length} projects...`);
            for (const p of changes.projects) {
                if (!p || !p.id) continue;
                const { id, name, status, budget, duration, totalHouses, config: pConfig, version } = p;
                try {
                    await prisma.project.upsert({
                        where: { id },
                        update: {
                            name,
                            status: status || 'active',
                            budget: budget ? String(budget) : "0",
                            duration: parseInt(duration) || 0,
                            totalHouses: parseInt(totalHouses) || 0,
                            config: pConfig || {},
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
                            config: pConfig || {},
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
                if (!z || !z.id || !z.projectId) {
                    results.errors.push({ id: z?.id, type: 'zone', error: 'Missing ID or ProjectID' });
                    continue;
                }
                const { id, name, projectId, metadata } = z;
                try {
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
                if (!h || !h.id || !h.zoneId) {
                    results.errors.push({ id: h?.id, type: 'household', error: 'Missing ID or ZoneID' });
                    continue;
                }
                const { 
                    id, zoneId, status, location, owner, koboData, version,
                    name, phone, region, departement, village, latitude, longitude, source
                } = h;
                try {
                    const serverH = await prisma.household.findUnique({ where: { id } });
                    if (serverH && serverH.version > (parseInt(version) || 0)) {
                        results.conflicts.push({ id, type: 'household', server: serverH });
                        continue;
                    }

                    await prisma.household.upsert({
                        where: { id },
                        update: {
                            zoneId,
                            status: status || serverH?.status || 'planned',
                            location: (location && Object.keys(location).length > 0) ? location : (serverH?.location || {}),
                            owner: (owner && Object.keys(owner).length > 0) ? owner : (serverH?.owner || {}),
                            koboData: koboData || serverH?.koboData || {},
                            
                            name: name ?? undefined,
                            phone: phone ?? undefined,
                            region: region ?? undefined,
                            departement: departement ?? undefined,
                            village: village ?? undefined,
                            latitude: latitude !== undefined ? latitude : undefined,
                            longitude: longitude !== undefined ? longitude : undefined,
                            source: source ?? undefined,

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
                            
                            name: name || null,
                            phone: phone || null,
                            region: region || null,
                            departement: departement || null,
                            village: village || null,
                            latitude: latitude || null,
                            longitude: longitude || null,
                            source: source || 'Sync',

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
                if (!t || !t.id) continue;
                const { id, name, type, status } = t;
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

        // Broadcast real-time notification
        if (results.success.length > 0) {
            try {
                socketService.emit('notification', {
                    type: 'SYNC',
                    message: `${results.success.length} changements enregistrés par ${req.user.firstName || 'un utilisateur'}`,
                    data: { user: req.user.id, results: results.success.length }
                });

                let specificAction = 'SYNCHRONISATION_TERRAIN';
                const username = req.user.username?.toLowerCase() || '';
                if (username.includes('maçon')) specificAction = 'VALIDATION_MAÇONNERIE';
                else if (username.includes('reseau')) specificAction = 'VALIDATION_RÉSEAU';
                else if (username.includes('elec')) specificAction = 'VALIDATION_ÉLECTRICITÉ';
                else if (username.includes('livreur')) specificAction = 'VALIDATION_LOGISTIQUE';

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
            } catch (broadcastError) {
                console.error('[SYNC-BROADCAST-ERROR] Error during post-sync notification/audit:', broadcastError.message);
                // We DON'T fail the request if audit/socket fails, as the DB data is already saved.
            }
        }

        res.json({
            message: 'Push processing complete',
            summary: {
                successCount: results.success.length,
                conflictCount: results.conflicts.length,
                errorCount: results.errors.length
            },
            results
        });
    } catch (globalError) {
        console.error('[SYNC-GLOBAL-FATAL] Uncaught error in pushChanges:', globalError);
        res.status(500).json({
            error: 'Internal Server Error during sync push',
            message: globalError.message
        });
    }
};
