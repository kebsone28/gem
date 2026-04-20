/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import type { MissionMember } from '../pages/mission/core/missionTypes';

/**
 * Calcule tous les totaux financiers de la mission en une seule passe.
 */
export const calculateMissionTotals = (members: MissionMember[]) => {
  const totalFrais = members.reduce((sum, m) => sum + m.dailyIndemnity * m.days, 0);

  return {
    totalFrais,
  };
};

/**
 * Calcule le pourcentage de consommation du budget par rapport au budget total planifié du projet.
 */
export const calculateBudgetConsumption = (totalFrais: number, projectBudget: number): number => {
  if (projectBudget <= 0) return 0;
  return (totalFrais / projectBudget) * 100;
};

/**
 * Formate un montant en FCFA avec séparateur de milliers.
 */
export const formatFCFA = (amount: number): string => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
