import { calculateMissionTotals } from '../../../utils/missionBudget';
import { missionMemberSchema } from './missionValidation';
import type { MissionState } from './missionTypes';

/**
 * Sélecteur pour calculer le montant total des indemnités à partir de l'état.
 */
export const selectTotalFrais = (state: MissionState): number => {
  return calculateMissionTotals(state.members).totalFrais;
};

/**
 * Sélecteur pour calculer le taux de complétude de la mission.
 * Retourne un score de 0 à 100.
 */
export const selectMissionCompleteness = (state: MissionState): number => {
  let score = 0;
  const totalChecks = 6;

  // 1. Infos Structurelles
  if (state.formData.orderNumber) score++;
  if (state.formData.region) score++;
  if (state.formData.purpose) score++;

  // 2. RH (Au moins 1 membre valide)
  if (state.members.length > 0 && missionMemberSchema.safeParse(state.members[0]).success) {
    score++;
  }

  // 3. Planning
  if (state.formData.planning && state.formData.planning.length > 0) score++;

  // 4. Dates
  if (state.formData.startDate && state.formData.endDate) score++;

  return Math.round((score / totalChecks) * 100);
};

/**
 * Sélecteur de Santé de Mission (Health Score)
 * Combine budget, complétude et validation.
 */
export const selectMissionHealthScore = (state: MissionState, projectBudget: number): number => {
  const currentTotal = selectTotalFrais(state);
  const completeness = selectMissionCompleteness(state);

  let health = completeness;

  // Pénalité Budget (SI dépassement)
  if (projectBudget > 0 && currentTotal > projectBudget) {
    const overflowPct = ((currentTotal - projectBudget) / projectBudget) * 100;
    health -= overflowPct; // Soustraction directe du % de dépassement
  }

  // Bonus Certification
  if (state.isCertified) health += 10;

  return Math.min(100, Math.max(0, Math.round(health)));
};

/**
 * Sélecteur de Status de Santé (Categoriel)
 */
export const selectHealthStatus = (
  state: MissionState,
  projectBudget: number
): 'optimal' | 'warning' | 'critical' => {
  const score = selectMissionHealthScore(state, projectBudget);
  const currentTotal = selectTotalFrais(state);

  if (score < 40 || (projectBudget > 0 && currentTotal > projectBudget * 1.2)) return 'critical';
  if (score < 75 || (projectBudget > 0 && currentTotal > projectBudget)) return 'warning';
  return 'optimal';
};

/**
 * Sélecteur de Variance Budgétaire
 */
export const selectBudgetVariance = (state: MissionState, projectBudget: number): number => {
  if (projectBudget <= 0) return 0;
  const currentTotal = selectTotalFrais(state);
  return ((currentTotal - projectBudget) / projectBudget) * 100;
};

/**
 * Sélecteur pour obtenir le nombre de membres assignés.
 */
export const selectMemberCount = (state: MissionState): number => {
  return state.members.length;
};

/**
 * Sélecteur pour vérifier si la mission contient des données modifiées (dirty).
 */
export const selectIsDraft = (state: MissionState): boolean => {
  return !state.isCertified && state.currentMissionId !== null;
};
