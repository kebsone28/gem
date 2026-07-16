import type { PlanningParams, PlanningResult } from '../types';
import { computePlanning } from './planningEngine';

/**
 * Configuration de planning optimisée avec son score
 */
export interface PlanningConfiguration {
  params: PlanningParams;
  result: PlanningResult;
  score: number;
  durationMonths?: number;
  costMultiplier?: number;
  metrics: {
    durationDays: number;
    durationMonths: number;
    deadlineDelay: number;
    totalCost: number;
    resourceUtilization: number;
    riskScore: number;
  };
}

/**
 * Options d'optimisation
 */
export interface OptimizationOptions {
  targetDurationMonths?: number;
  maxCostMultiplier?: number;
  deadline?: Date;
  optimizeFor?: 'speed' | 'cost' | 'balanced';
  resourceConstraints?: {
    maxElectricians?: number;
    maxMasons?: number;
    maxControllers?: number;
  };
}

/**
 * Score d'une configuration de planning (plus c'est bas, meilleur c'est)
 */
export function scorePlanningConfiguration(
  result: PlanningResult,
  options: OptimizationOptions
): number {
  let score = 0;
  const optimizeFor = options.optimizeFor || 'balanced';

  // Score basé sur la durée par rapport à l'objectif
  const targetMonths = options.targetDurationMonths || 2;
  const actualMonths = result.synthese.dureeMois;
  const durationDiff = actualMonths - targetMonths;
  
  if (optimizeFor === 'speed') {
    // Priorité absolue à la vitesse
    if (durationDiff > 0) {
      score += durationDiff * 100; // Pénalité forte pour dépassement de durée
    } else {
      score += Math.abs(durationDiff) * 5; // Petit bonus pour terminer plus tôt
    }
  } else if (optimizeFor === 'cost') {
    // Priorité au coût avec attention modérée à la durée
    if (durationDiff > 0) {
      score += durationDiff * 20; // Pénalité modérée pour dépassement de durée
    }
  } else {
    // Mode équilibré
    if (durationDiff > 0) {
      // Pénalité pour dépassement de délai
      score += durationDiff * 50; // 50 points par mois de retard
    } else {
      // Bonus pour avance
      score += durationDiff * 10; // 10 points par mois d'avance (moins pénalisant)
    }
  }

  // Score basé sur le respect du deadline
  if (options.deadline) {
    const deadlineDelay = Math.ceil((result.synthese.finGlobal.getTime() - options.deadline.getTime()) / 86400000);
    if (deadlineDelay > 0) {
      score += deadlineDelay * 2; // 2 points par jour de retard deadline
    }
  }

  // Score basé sur l'utilisation des ressources
  const totalEquipes = Object.values(result.synthese.totalEquipes).reduce((a, b) => a + b, 0);
  const maxEquipes = options.resourceConstraints?.maxElectricians || 100;
  const utilizationRatio = totalEquipes / maxEquipes;
  
  if (optimizeFor === 'cost') {
    // Priorité au coût : pénalité forte pour sur-utilisation
    if (utilizationRatio > 1) {
      score += (utilizationRatio - 1) * 150; // Pénalité très forte
    } else if (utilizationRatio < 0.5) {
      score += (0.5 - utilizationRatio) * 5; // Petit bonus pour économie
    }
  } else if (optimizeFor === 'speed') {
    // Priorité à la vitesse : tolérance plus élevée pour les ressources
    if (utilizationRatio > 1) {
      score += (utilizationRatio - 1) * 50; // Pénalité modérée
    } else if (utilizationRatio < 0.5) {
      score += (0.5 - utilizationRatio) * 30; // Pénalité pour sous-utilisation (trop lent)
    }
  } else {
    // Mode équilibré
    if (utilizationRatio > 1) {
      score += (utilizationRatio - 1) * 100; // Pénalité standard
    } else if (utilizationRatio < 0.5) {
      score += (0.5 - utilizationRatio) * 20; // Pénalité pour sous-utilisation
    }
  }

  // Score basé sur le coût (estimé par nombre total d'équipes)
  const estimatedCost = totalEquipes * actualMonths * 1000; // Coût estimé
  const maxCost = (options.maxCostMultiplier || 1.5) * 100000; // Coût max de référence
  
  if (optimizeFor === 'cost') {
    // Priorité au coût
    if (estimatedCost > maxCost) {
      score += (estimatedCost - maxCost) / 500; // Pénalité très forte pour coût excessif
    } else {
      score += (maxCost - estimatedCost) / 2000; // Bonus pour économie
    }
  } else if (optimizeFor === 'speed') {
    // Priorité à la vitesse : tolérance au coût
    if (estimatedCost > maxCost * 2) {
      score += (estimatedCost - maxCost * 2) / 1000; // Pénalité seulement si coût excessif
    }
  } else {
    // Mode équilibré
    if (estimatedCost > maxCost) {
      score += (estimatedCost - maxCost) / 1000; // Pénalité standard
    }
  }

  // Score basé sur le risque (alertes high/medium)
  const highAlerts = result.alertes.filter(a => a.sev === 'high').length;
  const mediumAlerts = result.alertes.filter(a => a.sev === 'medium').length;
  
  if (optimizeFor === 'speed') {
    // Priorité à la vitesse : tolérance plus élevée aux alertes
    score += highAlerts * 20 + mediumAlerts * 5;
  } else {
    // Priorité au coût ou équilibré : pénalité standard
    score += highAlerts * 30 + mediumAlerts * 10;
  }

  return score;
}

/**
 * Génère des variantes de paramètres de planning
 */
export function generatePlanningVariants(
  baseParams: PlanningParams,
  menageCounts: Record<string, number>
): PlanningParams[] {
  const variants: PlanningParams[] = [];
  
  // Variantes d'effectifs (±20% autour de l'actuel)
  const electricianVariants = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
  const masonVariants = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
  const controllerVariants = [0.8, 0.9, 1.0, 1.1, 1.2];
  
  // Variantes de pipeline (délais entre phases)
  const pipelineVariants = [5, 10, 15, 20, 25, 30];
  
  // Variantes de mode (séquentiel vs parallèle)
  const modeVariants = ['sequentiel', 'parallele'] as const;
  
  // Variantes d'ordre de régions
  const regionOrders = [
    ['Kaffrine', 'Tambacounda'],
    ['Tambacounda', 'Kaffrine'],
  ];

  // Générer les combinaisons (échantillonnage intelligent)
  for (const elecMult of electricianVariants) {
    for (const masonMult of masonVariants) {
      for (const ctrlMult of controllerVariants) {
        for (const pipeline of pipelineVariants) {
          for (const mode of modeVariants) {
            for (const regions of regionOrders) {
              const variant: PlanningParams = {
                ...baseParams,
                totalElectriciens: Math.round((baseParams.totalElectriciens || 30) * elecMult),
                maconEquipesKaffrine: Math.round((baseParams.maconEquipesKaffrine || 10) * masonMult),
                maconEquipesTamba: Math.round((baseParams.maconEquipesTamba || 8) * masonMult),
                controleursEquipesKaffrine: Math.round((baseParams.controleursEquipesKaffrine || 5) * ctrlMult),
                controleursEquipesTamba: Math.round((baseParams.controleursEquipesTamba || 4) * ctrlMult),
                reseauPipelineDebut: pipeline,
                controleDebutPct: Math.round(pipeline / 2),
                modeRegions: mode,
                regionsOrdre: regions,
              };
              
              variants.push(variant);
              
              // Limiter le nombre de variantes pour éviter l'explosion combinatoire
              if (variants.length >= 100) return variants;
            }
          }
        }
      }
    }
  }

  return variants;
}

/**
 * Optimise automatiquement le planning en testant plusieurs configurations
 */
export async function optimizePlanning(
  baseParams: PlanningParams,
  menageCounts: Record<string, number>,
  options: OptimizationOptions = {}
): Promise<PlanningConfiguration[]> {
  const results: PlanningConfiguration[] = [];

  // Générer les variantes de paramètres
  const variants = generatePlanningVariants(baseParams, menageCounts);

  // Calculer le planning pour chaque variante avec pauses pour éviter le blocage
  for (let i = 0; i < variants.length; i++) {
    const params = variants[i];
    
    try {
      const result = computePlanning(params, menageCounts);
      
      // Calculer le score
      const score = scorePlanningConfiguration(result, options);
      
      // Calculer les métriques
      const metrics = {
        durationDays: result.synthese.dureeJours,
        durationMonths: result.synthese.dureeMois,
        deadlineDelay: options.deadline 
          ? Math.ceil((result.synthese.finGlobal.getTime() - options.deadline.getTime()) / 86400000)
          : 0,
        totalCost: Object.values(result.synthese.totalEquipes).reduce((a, b) => a + b, 0) * result.synthese.dureeMois * 1000,
        resourceUtilization: Object.values(result.synthese.totalEquipes).reduce((a, b) => a + b, 0) / (options.resourceConstraints?.maxElectricians || 100),
        riskScore: result.alertes.filter(a => a.sev === 'high').length * 30 + result.alertes.filter(a => a.sev === 'medium').length * 10,
      };

      results.push({
        params,
        result,
        score,
        durationMonths: metrics.durationMonths,
        costMultiplier: metrics.totalCost / ((options.maxCostMultiplier || 1.5) * 100000),
        metrics,
      });
    } catch (error) {
      // Ignorer les configurations qui échouent
      continue;
    }
    
    // Pause toutes les 5 itérations pour permettre au UI de respirer
    if (i % 5 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Trier par score (du meilleur au pire)
  return results.sort((a, b) => a.score - b.score).slice(0, 10);
}

/**
 * Suggère la meilleure configuration de planning
 */
export async function suggestBestPlanningConfiguration(
  baseParams: PlanningParams,
  menageCounts: Record<string, number>,
  options: OptimizationOptions = {}
): Promise<PlanningConfiguration | null> {
  const optimized = await optimizePlanning(baseParams, menageCounts, options);
  return optimized.length > 0 ? optimized[0] : null;
}

/**
 * Compare deux configurations de planning
 */
export function comparePlanningConfigurations(
  config1: PlanningConfiguration,
  config2: PlanningConfiguration
): {
  durationDiff: number;
  costDiff: number;
  resourceDiff: number;
  riskDiff: number;
  better: 'config1' | 'config2' | 'equal';
} {
  const durationDiff = config2.metrics.durationMonths - config1.metrics.durationMonths;
  const costDiff = config2.metrics.totalCost - config1.metrics.totalCost;
  const resourceDiff = config2.metrics.resourceUtilization - config1.metrics.resourceUtilization;
  const riskDiff = config2.metrics.riskScore - config1.metrics.riskScore;

  let better: 'config1' | 'config2' | 'equal' = 'equal';
  
  if (config1.score < config2.score) {
    better = 'config1';
  } else if (config2.score < config1.score) {
    better = 'config2';
  }

  return {
    durationDiff,
    costDiff,
    resourceDiff,
    riskDiff,
    better,
  };
}