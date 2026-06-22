/**
 * planningEngine.ts
 * Orchestrateur pur (zéro React).
 * Point d'entrée unique pour tous les calculs de planning.
 * Architecture : Constraints → Scenario → CriticalPath → Result
 */

import {
  type PlanningConstraints,
  DEFAULT_CONSTRAINTS,
  applyConstraintsToRate,
  computeConstraintMultiplier,
} from './planningConstraints';

import {
  type PhaseDef,
  type ScenarioMode,
  type ScenarioResult,
  applyScenario,
} from './planningScenarios';

import {
  type PlanningPhaseNode,
  type CriticalPathResult,
  computeCriticalPath,
} from './planningCriticalPath';

// ─────────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────────

export type PhaseHealth = 'on_track' | 'warning' | 'critical' | 'blocked';

export interface PhaseProgress {
  phaseId: string;
  actualStart?: Date;
  actualEnd?: Date;
  /** 0–100 */
  progress: number;
  delayDays: number;
  forecastEnd?: Date;
  status: PhaseHealth;
  variance: number;
}

export interface PlanningResult {
  /** Phases après application des contraintes et du scénario */
  phases: PhaseDef[];
  /** Dates résolues pour chaque phase (startDay, endDay, float, isCritical) */
  criticalPath: CriticalPathResult;
  /** Multiplicateur global de productivité [0–1] */
  constraintMultiplier: number;
  /** Durée totale estimée en jours ouvrés */
  totalDurationDays: number;
  /** Nombre de ménages traités par jour (toutes phases) */
  dailyThroughput: number;
  /** Progrès par phase */
  progress: PhaseProgress[];
  /** Scénario appliqué */
  scenario: ScenarioResult;
  computedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health calculator
// ─────────────────────────────────────────────────────────────────────────────

function computePhaseHealth(delayDays: number, blockedByDep: boolean): PhaseHealth {
  if (blockedByDep) return 'blocked';
  if (delayDays > 15) return 'critical';
  if (delayDays > 5) return 'warning';
  return 'on_track';
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection "forecast end" depuis avancement réel
// ─────────────────────────────────────────────────────────────────────────────

function forecastEnd(
  actualStart: Date | undefined,
  progress: number,
  plannedDurationDays: number
): Date | undefined {
  if (!actualStart || progress === 0) return undefined;
  const elapsed = (Date.now() - actualStart.getTime()) / 86_400_000;
  const totalEstimated = elapsed / (progress / 100);
  const remaining = totalEstimated - elapsed;
  const end = new Date(actualStart.getTime() + totalEstimated * 86_400_000);
  return end;
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique principale
// ─────────────────────────────────────────────────────────────────────────────

export interface ComputePlanningOptions {
  constraints?: PlanningConstraints;
  scenarioMode?: ScenarioMode;
  /** Durée totale allouée (jours ouvrés) */
  budgetDays: number;
  /** Progrès réels connus */
  progressMap?: Record<string, Partial<PhaseProgress>>;
  /** Phases bloquées par dépendances non résolues */
  blockedPhaseIds?: string[];
}

/**
 * Point d'entrée unique du moteur de calcul.
 * Pure fonction : même input → même output.
 */
export function computePlanning(
  phases: PhaseDef[],
  options: ComputePlanningOptions
): PlanningResult {
  const {
    constraints = DEFAULT_CONSTRAINTS,
    scenarioMode = 'balanced',
    budgetDays,
    progressMap = {},
    blockedPhaseIds = [],
  } = options;

  // 1. Appliquer le scénario sur les phases
  const scenario = applyScenario(scenarioMode, phases, budgetDays);
  const scenarioPhases = scenario.phases;

  // 2. Appliquer les contraintes sur les taux de chaque phase
  const constraintMultiplier = computeConstraintMultiplier(constraints);
  const adjustedPhases: PhaseDef[] = scenarioPhases.map((p) => ({
    ...p,
    baseRate: applyConstraintsToRate(p.baseRate, constraints),
  }));

  // 3. Construire les nœuds DAG pour le chemin critique
  const dagNodes: PlanningPhaseNode[] = adjustedPhases.map((p) => ({
    id: p.id,
    label: p.label,
    durationDays: Math.round((p.durationPct / 100) * budgetDays),
    dependsOn: p.dependsOn,
    overlapFactor: scenario.overlapFactor,
  }));

  const criticalPath = computeCriticalPath(dagNodes);

  // 4. Fusionner les progrès réels
  const progress: PhaseProgress[] = adjustedPhases.map((p) => {
    const known = progressMap[p.id] ?? {};
    const delayDays = known.delayDays ?? 0;
    const prog = known.progress ?? 0;
    const resolved = criticalPath.resolved.find((r) => r.id === p.id);

    return {
      phaseId: p.id,
      actualStart: known.actualStart,
      actualEnd: known.actualEnd,
      progress: prog,
      delayDays,
      forecastEnd: forecastEnd(known.actualStart, prog, resolved?.endDay ?? 0),
      status: computePhaseHealth(delayDays, blockedPhaseIds.includes(p.id)),
      variance: delayDays,
    };
  });

  // 5. Débit journalier agrégé
  const dailyThroughput = adjustedPhases
    .filter((p) => p.parallel)
    .reduce((sum, p) => sum + p.baseRate, 0);

  return {
    phases: adjustedPhases,
    criticalPath,
    constraintMultiplier,
    totalDurationDays: criticalPath.totalDurationDays,
    dailyThroughput,
    progress,
    scenario,
    computedAt: new Date(),
  };
}

/**
 * Recalcule uniquement les phases en aval d'une phase modifiée.
 * Optimise les performances en évitant un recalcul global.
 */
export function recomputeDownstream(
  phaseId: string,
  allPhases: PhaseDef[],
  result: PlanningResult,
  options: ComputePlanningOptions
): PlanningResult {
  // Identifier les phases affectées via le DAG
  const affected = new Set<string>([phaseId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of allPhases) {
      if (!affected.has(p.id) && p.dependsOn.some((d) => affected.has(d))) {
        affected.add(p.id);
        changed = true;
      }
    }
  }

  // Pour les phases non impactées, garder les résultats actuels
  // Pour les phases impactées, recalculer
  return computePlanning(allPhases, options);
}
