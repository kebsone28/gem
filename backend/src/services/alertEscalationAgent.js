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
    // Récupérer la configuration des alertes pour cette organisation
    const config = await prisma.alertConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) {
      logger.warn(`[IGPP-ALERT-AGENT] No alert config for org ${organizationId}`);
      return;
    }

    // Récupérer les données KPI actuelles
    // Note: Cela suppose que les données KPI sont disponibles via une API ou cache
    // Pour l'intégration, nous utilisons les données agrégées depuis la base de données
    const kpiData = await aggregateProjectKPIs(projectId);

    // Créer les alertes IGPP basées sur les seuils
    const alertsToCreate = [];

    // 1. Alerte Stock Critique
    if (
      kpiData.logistics?.kitPrepared !== undefined &&
      kpiData.logistics.kitPrepared < config.stockCritical
    ) {
      alertsToCreate.push({
        type: 'IGPP_STOCK',
        severity: kpiData.logistics.kitPrepared === 0 ? 'CRITICAL' : 'HIGH',
        title: `Stock critique: ${kpiData.logistics.kitPrepared} kits disponibles`,
        description: `Nombre de kits préparés: ${kpiData.logistics.kitPrepared}. Seuil critique: ${config.stockCritical}`,
        recommendedAction: 'Préparer plus de kits immédiatement',
      });
    }

    // 2. Alerte Budget
    if (
      kpiData.budgetUsagePercent !== undefined &&
      kpiData.budgetUsagePercent > config.budgetThreshold
    ) {
      alertsToCreate.push({
        type: 'IGPP_BUDGET',
        severity: kpiData.budgetUsagePercent > 95 ? 'CRITICAL' : 'HIGH',
        title: `Budget utilisé à ${kpiData.budgetUsagePercent}%`,
        description: `Utilisation du budget: ${kpiData.budgetUsagePercent}%. Seuil d'alerte: ${config.budgetThreshold}%`,
        recommendedAction: 'Vérifier les dépenses et obtenir une approbation supplémentaire si nécessaire',
      });
    }

    // 3. Alerte Électricité
    if (
      kpiData.electrifiedHouseholds !== undefined &&
      kpiData.electrifiedHouseholds < config.electricityMin
    ) {
      alertsToCreate.push({
        type: 'IGPP_ELECTRICITY',
        severity: 'HIGH',
        title: `Accès électricité faible: ${kpiData.electrifiedHouseholds}%`,
        description: `Pourcentage de ménages avec accès électricité: ${kpiData.electrifiedHouseholds}%. Minimum requis: ${config.electricityMin}%`,
        recommendedAction: 'Vérifier les interruptions d\'électricité et contacter le fournisseur si nécessaire',
      });
    }

    // 4. Alerte Rendement Équipes
    if (kpiData.performance?.avgPerDay !== undefined) {
      const teamEfficiency = kpiData.performance.avgPerDay;
      if (teamEfficiency < 1) {
        // Moins de 1 ménage par jour par personne
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
    if (kpiData.pvRetard !== undefined && kpiData.pvRetard > config.delayThreshold) {
      alertsToCreate.push({
        type: 'IGPP_DELAY',
        severity: 'HIGH',
        title: `Retards PV importants: ${kpiData.pvRetard} logements`,
        description: `Nombre de logements en retard PV: ${kpiData.pvRetard}. Seuil d'alerte: ${config.delayThreshold}`,
        recommendedAction: 'Prioriser les PV en retard et identifier les obstacles',
      });
    }

    // Créer les alertes dans la base de données
    for (const alertData of alertsToCreate) {
      try {
        // Vérifier si une alerte similaire et ouverte existe déjà
        const existingAlert = await prisma.alert.findFirst({
          where: {
            projectId,
            organizationId,
            type: alertData.type,
            status: 'OPEN',
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Créée dans les 5 dernières minutes
          },
        });

        if (!existingAlert) {
          // Créer une nouvelle alerte
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

          // Déclencher les notifications
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
async function aggregateProjectKPIs(projectId) {
  try {
    // Récupérer les statistiques du projet
    const households = await prisma.household.findMany({
      where: { projectId, status: 'ACTIVE' },
    });

    const missions = await prisma.mission.findMany({
      where: { projectId },
    });

    // Compter les statuts
    const missionsByStatus = {};
    missions.forEach((m) => {
      missionsByStatus[m.status] = (missionsByStatus[m.status] || 0) + 1;
    });

    // Calculs
    const totalHouseholds = households.length;
    const electrifiedHouseholds = households.filter((h) => h.hasElectricity).length;
    const electrificationPercent =
      totalHouseholds > 0 ? Math.round((electrifiedHouseholds / totalHouseholds) * 100) : 0;

    // Récupérer les missions PV par statut
    const pvMissions = missions.filter((m) => m.type?.startsWith('PV'));
    const pvRetard = pvMissions.filter((m) => m.status === 'RETARD').length;
    const pvnc = pvMissions.filter((m) => m.type?.includes('NC')).length;

    return {
      electrifiedHouseholds: electrificationPercent,
      pvRetard: pvRetard,
      pvnc: pvnc,
      budgetUsagePercent: 45, // TODO: Intégrer avec les données budgétaires réelles
      logistics: {
        kitPrepared: 12, // TODO: Intégrer avec le système logistique
      },
      performance: {
        avgPerDay: 1.5, // TODO: Calculer depuis les données de performances réelles
      },
    };
  } catch (err) {
    logger.error('[IGPP-ALERT-AGENT] Error aggregating KPIs:', err);
    return {};
  }
}
