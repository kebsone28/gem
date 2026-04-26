import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { pushSchema } from './sync.validation.js';
import { socketService } from '../../services/socket.service.js';
import { tracerAction } from '../../services/audit.service.js';
import { recalculateProjectGrappes } from '../../services/project_config.service.js';
import { logPerformance } from '../../services/performance.service.js';
import fs from 'fs';
import path from 'path';
import {
    LEGACY_SAFE_HOUSEHOLD_READ_SELECT,
    normalizeLegacyHousehold
} from '../household/household.compat.js';
import { isPrismaSchemaDriftError } from '../../core/utils/prismaCompat.js';

// Force relative path for reliable debugging across OS
const DEBUG_LOG = path.join(process.cwd(), 'sync_debug.log');

// 🛠️ BIGINT SERIALIZATION FIX
// JSON.stringify doesn't support BigInt by default, which causes 500 errors
// when sending households from Kobo that have a numeric submission ID.
BigInt.prototype.toJSON = function() { return this.toString(); };

// @desc    Pull changes from server
// @route   GET /api/sync/pull
export const pullChanges = async (req, res) => {
    try {
        const { since } = req.query; // timestamp ISO string
        const { organizationId } = req.user;

        console.log(`[SYNC PULL] sync endpoint called - since: ${since}, organizationId: ${organizationId}`);

        if (!organizationId) {
            console.error('[SYNC PULL] ERROR: organizationId is undefined or null in req.user');
            console.error('[SYNC PULL] req.user:', JSON.stringify(req.user));
            return res.status(400).json({ error: 'organizationId missing' });
        }

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
            select: LEGACY_SAFE_HOUSEHOLD_READ_SELECT
        });

        // Flatten projectId for frontend compatibility & SANITIZE coordinates for Mapbox
        const households = rawHouseholds.map((rawHousehold) => {
            const h = normalizeLegacyHousehold(rawHousehold);
            // Mapbox and frontend filters rely on location.coordinates [lng, lat]
            const lat = Number(h.latitude);
            const lng = Number(h.longitude);
            const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

            const finalLocation = hasCoords 
                ? { type: 'Point', coordinates: [lng, lat] }
                : (h.location || null);

            return {
                ...h,
                projectId: h.zone?.projectId || h.projectId,
                zone: undefined, // Remove nested object to save bandwidth
                location: finalLocation,
                latitude: hasCoords ? lat : (lat || 0),
                longitude: hasCoords ? lng : (lng || 0)
            };
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

export const pushChanges = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { changes } = req.body;

        console.log(`[SYNC-DEBUG] 🔄 Start Push for Organization: ${organizationId} (User: ${userId})`);
        console.log(`[SYNC-DEBUG] Changes received:`, {
            projects: changes?.projects?.length || 0,
            zones: changes?.zones?.length || 0,
            households: changes?.households?.length || 0
        });

        // Log payload summary for diagnostic
        const payloadSize = JSON.stringify(req.body || {}).length;
        console.log(`[SYNC-DEBUG] Payload Size: ${(payloadSize / 1024).toFixed(2)} KB`);

        const results = {
            success: [],
            conflicts: [],
            errors: []
        };

        const logMsg = `\n[${new Date().toISOString()}] Push start: H=${changes.households?.length || 0}, Z=${changes.zones?.length || 0}, P=${changes.projects?.length || 0}\n`;
        fs.appendFileSync(DEBUG_LOG, logMsg);

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
            console.log(`[SYNC-DEBUG] ✅ Starting project sync (${changes.projects.length} projects)...`);
            for (const p of changes.projects) {
                if (!p || !p.id) continue;
                const { id, name, status, budget, duration, totalHouses, config: pConfig, version } = p;
                try {
                    console.log(`[SYNC-DEBUG] Processing project: ${id}`);
                    const serverProject = await prisma.project.findUnique({ where: { id } });

                    await prisma.project.upsert({
                        where: { id },
                        update: {
                            name: name ?? serverProject?.name,
                            status: status ?? serverProject?.status ?? 'active',
                            budget: budget ? String(budget) : serverProject?.budget,
                            duration: duration !== undefined ? parseInt(duration) : serverProject?.duration,
                            totalHouses: totalHouses !== undefined ? parseInt(totalHouses) : serverProject?.totalHouses,
                            config: pConfig ? { ...(serverProject?.config || {}), ...pConfig } : serverProject?.config,
                            updatedAt: new Date(),
                            version: (parseInt(version) || serverProject?.version || 1) + 1
                        },
                        create: {
                            id,
                            name: name ?? 'Nouveau Projet',
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
            console.log(`[SYNC-DEBUG] ✅ Starting zone sync (${changes.zones.length} zones)...`);
            for (const z of changes.zones) {
                if (!z || !z.id || !z.projectId) {
                    console.log(`[SYNC-DEBUG] Skipping zone - missing ID or ProjectID`);
                    results.errors.push({ id: z?.id, type: 'zone', error: 'Missing ID or ProjectID' });
                    continue;
                }
                const { id, name, projectId, metadata } = z;
                try {
                    console.log(`[SYNC-DEBUG] Processing zone: ${id}`);
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
                // SAFETY FALLBACKS (as per diagnostic)
                if (h && !h.id) {
                    const { v4: uuidv4 } = await import('uuid');
                    h.id = uuidv4();
                    console.log(`[SYNC-DEBUG] 🛡️ Generated fallback ID for household: ${h.id}`);
                }
                if (h && (h.zoneId === undefined || h.zoneId === null || h.zoneId === '')) {
                    // Try to find a default zone for the organization/project
                    const defaultZone = await prisma.zone.findFirst({ 
                        where: { organizationId, deletedAt: null } 
                    });
                    h.zoneId = defaultZone?.id || 'default_zone_not_found';
                    console.log(`[SYNC-DEBUG] 🛡️ Assigned fallback ZoneID for household ${h.id}: ${h.zoneId}`);
                }

                if (!h || !h.id || !h.zoneId || h.zoneId === 'default_zone_not_found') {
                    const errMsg = `[${new Date().toISOString()}] [SYNC-SKIP] Missing required fields. ID: ${h?.id}, zoneId: ${h?.zoneId}, payload keys: ${h ? Object.keys(h).join(',') : 'null'}\n`;
                    fs.appendFileSync(DEBUG_LOG, errMsg);
                    results.errors.push({ id: h?.id, type: 'household', error: 'Missing ID or ZoneID' });
                    continue;
                }
                const { 
                    id, zoneId, status, location, owner, koboData, version,
                    name, phone, region, departement, village, source,
                    constructionData, alerts, numeroordre
                } = h;

                // Explicitly cast latitude/longitude to Float if they are valid numbers, or null if invalid/empty
                const latitude = (h.latitude !== undefined && h.latitude !== null && h.latitude !== '') ? parseFloat(h.latitude) : null;
                const longitude = (h.longitude !== undefined && h.longitude !== null && h.longitude !== '') ? parseFloat(h.longitude) : null;

                // Ensure location GeoJSON is properly formatted with coordinates
                let normalizedLocation = location;
                if ((!normalizedLocation || !normalizedLocation.coordinates) && latitude !== null && longitude !== null) {
                    // Reconstruct location from latitude/longitude if missing
                    normalizedLocation = {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    };
                }

                    // Accept both UUID and custom ID formats (e.g., 4526 from imports)
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    const customIdRegex = /^[A-Z0-9-]+$/; // Accepts alphanumeric IDs like 4526
                    
                    if (id && !uuidRegex.test(id) && !customIdRegex.test(id)) {
                        const skipMsg = `[${new Date().toISOString()}] [SYNC-SKIP] Household ID [${id}] is not a valid UUID or custom format. Skipping.\n`;
                        fs.appendFileSync(DEBUG_LOG, skipMsg);
                        results.errors.push({ id, type: 'household', error: 'Invalid ID format' });
                        continue;
                    }

                    try {
                        const _serverH = await prisma.household.findUnique({ 
                            where: { id },
                            include: { zone: { select: { projectId: true } } }
                        });
                        let serverH = _serverH;
                        
                    if (serverH && serverH.version > (parseInt(version) || 0)) {
                        results.conflicts.push({ id, type: 'household', server: serverH });
                        
                        // Enregistrer le conflit côté serveur
                        await prisma.conflictLog.create({
                            data: {
                                organizationId,
                                entityType: 'households',
                                entityId: id,
                                clientVersion: parseInt(version) || 0,
                                serverVersion: serverH.version,
                                localData: h,
                                serverData: serverH,
                                strategy: 'pending-client-review'
                            }
                        }).catch(e => console.error('[SYNC-CONFLICT-LOG] Failed to create ConflictLog:', e.message));

                        continue;
                    }

                    // CRITICAL: Verify zone exists before upserting household (foreign key constraint)
                    let zoneExists = await prisma.zone.findUnique({ where: { id: zoneId } });
                    
                    if (!zoneExists) {
                        console.log(`[SYNC-HEAL] 🏗️ Zone ${zoneId} not found for household ${id}. Attempting to heal...`);
                        
                        // Try to find ANY zone in the same organization to avoid foreign key failure
                        const fallbackZone = await prisma.zone.findFirst({ 
                            where: { organizationId, deletedAt: null } 
                        });

                        if (fallbackZone) {
                            console.log(`[SYNC-HEAL] 🩹 Reassigning household ${id} to existing zone ${fallbackZone.id}`);
                            h.zoneId = fallbackZone.id;
                            zoneExists = fallbackZone;
                        } else {
                            // Last resort: Create a default zone
                            console.log(`[SYNC-HEAL] 🏗️ Creating emergency default zone for org ${organizationId}`);
                            const project = await prisma.project.findFirst({ where: { organizationId } });
                            if (project) {
                                zoneExists = await prisma.zone.create({
                                    data: {
                                        id: zoneId.startsWith('zone_') ? zoneId : undefined, // Keep local ID if it looks like one
                                        name: 'Zone Auto-Créée',
                                        projectId: project.id,
                                        organizationId
                                    }
                                });
                            }
                        }
                    }

                    if (!zoneExists) {
                        const errMsg = `[${new Date().toISOString()}] [SYNC-ERROR-ZONE] Zone [${zoneId}] does not exist and could not be healed. Skipping household [${id}].\n`;
                        fs.appendFileSync(DEBUG_LOG, errMsg);
                        results.errors.push({ id, type: 'household', error: `Zone ${zoneId} not found` });
                        continue;
                    }

                    // Use the potentially updated zoneId
                    const finalZoneId = zoneExists.id;

                    // SECURITY MERGE: If this is a "new" household ID from client, but N° ordre already exists on server, merge them!
                    let finalId = id;
                    if (!serverH && numeroordre) {
                        const duplicate = await prisma.household.findFirst({
                            where: { 
                                organizationId, 
                                numeroordre: { equals: numeroordre.trim().toUpperCase(), mode: 'insensitive' },
                                deletedAt: null
                            }
                        });
                        if (duplicate) {
                            console.log(`[SYNC-PUSH] 🛡️ AUTO-MERGE: Client ID ${id} linked to existing Server ID ${duplicate.id} (N° ${numeroordre})`);
                            finalId = duplicate.id;
                            serverH = duplicate; 
                        }
                    }

                    await prisma.household.upsert({
                        where: { id: finalId },
                        update: {
                            zoneId: finalZoneId,
                            status: status || serverH?.status || 'planned',
                            location: (normalizedLocation && Object.keys(normalizedLocation).length > 0) ? normalizedLocation : (serverH?.location || {}),
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
                            constructionData: constructionData || serverH?.constructionData || {},
                            alerts: alerts || serverH?.alerts || [],
 
                            version: (parseInt(version) || 0) + 1,
                            updatedAt: new Date()
                        },
                        create: {
                            id: finalId,
                            zoneId: finalZoneId,
                            organizationId,
                            status: status || 'planned',
                            location: normalizedLocation || {},
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

                    // Sync PostGIS point for new households - Only if coordinates are valid numbers and NOT NaN
                    if (normalizedLocation && Array.isArray(normalizedLocation.coordinates) && normalizedLocation.coordinates.length === 2 && 
                        typeof normalizedLocation.coordinates[0] === 'number' && !isNaN(normalizedLocation.coordinates[0]) &&
                        typeof normalizedLocation.coordinates[1] === 'number' && !isNaN(normalizedLocation.coordinates[1])) {
                        await prisma.$executeRaw`
                            UPDATE "Household"
                            SET location_gis = ST_SetSRID(ST_MakePoint(${normalizedLocation.coordinates[0]}, ${normalizedLocation.coordinates[1]}), 4326)
                            WHERE id = ${id}
                        `;
                    }

                    results.success.push({ id, type: 'household' });
                    
                    // --- PERFORMANCE LOGGING ---
                    if (status && (!serverH || status !== serverH.status)) {
                        // For new households without serverH, we look up the projectId from the zoneId
                        let pId = serverH?.zone?.projectId;
                        
                        if (!pId && zoneId) {
                            const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { projectId: true } });
                            pId = zone?.projectId;
                        }

                        if (pId) {
                            await logPerformance({
                                organizationId,
                                projectId: pId,
                                userId,
                                householdId: id,
                                action: 'STATUS_CHANGE',
                                oldStatus: serverH?.status,
                                newStatus: status,
                                details: { source: 'OFFLINE_SYNC', version: parseInt(version) || 1 }
                            });
                        }
                    }
                } catch (e) {
                    const errorDetails = `[${new Date().toISOString()}] [SYNC-ERROR] Household [${id}] Org [${organizationId}]: ${e.message} (Code: ${e.code}, Target: ${JSON.stringify(e.meta?.target)})\n`;
                    fs.appendFileSync(DEBUG_LOG, errorDetails);
                    console.error(errorDetails);
                    
                    results.errors.push({ 
                        id, 
                        type: 'household', 
                        error: e.message,
                        details: { code: e.code, meta: e.meta } 
                    });
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

        // --- AUTOMATED GRAPPE RECALCULATION ---
        if (results.success.length > 0) {
            try {
                // Collect affected projects
                const affectedProjectIds = new Set();
                
                // 1. From updated projects directly
                changes.projects?.forEach(p => affectedProjectIds.add(p.id));
                
                // 2. From updated households (need to find their project via zone)
                if (changes.households?.length > 0) {
                    // CRITICAL: Filter to ensure only valid UUIDs are passed to Prisma to avoid 500 errors
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    const zoneIds = Array.from(new Set(changes.households.map(h => h.zoneId).filter(id => id && uuidRegex.test(id))));
                    
                    if (zoneIds.length > 0) {
                        const zones = await prisma.zone.findMany({
                            where: { id: { in: zoneIds } },
                            select: { projectId: true }
                        });
                        zones.forEach(z => affectedProjectIds.add(z.projectId));
                    }
                }

                // Trigger recalculation for each affected project
                for (const projectId of affectedProjectIds) {
                    if (projectId) {
                        await recalculateProjectGrappes(projectId, organizationId, true);
                    }
                }
            } catch (recalcError) {
                console.error('[SYNC-PROJECT-CONFIG-ERROR] Error during post-sync grappe recalculation:', recalcError.message);
            }
        }

        if (results.errors.length > 0) {
            console.log(`[SYNC-DEBUG-DUMP] Top 5 errors passed to frontend:\n`, JSON.stringify(results.errors.slice(0, 5), null, 2));
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
        fs.appendFileSync(DEBUG_LOG, `\n[${new Date().toISOString()}] [SYNC-GLOBAL-FATAL] ${globalError.message}\n${globalError.stack}\n`);
        res.status(500).json({
            error: 'Internal Server Error during sync push',
            message: globalError.message
        });
    }
};

// @desc    Trigger specialized Kobo synchronization (background sync)
// @route   POST /api/sync/kobo
export const syncKobo = async (req, res) => {
    try {
        const { organizationId } = req.user;
        console.log(`[SYNC-KOBO] 🚀 Triggered by User: ${req.user.id} for Org: ${organizationId}`);

        // --- RESOLVE TARGET PROJECT & ZONE ---
        let defaultZoneId = req.body.zoneId || null;
        const targetProjectId = req.body.projectId;
        let targetProject = null;

        if (targetProjectId) {
            targetProject = await prisma.project.findUnique({ where: { id: targetProjectId } });
            if (!targetProject) {
                const msg = `Project ${targetProjectId} not found for organization ${organizationId}. Please refresh your project selection and retry.`;
                console.error(`[SYNC-KOBO] ${msg}`);
                return res.status(400).json({ error: msg, message: msg });
            }
        }
        
        if (!targetProject) {
            targetProject = await prisma.project.findFirst({ where: { organizationId, deletedAt: null } });
        }

        if (!targetProject) {
            targetProject = await prisma.project.create({
                data: { name: 'Projet Kobo Global', organizationId, status: 'active', budget: '0', duration: 0, totalHouses: 0, config: {} }
            });
        }

        if (!defaultZoneId) {
            const existingZone = await prisma.zone.findFirst({ 
                where: { projectId: targetProject.id, organizationId } 
            });
            if (existingZone) {
                defaultZoneId = existingZone.id;
            } else {
                const newZone = await prisma.zone.create({
                    data: { name: 'Zone Kobo A', projectId: targetProject.id, organizationId }
                });
                defaultZoneId = newZone.id;
            }
        }

        // Use the proper kobo.service (has KOBO_TOKEN from .env)
        const { syncKoboToDatabase } = await import('../../services/kobo.service.js');
        
        // --- FORCE FULL SYNC IF REQUESTED ---
        const force = req.body.force === true;
        const lastSyncDate = force ? new Date(0) : null; // Date(0) = 1970, force tout reprendre

        const results = await syncKoboToDatabase(organizationId, defaultZoneId, lastSyncDate, targetProject.id, req.user.id);

        // Sync Log
        try {
            await prisma.syncLog.create({
                data: {
                    organizationId,
                    userId: req.user.id,
                    action: 'KOBO_PULL_SYNC',
                    details: { 
                        total: results.total || 0,
                        skipped: results.skipped || 0,
                        errors: results.errors || 0,
                        applied: results.applied || 0
                    },
                    timestamp: new Date(),
                    deviceId: 'SERVER_BULK_SYNC'
                }
            });
        } catch (e) {
            if (!isPrismaSchemaDriftError(e)) {
                console.warn('[SYNC-KOBO] SyncLog not available:', e.message);
            }
        }

        res.json({
            message: 'Kobo synchronization successful',
            result: results,
            lastResult: { applied: results.applied, skipped: results.skipped, errors: results.errors }
        });
    } catch (error) {
        console.error('[SYNC-KOBO-ERROR]:', error.message);
        res.status(500).json({ error: 'Kobo synchronization failed', message: error.message });
    }
};

// @desc    Clear specific entity data (Admin utility)
// @route   DELETE /api/sync/clear/:entity
export const clearEntityData = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { entity } = req.params;
        const { password } = req.body;

        // 1. Require password in request body
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis pour cette action sensible.' });
        }

        // 2. Fetch current user with their passwordHash
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!currentUser) {
            return res.status(403).json({ error: 'Utilisateur introuvable.' });
        }

        // 3. Verify password against DB hash
        const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
        if (!isPasswordValid) {
            return res.status(403).json({ error: 'Mot de passe incorrect. Action refusée.' });
        }

        let result;
        if (entity === 'households') {
            result = await prisma.household.deleteMany({ where: { organizationId } });
        } else if (entity === 'grappes') {
            result = await prisma.grappe.deleteMany({ where: { organizationId } });
        } else if (entity === 'zones') {
            await prisma.household.deleteMany({ where: { organizationId } });
            result = await prisma.zone.deleteMany({ where: { organizationId } });
        } else if (entity === 'teams') {
            result = await prisma.team.deleteMany({ where: { organizationId } });
        } else if (entity === 'all') {
             await prisma.household.deleteMany({ where: { organizationId } });
             await prisma.grappe.deleteMany({ where: { organizationId } });
             await prisma.team.deleteMany({ where: { organizationId } });
             await prisma.zone.deleteMany({ where: { organizationId } });
             result = { count: 'all' };
        } else {
             return res.status(400).json({ error: 'Entité inconnue' });
        }

        console.log(`[SYNC-CLEAR] Cleared ${entity} for Org ${organizationId}`);
        res.json({ success: true, deletedCount: result?.count || 0, entity });
    } catch (e) {
        console.error('[SYNC-CLEAR] Error:', e);
        res.status(500).json({ error: 'Failed to clear data', details: e.message });
    }
};


// @desc    Bulk import households (Direct Server Import)
// @route   POST /api/sync/import-bulk
export const bulkImportHouseholds = async (req, res) => {
    const { organizationId } = req.user;
    const { households } = req.body;

    if (!households || !Array.isArray(households)) {
        return res.status(400).json({ error: 'Format invalide : "households" doit être un tableau.' });
    }

    console.log(`[SYNC-BULK] Starting bulk import of ${households.length} households for Org: ${organizationId}`);
    
    try {
        // 1. Validation de la Zone (on prend la zone du premier ménage ou une zone par défaut)
        const firstHousehold = households[0];
        let zoneId = firstHousehold.zoneId;

        let zoneExists = await prisma.zone.findUnique({ where: { id: zoneId } });
        if (!zoneExists) {
            // Recours à une zone existante ou création
            const fallbackZone = await prisma.zone.findFirst({ where: { organizationId, deletedAt: null } });
            if (fallbackZone) {
                zoneId = fallbackZone.id;
            } else {
                const project = await prisma.project.findFirst({ where: { organizationId } });
                if (project) {
                    const newZone = await prisma.zone.create({
                        data: { name: 'Zone Import', projectId: project.id, organizationId }
                    });
                    zoneId = newZone.id;
                } else {
                    return res.status(400).json({ error: 'Aucun projet trouvé pour cet import. Créez d\'abord un projet.' });
                }
            }
        }

        // 2. Préparation des données pour l'insertion + DÉDOUBLONNAGE DANS LE FICHIER
        const processedBatch = new Map();
        
        households.forEach(h => {
            // Helper to find a value in 'h' by a key that might have variations (case, space, accents)
            const getFuzzy = (keys) => {
                const normalizedSearchKeys = keys.map(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
                // Get all actual keys and their normalized versions once
                const actualKeysMap = {};
                for (const k in h) {
                    actualKeysMap[k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()] = k;
                }
                
                // Iterate through SEARCH keys in order of priority
                for (const searchKey of normalizedSearchKeys) {
                    if (actualKeysMap[searchKey]) return h[actualKeysMap[searchKey]];
                }
                return null;
            };


            const rawLat = getFuzzy(['latitude', 'lat', 'gps_latitude', 'y']);
            const rawLon = getFuzzy(['longitude', 'lon', 'lng', 'long', 'gps_longitude', 'x']);
            
            const lat = (rawLat !== undefined && rawLat !== null && rawLat !== '') ? parseFloat(rawLat) : null;
            const lon = (rawLon !== undefined && rawLon !== null && rawLon !== '') ? parseFloat(rawLon) : null;

            const ownerObject = (h.owner && typeof h.owner === 'object') ? h.owner : {};
            const derivedName =
                h.name ||
                getFuzzy(['name', 'nom', 'prenom et nom', 'beneficiaire']) ||
                ownerObject.name ||
                ownerObject.nom ||
                null;
                
            const derivedPhone =
                h.phone ||
                getFuzzy(['phone', 'telephone', 'tel', 'mobile']) ||
                ownerObject.phone ||
                ownerObject.telephone ||
                null;

            const importMetadata = {
                commune: getFuzzy(['commune', 'village', 'localite']) || null,
                photo: h.photo || null,
                importedFrom: 'bulk-import',
            };

            let numeroordre = getFuzzy(['numeroordre', 'numero_ordre', 'n_ordre', 'id_menage', 'numero d\'ordre']) || h.id;
            if (numeroordre && String(numeroordre).endsWith('.0')) {
                numeroordre = String(numeroordre).substring(0, String(numeroordre).length - 2);
            }
            const normalizedNum = numeroordre ? String(numeroordre).toUpperCase().trim() : null;

            const item = {
                id: String(h.id || normalizedNum || `import_${Math.random().toString(36).substr(2, 9)}`),
                organizationId,
                zoneId: zoneId,
                numeroordre: normalizedNum,
                status: h.status || 'planned',
                owner: {
                    ...ownerObject,
                    name: derivedName,
                    phone: derivedPhone,
                    commune: importMetadata.commune,
                },
                location: h.location || {},
                koboData: importMetadata,
                name: derivedName,
                phone: derivedPhone,
                region: getFuzzy(['region', 'region_nom', 'nom_region']) || null,
                departement: getFuzzy(['departement', 'dept', 'prefecture']) || null,
                village: getFuzzy(['village', 'nom village', 'nom_village', 'commune', 'localite', 'quartier']) || null,
                latitude: lat,
                longitude: lon,
                source: h.source || 'Excel-Import',
                version: 1
            };

            // If business key exists, ensure we only take the one with a valid ID or the first occurrence
            // This prevents duplicates if the same numeroordre is twice in the EXCEL file
            if (normalizedNum) {
                if (!processedBatch.has(normalizedNum)) {
                    processedBatch.set(normalizedNum, item);
                } else {
                    console.log(`⚠️ [Dedup-File] Duplicate numeroordre ${normalizedNum} found in file, skipping secondary entry.`);
                }
            } else {
                processedBatch.set(item.id, item);
            }
        });

        const dataToInsert = Array.from(processedBatch.values());

        // 3. SECURE MATCHING: Resolve existing records by numeroordre to prevent duplicates
        console.log(`[SYNC-BULK] 🔍 Scanning for existing business keys (numeroordre)...`);
        const incomingNums = dataToInsert.map(d => d.numeroordre).filter(Boolean);
        const existingRecords = await prisma.household.findMany({
            where: {
                organizationId,
                numeroordre: { in: incomingNums },
                deletedAt: null
            },
            select: { id: true, numeroordre: true }
        });

        const numToIdMap = new Map();
        existingRecords.forEach(r => numToIdMap.set(r.numeroordre.toUpperCase().trim(), r.id));

        // 4. Processing imports (Sequential Upsert to guarantee integrity)
        let importedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        for (const item of dataToInsert) {
            try {
                // Determine the best primary key (Business Key match > Provided ID)
                const existingId = item.numeroordre ? numToIdMap.get(item.numeroordre) : null;
                const targetId = existingId || item.id;

                const result = await prisma.household.upsert({
                    where: { id: targetId },
                    update: {
                        ...item,
                        id: targetId, // Keep existing ID if matched
                        updatedAt: new Date(),
                        version: { increment: 1 }
                    },
                    create: {
                        ...item,
                        id: targetId // Use matched ID or provided ID
                    }
                });

                if (existingId || result.version > 1) updatedCount++;
                else createdCount++;
                
                importedCount++;
            } catch (e) {
                console.error(`[SYNC-BULK-ITEM-ERROR] Failed to import household ${item.id}:`, e.message);
            }
        }

        // 4. Mise à jour PostGIS (Spatial)
        await prisma.$executeRaw`
            UPDATE "Household"
            SET location_gis = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
            WHERE "organizationId" = ${organizationId} 
            AND (location_gis IS NULL OR latitude != ST_Y(location_gis::geometry))
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
        `;

        console.log(`[SYNC-BULK] Success: ${importedCount} households processed.`);
        
        // 5. Trigger Grappe Recalculation after bulk import
        const firstProject = await prisma.project.findFirst({ where: { organizationId } });
        if (firstProject) {
            await recalculateProjectGrappes(firstProject.id, organizationId, true).catch(err => {
                console.error('[SYNC-BULK-RECALC] Failed to trigger grappe recalculation:', err.message);
            });
        }

        res.json({
            success: true,
            importedCount,
            message: `${importedCount} ménages traités (import/update) sur le serveur.`
        });

    } catch (error) {
        console.error('[SYNC-BULK-FATAL]:', error);
        res.status(500).json({ error: 'Bulk import failed', details: error.message });
    }
};
