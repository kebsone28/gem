/**
 * planningConstraints.ts
 * Domaine pur (aucune dépendance React).
 * Gère les facteurs réalistes qui réduisent la productivité effective des équipes.
 */

export interface PlanningConstraints {
  /** Disponibilité météo : 0.5 (50%) → 1 (100% = aucun impact) */
  weatherFactor: number;
  /** Praticabilité des routes : 0.5 → 1 */
  roadFactor: number;
  /** Disponibilité du stock matériel : 0 → 1 */
  stockFactor: number;
  /** Taux de présence des équipes : 0.7 → 1 (absentéisme = 1 - valeur) */
  absentFactor: number;
  /** Jours perdus par mois pour pannes matériel */
  breakdownDays: number;
}

export const DEFAULT_CONSTRAINTS: PlanningConstraints = {
  weatherFactor: 0.8,
  roadFactor: 0.85,
  stockFactor: 0.9,
  absentFactor: 0.9,
  breakdownDays: 1,
};

export const NOMINAL_CONSTRAINTS: PlanningConstraints = {
  weatherFactor: 1,
  roadFactor: 1,
  stockFactor: 1,
  absentFactor: 1,
  breakdownDays: 0,
};

/**
 * Multiplieur global de productivité (0..1)
 * Météo × Routes × Stock × Présence
 */
export function computeConstraintMultiplier(c: PlanningConstraints): number {
  return Math.max(
    0.05,
    c.weatherFactor * c.roadFactor * c.stockFactor * c.absentFactor
  );
}

/**
 * Jours ouvrés effectifs perdus par mois suite aux pannes
 */
export function computeBreakdownPenaltyPerMonth(c: PlanningConstraints): number {
  return Math.max(0, c.breakdownDays);
}

/**
 * Productivité effective journalière (ménages/équipe/jour)
 * en tenant compte des contraintes
 */
export function applyConstraintsToRate(
  baseRate: number,
  c: PlanningConstraints
): number {
  const multiplier = computeConstraintMultiplier(c);
  return Math.max(1, Math.round(baseRate * multiplier));
}

/**
 * Nombre d'équipes brut → ajusté à l'absentéisme
 */
export function adjustTeamCountForAbsenteeism(
  rawTeamCount: number,
  c: PlanningConstraints
): number {
  if (c.absentFactor >= 1) return rawTeamCount;
  return Math.ceil(rawTeamCount / Math.max(0.1, c.absentFactor));
}

/**
 * Indicateur de santé global des contraintes
 */
export type ConstraintHealth = 'optimal' | 'degraded' | 'critical';

export function getConstraintHealth(c: PlanningConstraints): ConstraintHealth {
  const m = computeConstraintMultiplier(c);
  if (m >= 0.85) return 'optimal';
  if (m >= 0.6) return 'degraded';
  return 'critical';
}
