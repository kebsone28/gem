import prisma from '../core/utils/prisma.js';
import { generateDynamicGrappes } from '../utils/clustering.js';

/**
 * Recalculates grappes (clusters) for a project based on current household data.
 * Updates the project configuration with the new grappes and zone assignments.
 * 
 * @param {string} projectId 
 * @param {string} organizationId 
 */
export async function recalculateProjectGrappes(projectId, organizationId) {
    if (!projectId) return;

    try {
        console.log(`[PROJECT-CONFIG] 🤖 Automating grappe generation for project: ${projectId}`);
        
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
            return;
        }

        // 2. Generate Grappes using K-Means
        const { grappes, sous_grappes } = generateDynamicGrappes(allHouseholds);
        
        // 3. Fetch current project to get and update config
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            console.error(`[PROJECT-CONFIG] Project ${projectId} not found.`);
            return;
        }

        const config = project.config || {};
        config.grappesConfig = { grappes, sous_grappes };
        
        // 4. Update config.zones to include these grappes
        const zones = config.zones || [];
        
        // Group grappes by region
        const grappesByRegion = {};
        grappes.forEach(g => {
            if (!grappesByRegion[g.region]) grappesByRegion[g.region] = [];
            grappesByRegion[g.region].push(g.id);
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
            // Explicitly union the clusters to avoid duplicates and preserve assigned ones
            const existingClusters = new Set(zoneConfig.clusters || []);
            grappesByRegion[region].forEach(cid => existingClusters.add(cid));
            zoneConfig.clusters = Array.from(existingClusters);
        }

        config.zones = zones;

        // 5. Save updated config to project
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
