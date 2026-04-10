import prisma from '../core/utils/prisma.js';
import { generateDynamicGrappes } from '../utils/clustering.js';

// In-memory debounce timers and locks per project
const recalculationTimers = new Map();
const activeRecalculations = new Set();

/**
 * Recalculates grappes (clusters) for a project based on current household data.
 * Updates the project configuration with the new grappes and zone assignments.
 * 
 * Includes a debouncing mechanism to handle rapid successive calls (e.g. during sync push batches).
 * 
 * @param {string} projectId 
 * @param {string} organizationId 
 * @param {boolean} force - Force recalculation even if grappes exist
 */
export async function recalculateProjectGrappes(projectId, organizationId, force = false) {
    if (!projectId) return;

    // 1. If currently executing, skip (it will be triggered by debounce after completion if needed)
    if (activeRecalculations.has(projectId)) {
        console.log(`[PROJECT-CONFIG] ⏳ Recalculation in progress for ${projectId}. Batch skipped.`);
        return { success: true, message: 'Recalculation in progress' };
    }

    // 2. Debounce logic: Delay execution to catch subsequent batches
    if (recalculationTimers.has(projectId)) {
        clearTimeout(recalculationTimers.get(projectId));
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(async () => {
            recalculationTimers.delete(projectId);
            activeRecalculations.add(projectId);
            
            try {
                const result = await _executeRecalculation(projectId, organizationId, force);
                resolve(result);
            } catch (err) {
                console.error(`[PROJECT-CONFIG] Fatal error during debounced recalculation:`, err);
                reject(err);
            } finally {
                activeRecalculations.delete(projectId);
            }
        }, 1500); // 1.5s debounce window

        recalculationTimers.set(projectId, timer);
    });
}

/**
 * Internal execution logic for grappe recalculation
 */
async function _executeRecalculation(projectId, organizationId, force) {
    try {
        console.log(`[PROJECT-CONFIG] 🤖 Automating grappe generation for project: ${projectId} (force: ${force})`);
        
        // 0. Prevent auto-overwrite if grappes already exist, unless forced
        const projectCheck = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
                deletedAt: null
            }
        });

        if (!projectCheck) {
            throw new Error(`Project ${projectId} not found for organization ${organizationId}`);
        }
        
        const currentGrappesCount = projectCheck?.config?.grappesConfig?.grappes?.length || 0;
        if (currentGrappesCount > 0 && !force) {
            console.log(`[PROJECT-CONFIG] ⏭️ Project ${projectId} already has ${currentGrappesCount} grappes. Auto-clustering skipped to preserve assignments. Use force=true to override.`);
            return { success: true, grappesCount: currentGrappesCount, skipped: true };
        }

        // 1. Fetch all households for this project
        const allHouseholds = await prisma.household.findMany({
            where: { 
                organizationId,
                zone: { projectId },
                deletedAt: null
            }
        });

        if (allHouseholds.length === 0) {
            console.log('[PROJECT-CONFIG] No households found for this project. Skipping clustering.');
            return { success: true, grappesCount: 0, message: 'No households' };
        }

        // 2. Generate Grappes using K-Means / Village Fallback
        let { grappes, sous_grappes } = generateDynamicGrappes(allHouseholds);
        
        // --- NEW: SORT & RENAME GRAPPES (REGION - G1, G2...) ---
        grappes.sort((a, b) => {
            const regA = a.region || '';
            const regB = b.region || '';
            if (regA !== regB) return regA.localeCompare(regB);
            const vA = a.points?.[0]?.village || '';
            const vB = b.points?.[0]?.village || '';
            return vA.localeCompare(vB);
        });

        const previousProjectGrappeIds = Array.from(
            new Set(allHouseholds.map(h => h.grappeId).filter(Boolean))
        );
        const persistedGrappes = [];
        const generatedToDbGrappeIds = new Map();

        await prisma.household.updateMany({
            where: {
                organizationId,
                zone: { projectId },
                deletedAt: null,
                grappeId: { not: null }
            },
            data: { grappeId: null }
        });

        // --------------------------------------------
        // 3. UPSERT INTO PRISMA GRAPPE TABLE & LINK HOUSEHOLDS
        console.log(`[PROJECT-CONFIG] 💽 Upserting ${grappes.length} grappes...`);
        for (let i = 0; i < grappes.length; i++) {
            const cluster = grappes[i];
            const regionName = cluster.region || 'Zone Inconnue';
            
            // 1. Ensure Region exists
            const region = await prisma.region.upsert({
                where: { name: regionName },
                update: {},
                create: { name: regionName }
            });

            // 2. Ensure Grappe exists
            const dbGrappe = await prisma.grappe.upsert({
                where: {
                    name_regionId: {
                        name: cluster.nom,
                        regionId: region.id
                    }
                },
                update: {
                    organizationId
                },
                create: {
                    name: cluster.nom,
                    regionId: region.id,
                    organizationId
                }
            });

            generatedToDbGrappeIds.set(cluster.id, dbGrappe.id);
            persistedGrappes.push({
                ...cluster,
                id: dbGrappe.id,
                nom: dbGrappe.name,
                region: region.name
            });

            // 3. Link Households to this Grappe (Performance Optimization)
            if (cluster.points && cluster.points.length > 0) {
                const householdIds = cluster.points.map(p => p.id);
                await prisma.household.updateMany({
                    where: {
                        id: { in: householdIds },
                        organizationId,
                        zone: { projectId },
                        deletedAt: null
                    },
                    data: { grappeId: dbGrappe.id }
                });
            }
        }
        console.log(`[PROJECT-CONFIG] 💽 Upsert and linking completed.`);

        const persistedSousGrappes = sous_grappes.map(sub => ({
            ...sub,
            grappe_id: generatedToDbGrappeIds.get(sub.grappe_id) || sub.grappe_id
        }));
        const newGrappeIds = persistedGrappes.map(g => g.id);

        const staleGrappeIds = previousProjectGrappeIds.filter(id => !newGrappeIds.includes(id));
        // --------------------------------------------
        
        // 3. Fetch current project to get and update config
        const project = projectCheck;

        const config = project.config || {};
        config.grappesConfig = { grappes: persistedGrappes, sous_grappes: persistedSousGrappes };
        
        // 4. Update config.zones to include these grappes
        const zones = config.zones || [];
        
        // Group grappes by region
        const grappesByRegion = {};
        persistedGrappes.forEach(g => {
            if (!grappesByRegion[g.region]) grappesByRegion[g.region] = [];
            grappesByRegion[g.region].push(g.id);
        });

        zones.forEach(zoneConfig => {
            if (zoneConfig?.name && !grappesByRegion[zoneConfig.name]) {
                zoneConfig.clusters = [];
            }
        });

        // Update or create entries in config.zones
        for (const region in grappesByRegion) {
            let zoneConfig = zones.find(z => z.name === region);
            if (!zoneConfig) {
                zoneConfig = {
                    id: `zone_${Date.now()}_${region}`,
                    name: region,
                    clusters: [],
                    teamAllocations: []
                };
                zones.push(zoneConfig);
            }
            zoneConfig.clusters = grappesByRegion[region];
        }

        config.zones = zones;

        // 5. MIGRATION DOUCE: Transfer team assignments from Zone to Grappe if matching by region
        console.log(`[PROJECT-CONFIG] 🚚 Migrating team assignments (Zone -> Grappe)...`);
        const teams = await prisma.team.findMany({
            where: { projectId, organizationId, deletedAt: null }
        });

        const teamsToReset = teams
            .filter(team => team.grappeId && !newGrappeIds.includes(team.grappeId))
            .map(team => team.id);

        if (teamsToReset.length > 0) {
            await prisma.team.updateMany({
                where: { id: { in: teamsToReset } },
                data: { grappeId: null }
            });
        }
        
        for (const team of teams) {
            if ((!team.grappeId || teamsToReset.includes(team.id)) && team.zoneId) {
                const zone = await prisma.zone.findUnique({ where: { id: team.zoneId } });
                if (zone) {
                    // Find a grappe in this region (priority: Unknown zone or first grappe)
                    const region = await prisma.region.findUnique({ 
                        where: { name: zone.name },
                        include: {
                            grappes: {
                                where: { organizationId }
                            }
                        }
                    });
                    if (region && region.grappes.length > 0) {
                        const targetGrappe = region.grappes.find(g => g.name.includes('Inconnue')) || region.grappes[0];
                        await prisma.team.update({
                            where: { id: team.id },
                            data: { grappeId: targetGrappe.id, zoneId: null }
                        });
                        console.log(`[PROJECT-CONFIG]   Mapped team ${team.name} to grappe ${targetGrappe.name}`);
                    }
                }
            }
        }

        if (staleGrappeIds.length > 0) {
            const orphanedGrappes = await prisma.grappe.findMany({
                where: {
                    id: { in: staleGrappeIds },
                    organizationId
                },
                select: {
                    id: true,
                    _count: {
                        select: {
                            households: true,
                            teams: true
                        }
                    }
                }
            });

            const deletableGrappeIds = orphanedGrappes
                .filter(g => g._count.households === 0 && g._count.teams === 0)
                .map(g => g.id);

            if (deletableGrappeIds.length > 0) {
                await prisma.grappe.deleteMany({
                    where: {
                        id: { in: deletableGrappeIds },
                        organizationId
                    }
                });
            }
        }

        // 6. Save updated config to project
        await prisma.project.update({
            where: { id: projectId },
            data: { config }
        });

        console.log(`[PROJECT-CONFIG] ✅ Project config updated with ${grappes.length} grappes.`);
        return { success: true, grappesCount: grappes.length };
    } catch (error) {
        console.error(`[PROJECT-CONFIG] ❌ Error during grappe recalculation for project ${projectId}:`, error.message);
        throw error;
    }
}
