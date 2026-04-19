import prisma from '../../core/utils/prisma.js';
import { redisConnection } from '../../core/utils/queueManager.js';

// @desc    Get project KPIs (Snapshot current state)
// @route   GET /api/kpi/:projectId
export const getProjectKPIs = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { organizationId } = req.user;

        // 0. Tentative de récupération depuis le cache Redis
        const cacheKey = `kpi:${organizationId}:${projectId}`;
        try {
            if (redisConnection && redisConnection.status === 'ready') {
                const cachedData = await Promise.race([
                    redisConnection.get(cacheKey),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis GET timeout')), 500))
                ]);
                if (cachedData) {
                    console.log(`[CACHE HIT] KPI pour le projet ${projectId}`);
                    return res.json(JSON.parse(cachedData));
                }
            }
        } catch (cacheError) {
            console.error('[REDIS CACHE ERROR] Pass bypass:', cacheError.message);
        }

        console.log(`[CACHE MISS] Calcul des KPI pour le projet ${projectId}`);

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId }
        });

        if (!project) {
            // Return 200 with null metrics to verify project existence without console error noise
            // This happens for newly created local projects not yet synced
            return res.status(200).json({
                projectId,
                projectName: 'Project pending sync',
                metrics: null
            });
        }

        // Note: Households array removed for performance - using aggregations instead
        // --- DEEP KOBO ANALYTICS (Raw SQL for Performance & Granularity) ---

        // 1. Global Totals
        const koboAggrResult = await prisma.$queryRaw`
            SELECT 
                SUM(COALESCE(NULLIF("koboData"->'group_ed3yt17'->>'Nombre_de_KIT_pr_par', '')::numeric, 0)) as kit_prepared,
                SUM(COALESCE(NULLIF("koboData"->'group_ed3yt17'->>'Nombre_de_KIT_Charg_pour_livraison', '')::numeric, 0)) as kit_loaded,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_câble_2_5mm_Int_rieure', '')::numeric, 0)) as câble_2_5,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_câble_1_5mm_Int_rieure', '')::numeric, 0)) as câble_1_5,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_câble_arm_4mm', '')::numeric, 0)) as câble_4_armed,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_C_ble_arm_1_5mm', '')::numeric, 0)) as câble_1_5_armed,
                COUNT(DISTINCT "koboData"->>'today') as days_worked,
                COUNT(*) filter (where status = 'Terminé' OR status = 'Réception: Validée') as total_validated
            FROM "Household" h
            JOIN "Zone" z ON h."zoneId" = z.id
            WHERE z."projectId" = ${projectId} AND h."organizationId" = ${organizationId} AND h."deletedAt" IS NULL
        `;

        // 2. Stats by Zone
        const zoneStats = await prisma.$queryRaw`
            SELECT 
                z.name as zone_name,
                COUNT(*) as total,
                COUNT(*) filter (where h.status = 'Terminé' OR h.status = 'Réception: Validée') as done,
                SUM(COALESCE(NULLIF(h."koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_câble_2_5mm_Int_rieure', '')::numeric, 0) +
                    COALESCE(NULLIF(h."koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_câble_1_5mm_Int_rieure', '')::numeric, 0) +
                    COALESCE(NULLIF(h."koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_câble_arm_4mm', '')::numeric, 0) +
                    COALESCE(NULLIF(h."koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_C_ble_arm_1_5mm', '')::numeric, 0)) as câble_total
            FROM "Household" h
            JOIN "Zone" z ON h."zoneId" = z.id
            WHERE z."projectId" = ${projectId} AND h."organizationId" = ${organizationId} AND h."deletedAt" IS NULL
            GROUP BY z.id, z.name
        `;

        // 3. Stats by Team (New structured logging + Leader Name)
        const teamStats = await prisma.$queryRaw`
            SELECT 
                COALESCE(t.name, 'Équipe Inconnue') as team_name,
                COALESCE(u.name, 'N/A') as leader_name,
                COUNT(*) as done,
                COUNT(DISTINCT DATE(pl."timestamp")) as days_active,
                pl."tradeKey"
            FROM "PerformanceLog" pl
            LEFT JOIN "Team" t ON pl."teamId" = t.id
            LEFT JOIN "User" u ON pl."userId" = u.id
            WHERE pl."projectId" = ${projectId} 
              AND pl."organizationId" = ${organizationId}
              AND pl."action" = 'STATUS_CHANGE'
              AND pl."newStatus" IN ('Terminé', 'Réception: Validée', 'Conforme')
            GROUP BY t.id, t.name, u.name, pl."tradeKey"
        `;


        const aggr = koboAggrResult[0] || {};
        const daysWorked = Number(aggr.days_worked || 1);
        const totalValidated = Number(aggr.total_validated || 0);

        const totalcâble = Number(aggr.câble_2_5 || 0) + 
                           Number(aggr.câble_1_5 || 0) + 
                           Number(aggr.câble_4_armed || 0) + 
                           Number(aggr.câble_1_5_armed || 0);

        // --- OPTIMIZED COUNTS (SQL Aggregate instead of JS filter) ---
        const statusGroups = await prisma.household.groupBy({
            by: ['status'],
            where: { zone: { projectId }, organizationId, deletedAt: null },
            _count: true
        });

        const getCount = (statusName) => statusGroups.find(g => g.status === statusName)?._count || 0;
        const getCountByPattern = (pattern) => statusGroups
            .filter(g => g.status && g.status.toLowerCase().includes(pattern.toLowerCase()))
            .reduce((sum, g) => sum + g._count, 0);
        const getCountByUPattern = (pattern) => statusGroups
            .filter(g => g.status && g.status.toUpperCase().includes(pattern.toUpperCase()))
            .reduce((sum, g) => sum + g._count, 0);

        const totalHouseholds = statusGroups.reduce((sum, g) => sum + g._count, 0);
        const murCount = getCount('Murs');
        const reseauCount = getCount('Réseau');
        const interieurCount = getCount('Intérieur');

        // Use the existing totalValidated from raw SQL or update it with aggregate counts
        const validatedCount = getCount('Terminé') + getCount('Réception: Validée');

        const problemCount = getCount('Problème') + getCount('Inéligible');
        const hseCount = getCountByPattern('hse');
        const pvRetardCount = getCountByPattern('retard');
        const pvncCount = getCountByUPattern('PVNC');
        const pvrCount = getCountByUPattern('PVR');
        const pvhseCount = getCountByUPattern('PVHSE');
        const totalPV = getCountByUPattern('PV');
        const totalArchived = validatedCount;

        const actionRequiredCount = await prisma.household.count({
            where: {
                zone: { projectId },
                organizationId,
                deletedAt: null,
                // Simplified count for alerts
                NOT: { alerts: { equals: [] } }
            }
        });

        const nonConformeCount = getCountByPattern('non-conform');
        const conformeCount = getCountByPattern('conform');

        // Audit logs critiques (si besoin)
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                organizationId,
                module: 'HSE',
                severity: { in: ['critical', 'warning'] },
                resource: { contains: projectId }
            },
            orderBy: { timestamp: 'desc' },
            take: 10
        });

        const igppRaw = totalHouseholds > 0 ? (
            (validatedCount * 1.0) + (interieurCount * 0.75) + (reseauCount * 0.45) + (murCount * 0.2)
        ) / (totalHouseholds - problemCount || 1) * 100 : 0;

        const result = {
            projectId,
            projectName: project.name,
            timestamp: new Date().toISOString(),
            metrics: {
                totalHouseholds,
                electrifiedHouseholds: validatedCount,
                progressPercent: totalHouseholds > 0 ? Math.round((validatedCount / (totalHouseholds - problemCount || 1)) * 100) : 0,
                igppScore: Math.min(100, Math.round(igppRaw * 10) / 10),
                incidentsHSE: hseCount,
                pvRetard: pvRetardCount,
                totalPV,
                totalArchived,
                pvnc: pvncCount,
                pvr: pvrCount,
                pvhse: pvhseCount,
                nonConforme: nonConformeCount,
                conforme: conformeCount,
                actionRequired: actionRequiredCount,
                auditLogs,
                performance: {
                    daysWorked,
                    avgPerDay: Math.round((validatedCount / daysWorked) * 10) / 10,
                    avgcâblePerHouse: validatedCount > 0 ? Math.round((totalcâble / validatedCount) * 10) / 10 : 0,
                },
                technical: {
                    câble25: Number(aggr.câble_2_5 || 0),
                    câble15: Number(aggr.câble_1_5 || 0),
                    câble4Armed: Number(aggr.câble_4_armed || 0),
                    câble15Armed: Number(aggr.câble_1_5_armed || 0),
                    totalConsumption: totalcâble
                },
                logistics: {
                    kitPrepared: Number(aggr.kit_prepared || 0),
                    kitLoaded: Number(aggr.kit_loaded || 0),
                    gap: Number(aggr.kit_prepared || 0) - Number(aggr.kit_loaded || 0)
                },
                breakdown: {
                    byZone: zoneStats.map((z) => {
                        const total = Number(z.total);
                        const done = Number(z.done);
                        return {
                            name: z.zone_name,
                            total,
                            done,
                            câble: Number(z.câble_total),
                            progress: total > 0 ? Math.round((done / total) * 100) : 0
                        };
                    }),
                    byTeam: teamStats.map((t) => {
                        const days = Number(t.days_active);
                        const done = Number(t.done);
                        return {
                            worker: t.team_name,
                            leader: t.leader_name,
                            trade: t.tradeKey,
                            done,
                            days,
                            yield: days > 0 ? Math.round((done / days) * 10) / 10 : 0
                        };
                    })
                }
            }
        };

        // Enregistrement dans le cache pour 5 minutes (300 secondes)
        try {
            if (redisConnection && redisConnection.status === 'ready') {
                await Promise.race([
                    redisConnection.setex(cacheKey, 300, JSON.stringify(result)),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis SET timeout')), 500))
                ]);
            }
        } catch (cacheError) {
            console.error('[REDIS CACHE SET ERROR]', cacheError.message);
        }

        res.json(result);
    } catch (error) {
        console.error('KPI calculation error:', error);
        res.status(500).json({ error: 'Server error while calculating KPIs' });
    }
};

// @desc    Get global organization summary
// @route   GET /api/kpi/summary
export const getGlobalSummary = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const projects = await prisma.project.findMany({
            where: { organizationId, deletedAt: null },
            select: { id: true, name: true, status: true }
        });

        const stats = await prisma.household.groupBy({
            by: ['status'],
            where: { organizationId, deletedAt: null },
            _count: true
        });

        res.json({
            organizationId,
            projectCount: projects.length,
            statusDistribution: stats,
            projects
        });
    } catch (error) {
        console.error('Global summary error:', error);
        res.status(500).json({ error: 'Server error while fetching global summary' });
    }
};
