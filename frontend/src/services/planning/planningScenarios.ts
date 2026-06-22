/**
 * planningScenarios.ts
 * Moteur de scénarios pur (zéro React).
 * Transforme les phases du planning en fonction du scénario choisi,
 * retournant un diff explicite des changements appliqués.
 */

import type { PlanningConstraints } from './planningConstraints';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ScenarioMode = 'speed' | 'balanced' | 'budget' | 'formation';

export interface PhaseDef {
  id: string;
  label: string;
  /** Durée en % du projet total */
  durationPct: number;
  /** Productivité de base (ménages/équipe/jour) */
  baseRate: number;
  rateMin: number;
  rateMax: number;
  /** Décalage de démarrage en % du projet */
  startPct: number;
  /** Parallélisme autorisé */
  parallel: boolean;
  isCritical: boolean;
  dependsOn: string[];
}

export interface ScenarioDiff {
  phaseId: string;
  field: 'baseRate' | 'durationPct' | 'startPct' | 'parallel';
  from: number | boolean;
  to: number | boolean;
  reason: string;
}

export interface ScenarioResult {
  mode: ScenarioMode;
  label: string;
  description: string;
  phases: PhaseDef[];
  overlapFactor: number;
  teamBudgetMultiplier: number;
  diffs: ScenarioDiff[];
  estimatedDurationDays: number;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clonePhases(phases: PhaseDef[]): PhaseDef[] {
  return phases.map((p) => ({ ...p }));
}

function estimateDuration(phases: PhaseDef[], totalBudgetDays: number): number {
  const maxEnd = Math.max(...phases.map((p) => p.startPct + p.durationPct));
  return Math.round((maxEnd / 100) * totalBudgetDays);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scénarios individuels
// ─────────────────────────────────────────────────────────────────────────────

function applySpeedScenario(phases: PhaseDef[], budgetDays: number): ScenarioResult {
  const result = clonePhases(phases);
  const diffs: ScenarioDiff[] = [];

  result.forEach((p) => {
    if (p.id === 'P0') return; // Formation : ne pas comprimer
    if (p.durationPct > 10) {
      const newDur = Math.max(p.durationPct - 5, 10);
      diffs.push({ phaseId: p.id, field: 'durationPct', from: p.durationPct, to: newDur, reason: 'Scénario Vitesse: compression durée' });
      p.durationPct = newDur;
    }
    if (p.baseRate < p.rateMax) {
      diffs.push({ phaseId: p.id, field: 'baseRate', from: p.baseRate, to: p.rateMax, reason: 'Scénario Vitesse: productivité maximale' });
      p.baseRate = p.rateMax;
    }
  });

  return {
    mode: 'speed',
    label: '⚡ Vitesse maximale',
    description: 'Minimise la durée totale en maximisant les équipes et la productivité. Coût élevé.',
    phases: result,
    overlapFactor: 0.5,
    teamBudgetMultiplier: 1.2,
    diffs,
    estimatedDurationDays: estimateDuration(result, budgetDays),
    score: 0,
  };
}

function applyBalancedScenario(phases: PhaseDef[], budgetDays: number): ScenarioResult {
  const result = clonePhases(phases);
  const diffs: ScenarioDiff[] = [];

  result.forEach((p) => {
    const midRate = Math.round((p.rateMin + p.rateMax) / 2);
    if (midRate !== p.baseRate) {
      diffs.push({ phaseId: p.id, field: 'baseRate', from: p.baseRate, to: midRate, reason: 'Scénario Équilibre: taux médian' });
      p.baseRate = midRate;
    }
  });

  return {
    mode: 'balanced',
    label: '⚖️ Équilibré',
    description: 'Compromis durée / coût. Taux de productivité médians, chevauchement modéré.',
    phases: result,
    overlapFactor: 0.3,
    teamBudgetMultiplier: 1.0,
    diffs,
    estimatedDurationDays: estimateDuration(result, budgetDays),
    score: 0,
  };
}

function applyBudgetScenario(phases: PhaseDef[], budgetDays: number): ScenarioResult {
  const result = clonePhases(phases);
  const diffs: ScenarioDiff[] = [];

  result.forEach((p) => {
    if (p.id === 'P0' || p.id === 'P7') return;
    const newRate = Math.max(p.rateMin, Math.round(p.rateMin * 0.9));
    const newDur = Math.min(p.durationPct + 8, 100);
    if (newRate !== p.baseRate) {
      diffs.push({ phaseId: p.id, field: 'baseRate', from: p.baseRate, to: newRate, reason: 'Scénario Budget: taux réduit' });
      p.baseRate = newRate;
    }
    if (newDur !== p.durationPct) {
      diffs.push({ phaseId: p.id, field: 'durationPct', from: p.durationPct, to: newDur, reason: 'Scénario Budget: étalement temporel' });
      p.durationPct = newDur;
    }
  });

  return {
    mode: 'budget',
    label: '💰 Budget maîtrisé',
    description: 'Réduit le nombre d\'équipes et étale la durée. Coût minimum, délai allongé.',
    phases: result,
    overlapFactor: 0,
    teamBudgetMultiplier: 0.8,
    diffs,
    estimatedDurationDays: estimateDuration(result, budgetDays),
    score: 0,
  };
}

function applyFormationScenario(phases: PhaseDef[], budgetDays: number): ScenarioResult {
  const result = clonePhases(phases);
  const diffs: ScenarioDiff[] = [];

  const formationPhase = result.find((p) => p.id === 'P0');
  if (formationPhase) {
    const newDur = Math.min(20, formationPhase.durationPct + 4);
    const newRate = Math.min(formationPhase.rateMax, formationPhase.baseRate + 5);
    diffs.push({ phaseId: 'P0', field: 'durationPct', from: formationPhase.durationPct, to: newDur, reason: 'Scénario Formation: durée étendue' });
    diffs.push({ phaseId: 'P0', field: 'baseRate', from: formationPhase.baseRate, to: newRate, reason: 'Scénario Formation: intensification sessions' });
    formationPhase.durationPct = newDur;
    formationPhase.baseRate = newRate;
  }

  return {
    mode: 'formation',
    label: '🎓 Formation prioritaire',
    description: 'Priorise la formation avant le déploiement terrain. Meilleure qualité d\'exécution.',
    phases: result,
    overlapFactor: 0.3,
    teamBudgetMultiplier: 1.0,
    diffs,
    estimatedDurationDays: estimateDuration(result, budgetDays),
    score: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export function applyScenario(
  mode: ScenarioMode,
  phases: PhaseDef[],
  budgetDays: number
): ScenarioResult {
  switch (mode) {
    case 'speed':    return applySpeedScenario(phases, budgetDays);
    case 'balanced': return applyBalancedScenario(phases, budgetDays);
    case 'budget':   return applyBudgetScenario(phases, budgetDays);
    case 'formation':return applyFormationScenario(phases, budgetDays);
  }
}

/**
 * Évalue tous les scénarios et retourne le meilleur (score le plus bas).
 * Pénalise le dépassement de budget équipes.
 */
export function recommendScenario(
  phases: PhaseDef[],
  budgetDays: number,
  constraints: PlanningConstraints,
  teamBudget: number
): ScenarioResult {
  const modes: ScenarioMode[] = ['speed', 'balanced', 'budget', 'formation'];
  const evaluated = modes
    .map((m) => applyScenario(m, phases, budgetDays))
    .map((r) => {
      const overBudget = r.teamBudgetMultiplier * teamBudget > teamBudget * 1.1;
      r.score = (overBudget ? 1000 : 0) + r.estimatedDurationDays;
      return r;
    });
  evaluated.sort((a, b) => a.score - b.score);
  return evaluated[0];
}
