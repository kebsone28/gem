export const CONFORMING_HOUSEHOLD_LOCK_FIELDS = [
  'name',
  'phone',
  'region',
  'departement',
  'village',
  'zoneId',
  'latitude',
  'longitude',
  'owner',
  'ownerPhone',
  'numeroordre',
  'constructionData.preparateur',
  'constructionData.livreur',
  'constructionData.macon',
  'constructionData.reseau',
  'constructionData.interieur',
  'constructionData.audit',
  'constructionData.media',
] as const;

export const mergeManualOverrides = (
  currentOverrides: string[] | undefined,
  nextOverrides: readonly string[]
) => Array.from(new Set([...(currentOverrides || []), ...nextOverrides]));

export const removeManualOverrides = (
  currentOverrides: string[] | undefined,
  removableOverrides: readonly string[]
) => (currentOverrides || []).filter((field) => !removableOverrides.includes(field));
