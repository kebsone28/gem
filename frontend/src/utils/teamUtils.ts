 
export type TeamType = { name?: string } | string;

/**
 * Normalise l'affichage d'un nom d'équipe à partir d'un format string ou d'un objet.
 * @param t - L'équipe à vérifier (string ou objet)
 * @returns Le nom formaté de l'équipe
 */
export const normalizeTeamName = (t: TeamType): string => {
  if (typeof t === 'string') return t;
  return t?.name ?? 'Team';
};
