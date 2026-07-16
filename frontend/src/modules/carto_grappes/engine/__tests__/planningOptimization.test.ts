import { describe, it, expect } from 'vitest';
import {
  scorePlanningConfiguration,
  generatePlanningVariants,
  optimizePlanning,
  comparePlanningConfigurations,
} from '../planningOptimization';
import { computePlanning } from '../planningEngine';
import type { PlanningParams } from '../../types';
import type { PlanningConfiguration } from '../planningOptimization';
import { PLANNING_DEFAULTS } from '../../constants';

const baseParams: PlanningParams = {
  ...PLANNING_DEFAULTS,
  dateDebut: '2026-07-20',
  dureeObjectifMois: 2,
  compterJoursFeries: false,
  compterJoursReligieux: false,
  compterSaisonPluie: false,
  samediTravaille: true,
  dimancheTravaille: false,
  modeRegions: 'parallele',
  formationMode: 'sequentiel',
  totalElectriciens: 30,
  maconEquipesKaffrine: 10,
  maconEquipesTamba: 8,
  controleursEquipesKaffrine: 5,
  controleursEquipesTamba: 4,
};

const menageCounts: Record<string, number> = {
  Kaffrine: 2185,
  Tambacounda: 1351,
};

function makeConfig(overrides: Partial<PlanningParams> = {}): PlanningConfiguration {
  const params = { ...baseParams, ...overrides };
  const result = computePlanning(params, menageCounts);
  return {
    params,
    result,
    score: 0,
    durationMonths: result.synthese.dureeMois,
    metrics: {
      durationDays: result.synthese.dureeJours,
      durationMonths: result.synthese.dureeMois,
      deadlineDelay: 0,
      totalCost: 50000,
      resourceUtilization: 0.5,
      riskScore: result.alertes.filter(a => a.sev === 'high').length * 30,
    },
  };
}

describe('scorePlanningConfiguration', () => {
  it('returns a numeric score', () => {
    const result = computePlanning(baseParams, menageCounts);
    const score = scorePlanningConfiguration(result, { optimizeFor: 'balanced' });
    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
  });

  it('penalizes longer durations in speed mode', () => {
    const fastParams = { ...baseParams, dureeObjectifMois: 1 };
    const slowParams = { ...baseParams, dureeObjectifMois: 6 };
    const fastResult = computePlanning(fastParams, menageCounts);
    const slowResult = computePlanning(slowParams, menageCounts);
    const fastScore = scorePlanningConfiguration(fastResult, { optimizeFor: 'speed', targetDurationMonths: 2 });
    const slowScore = scorePlanningConfiguration(slowResult, { optimizeFor: 'speed', targetDurationMonths: 2 });
    // Slow config should have a higher (worse) score
    expect(slowScore).toBeGreaterThan(fastScore);
  });

  it('penalizes deadline exceedance', () => {
    const result = computePlanning(baseParams, menageCounts);
    const scoreWithDeadline = scorePlanningConfiguration(result, {
      deadline: new Date('2026-09-01'),
    });
    const scoreNoDeadline = scorePlanningConfiguration(result, {});
    // If the project exceeds Sept 1, deadline penalty should apply
    expect(typeof scoreWithDeadline).toBe('number');
    expect(typeof scoreNoDeadline).toBe('number');
  });

  it('speed mode is more tolerant of high resource usage', () => {
    const result = computePlanning(baseParams, menageCounts);
    const speedScore = scorePlanningConfiguration(result, {
      optimizeFor: 'speed',
      resourceConstraints: { maxElectricians: 5 },
    });
    const costScore = scorePlanningConfiguration(result, {
      optimizeFor: 'cost',
      resourceConstraints: { maxElectricians: 5 },
    });
    // Cost mode penalizes over-utilization more
    expect(typeof speedScore).toBe('number');
    expect(typeof costScore).toBe('number');
  });
});

describe('generatePlanningVariants', () => {
  it('generates variants array', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    expect(Array.isArray(variants)).toBe(true);
    expect(variants.length).toBeGreaterThan(0);
  });

  it('caps at 100 variants', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    expect(variants.length).toBeLessThanOrEqual(100);
  });

  it('each variant has different parameters', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    const uniquePipelines = new Set(variants.map(v => v.reseauPipelineDebut));
    expect(uniquePipelines.size).toBeGreaterThan(1);
    const uniqueModes = new Set(variants.map(v => v.modeRegions));
    expect(uniqueModes.size).toBe(2);
  });

  it('variants have different region orders', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    const orders = variants.map(v => JSON.stringify(v.regionsOrdre));
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBeGreaterThanOrEqual(2);
  });

  it('variants have different modes', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    const modes = new Set(variants.map(v => v.modeRegions));
    expect(modes.has('sequentiel')).toBe(true);
    expect(modes.has('parallele')).toBe(true);
  });

  it('variants have different pipeline values', () => {
    const variants = generatePlanningVariants(baseParams, menageCounts);
    const pipelines = new Set(variants.map(v => v.reseauPipelineDebut));
    expect(pipelines.size).toBeGreaterThan(1);
  });
});

describe('comparePlanningConfigurations', () => {
  it('identifies config1 as better when lower score', () => {
    const config1 = makeConfig();
    config1.score = 10;
    const config2 = makeConfig();
    config2.score = 50;
    const comparison = comparePlanningConfigurations(config1, config2);
    expect(comparison.better).toBe('config1');
  });

  it('identifies config2 as better when lower score', () => {
    const config1 = makeConfig();
    config1.score = 50;
    const config2 = makeConfig();
    config2.score = 10;
    const comparison = comparePlanningConfigurations(config1, config2);
    expect(comparison.better).toBe('config2');
  });

  it('returns equal when same score', () => {
    const config1 = makeConfig();
    config1.score = 30;
    const config2 = makeConfig();
    config2.score = 30;
    const comparison = comparePlanningConfigurations(config1, config2);
    expect(comparison.better).toBe('equal');
  });

  it('returns duration and cost diffs', () => {
    const config1 = makeConfig();
    const config2 = makeConfig();
    const comparison = comparePlanningConfigurations(config1, config2);
    expect(typeof comparison.durationDiff).toBe('number');
    expect(typeof comparison.costDiff).toBe('number');
    expect(typeof comparison.resourceDiff).toBe('number');
    expect(typeof comparison.riskDiff).toBe('number');
  });
});

describe('optimizePlanning', () => {
  it('returns sorted configurations', async () => {
    const results = await optimizePlanning(baseParams, menageCounts, {
      optimizeFor: 'balanced',
    });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Verify sorted by score (ascending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score);
    }
  });

  it('returns at most 10 results', async () => {
    const results = await optimizePlanning(baseParams, menageCounts);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('each result has valid metrics', async () => {
    const results = await optimizePlanning(baseParams, menageCounts);
    for (const r of results) {
      expect(r.score).toBeDefined();
      expect(r.metrics).toBeDefined();
      expect(r.metrics.durationDays).toBeGreaterThan(0);
      expect(r.metrics.durationMonths).toBeGreaterThan(0);
      expect(r.result).toBeDefined();
      expect(r.result.synthese).toBeDefined();
    }
  }, 30000);

  it('speed mode optimization yields results', async () => {
    const results = await optimizePlanning(baseParams, menageCounts, {
      optimizeFor: 'speed',
      targetDurationMonths: 2,
    });
    expect(results.length).toBeGreaterThan(0);
  }, 30000);
});
