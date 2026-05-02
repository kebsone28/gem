import type { Household } from './types';

export function stringifyHouseholdValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const candidate =
    record.name ||
    record.fullName ||
    record.nom ||
    record.prenomNom ||
    record.prenom_et_nom ||
    record.phone ||
    record.telephone ||
    record.commune;

  return stringifyHouseholdValue(candidate);
}

export function getHouseholdDisplayName(household: Household | null | undefined): string {
  if (!household) return 'Ménage anonyme';

  return (
    stringifyHouseholdValue((household as any).owner) ||
    stringifyHouseholdValue((household as any).name) ||
    stringifyHouseholdValue((household as any).koboData?.owner) ||
    stringifyHouseholdValue((household as any).koboData?.name) ||
    stringifyHouseholdValue((household as any).koboData?.beneficiaire) ||
    'Ménage anonyme'
  );
}
