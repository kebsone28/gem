/**
 * Agent Background - Gestion de l'Escalade des Alertes
 * S'exécute toutes les heures pour vérifier et escalader les alertes critiques
 */

import { alertsService } from '../modules/alerts/alerts.service.js';
import prisma from '../core/utils/prisma.js';
import logger from '../utils/logger.js';

export const startAlertEscalationAgent = () => {
  // Exécuter toutes les heures
  const interval = setInterval(async () => {
    try {
      logger.info('[ALERTS-AGENT] Starting escalation check...');
      await alertsService.handleEscalation();
      logger.info('[ALERTS-AGENT] Escalation check completed successfully');
    } catch (err) {
      logger.error('[ALERTS-AGENT] Error during escalation check:', err);
    }
  }, 60 * 60 * 1000); // 1 heure

  return interval;
};

/**
 * Agent pour créer les alertes IGPP basées sur les KPI
 * S'exécute toutes les 5 minutes pour évaluer les seuils
 */
export const startIGPPAlertAgent = async () => {
  const interval = setInterval(async () => {
    try {
      logger.info('[IGPP-ALERT-AGENT] Checking KPI thresholds...');
      
      // Récupérer tous les projets actifs
      const projects = await prisma.project.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, organizationId: true },
      });

      for (const project of projects) {
        try {
          await checkProjectKPIsAndCreateAlerts(project.id, project.organizationId);
        } catch (err) {
          logger.error(`[IGPP-ALERT-AGENT] Error checking project ${project.id}:`, err);
        }
      }
      
      logger.info('[IGPP-ALERT-AGENT] KPI check completed');
    } catch (err) {
      logger.error('[IGPP-ALERT-AGENT] Error during KPI check:', err);
    }
  }, 5 * 60 * 1000); // 5 minutes

  return interval;
};

/**
 * Vérifier les seuils KPI et créer les alertes
 */
async function checkProjectKPIsAndCreateAlerts(projectId, organizationId) {
  try {
    const config = await prisma.alertConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) {
      logger.warn(`[IGPP-ALERT-AGENT] No alert config for org ${organizationId}`);
      return;
    }

    const kpiData = await aggregateProjectKPIs(projectId, organizationId);

    const safeKpiData = {
      electrifiedHouseholds: kpiData.electrifiedHouseholds ?? 0,
      pvRetard: kpiData.pvRetard ?? 0,
      pvnc: kpiData.pvnc ?? 0,
      budgetUsagePercent: kpiData.budgetUsagePercent ?? 0,
      logistics: {
        kitPrepared: kpiData.logistics?.kitPrepared ?? 0,
      },
      performance: {
        avgPerDay: kpiData.performance?.avgPerDay ?? 0,
      },
    };

    const alertsToCreate = [];

    // 1. Alerte Stock Critique
    if (
      safeKpiData.logistics.kitPrepared !== undefined &&
      safeKpiData.logistics.kitPrepared < config.stockCritical
    ) {
      alertsToCreate.push({
        type: 'IGPP_STOCK',
        severity: safeKpiData.logistics.kitPrepared === 0 ? 'CRITICAL' : 'HIGH',
        title: `Stock critique: ${safeKpiData.logistics.kitPrepared} kits disponibles`,
        description: `Nombre de kits préparés: ${safeKpiData.logistics.kitPrepared}. Seuil critique: ${config.stockCritical}`,
        recommendedAction: 'Préparer plus de kits immédiatement',
      });
    }

    // 2. Alerte Budget
    if (
      safeKpiData.budgetUsagePercent !== undefined &&
      safeKpiData.budgetUsagePercent > config.budgetThreshold
    ) {
      alertsToCreate.push({
        type: 'IGPP_BUDGET',
        severity: safeKpiData.budgetUsagePercent > 95 ? 'CRITICAL' : 'HIGH',
        title: `Budget utilisé à ${safeKpiData.budgetUsagePercent}%`,
        description: `Utilisation du budget: ${safeKpiData.budgetUsagePercent}%. Seuil d'alerte: ${config.budgetThreshold}%`,
        recommendedAction: 'Vérifier les dépenses et obtenir une approbation supplémentaire si nécessaire',
      });
    }

    // 3. Alerte Électricité
    if (
      safeKpiData.electrifiedHouseholds !== undefined &&
      safeKpiData.electrifiedHouseholds < config.electricityMin
    ) {
      alertsToCreate.push({
        type: 'IGPP_ELECTRICITY',
        severity: 'HIGH',
        title: `Accès électricité faible: ${safeKpiData.electrifiedHouseholds}%`,
        description: `Pourcentage de ménages avec accès électricité: ${safeKpiData.electrifiedHouseholds}%. Minimum requis: ${config.electricityMin}%`,
        recommendedAction: 'Vérifier les interruptions d\'électricité et contacter le fournisseur si nécessaire',
      });
    }

    // 4. Alerte Rendement Équipes
    if (safeKpiData.performance?.avgPerDay !== undefined) {
      const teamEfficiency = safeKpiData.performance.avgPerDay;
      if (teamEfficiency < 1) {
        alertsToCreate.push({
          type: 'IGPP_TEAM_PERFORMANCE',
          severity: 'MEDIUM',
          title: `Rendement équipes faible: ${teamEfficiency.toFixed(2)} ménages/jour`,
          description: `Rendement moyen des équipes: ${teamEfficiency.toFixed(2)} ménages/jour. Seuil souhaité: 1+`,
          recommendedAction: 'Vérifier les obstacles, fournir du soutien supplémentaire ou réallouer les ressources',
        });
      }
    }

    // 5. Alerte Retard (PV non complétés)
    if (safeKpiData.pvRetard !== undefined && safeKpiData.pvRetard > config.delayThreshold) {
      alertsToCreate.push({
        type: 'IGPP_DELAY',
        severity: 'HIGH',
        title: `Retards PV importants: ${safeKpiData.pvRetard} logements`,
        description: `Nombre de logements en retard PV: ${safeKpiData.pvRetard}. Seuil d'alerte: ${config.delayThreshold}`,
        recommendedAction: 'Prioriser les PV en retard et identifier les obstacles',
      });
    }

    for (const alertData of alertsToCreate) {
      try {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            projectId,
            organizationId,
            type: alertData.type,
            status: 'OPEN',
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
        });

        if (!existingAlert) {
          const newAlert = await prisma.alert.create({
            data: {
              ...alertData,
              projectId,
              organizationId,
              status: 'OPEN',
              metadata: { kpiCheck: true, timestamp: new Date().toISOString() },
            },
          });

          logger.info(`[IGPP-ALERT-AGENT] Alert created: ${newAlert.id}`);
          await alertsService.triggerNotifications(newAlert);
        }
      } catch (err) {
        logger.error('[IGPP-ALERT-AGENT] Error creating alert:', err);
      }
    }
  } catch (err) {
    logger.error(`[IGPP-ALERT-AGENT] Error in checkProjectKPIsAndCreateAlerts:`, err);
  }
}

/**
 * Agréger les données KPI à partir de la base de données
 */
async function aggregateProjectKPIs(projectId, organizationId) {
  try {
    const households = await prisma.household.findMany({
      where: { projectId: projectId, organizationId, status: 'ACTIVE' },
    });

    const missions = await prisma.mission.findMany({
      where: { projectId },
    });

    const totalHouseholds = households.length;
    const electrifiedHouseholds = households.filter((h) => h.hasElectricity).length;
    const electrificationPercent =
      totalHouseholds > 0 ? Math.round((electrifiedHouseholds / totalHouseholds) * 100) : 0;

    const pvMissions = missions.filter((m) => m.type?.startsWith('PV'));
    const pvRetard = pvMissions.filter((m) => m.status === 'RETARD').length;
    const pvnc = pvMissions.filter((m) => m.type?.includes('NC')).length;

    return {
      electrifiedHouseholds: electrificationPercent,
      pvRetard: pvRetard,
      pvnc: pvnc,
      budgetUsagePercent: await calculateBudgetUsage(organizationId),
      logistics: {
        kitPrepared: await calculateKitPrepared(projectId, organizationId),
      },
      performance: {
        avgPerDay: await calculateAvgPerDay(organizationId),
      },
    };
  } catch (err) {
    logger.error('[IGPP-ALERT-AGENT] Error aggregating KPIs:', err);
    return {};
  }
}

async function calculateBudgetUsage(organizationId) {
  try {
    const result = await prisma.$queryRaw`
      SELECT 
        COALESCE(SUM(CASE WHEN h.status IN ('Terminé', 'Réception: Validée') THEN p.indicatorValue ELSE 0 END), 0)::float as budgetUsed,
        COALESCE(SUM(p.indicatorValue), 0)::float as budgetPlanned
      FROM "Household" h
      JOIN "Zone" z ON h."zoneId" = z.id
      JOIN "Project" pr ON z."projectId" = pr.id
      LEFT JOIN "Indicator" p ON pr.id = p."projectId" AND p.key = 'budget'
      WHERE h."organizationId" = ${organizationId} AND h."deletedAt" IS NULL
    `;
    const row = result[0] || {};
    const budgetUsed = Number(row.budgetUsed || 0);
    const budgetPlanned = Number(row.budgetPlanned || 1);
    return Math.round((budgetUsed / budgetPlanned) * 100);
  } catch {
    return 0;
  }
}

async function calculateKitPrepared(projectId, organizationId) {
  try {
    const result = await prisma.$queryRaw`
      SELECT COALESCE(SUM(
        COALESCE(NULLIF("koboData"->'group_ed3yt17'->>'Nombre_de_KIT_pr_par', '')::numeric, 0)
      ), 0)::int as kitPrepared
      FROM "Household" h
      JOIN "Zone" z ON h."zoneId" = z.id
      WHERE z."projectId" = ${projectId} AND h."organizationId" = ${organizationId}
    `;
    return Number(result[0]?.kitPrepared || 0);
  } catch {
    return 0;
  }
}

async function calculateAvgPerDay(organizationId) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::int as completedCount,
        COUNT(DISTINCT DATE("timestamp"))::int as daysWorked
      FROM "PerformanceLog"
      WHERE "organizationId" = ${organizationId}
        AND "action" = 'STATUS_CHANGE'
        AND "newStatus" IN ('Terminé', 'Réception: Validée', 'Conforme')
        AND "timestamp" >= ${thirtyDaysAgo}
    `;
    const row = result[0] || {};
    const completed = Number(row.completedCount || 0);
    const days = Number(row.daysWorked || 1);
    return days > 0 ? Math.round((completed / days) * 10) / 10 : 0;
  } catch {
    return 0;
  }
}
