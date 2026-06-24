/**
 * Constantes pour le formulaire interne Kobo (GedOs Collect)
 */

export const ROLE_SECTION_BY_VALUE: Record<string, string> = {
  livreur: 'preparation_livraison',
  __pr_parateur: 'preparation_livraison',
  macon: 'macon',
  reseau: 'reseau',
  interieur: 'interieur',
  controleur: 'controle_branchement',
};

export const XLS_RUNTIME_MEDIA_TYPES = new Set(['image', 'signature', 'file', 'audio', 'video']);

export const XLS_RUNTIME_FILLABLE_SKIP_TYPES = new Set([
  'note',
  'calculate',
  'hidden',
  'xml-external',
  'xml_external',
  'start',
  'end',
  'today',
  'username',
  'phonenumber',
  'deviceid',
  'subscriberid',
  'simserial',
  'audit',
]);

export const GedOs_RUNTIME_MEDIA_TYPES = XLS_RUNTIME_MEDIA_TYPES;
export const GedOs_RUNTIME_FILLABLE_SKIP_TYPES = XLS_RUNTIME_FILLABLE_SKIP_TYPES;

export const GEM_RUNTIME_MEDIA_TYPES = XLS_RUNTIME_MEDIA_TYPES;
export const GEM_RUNTIME_FILLABLE_SKIP_TYPES = XLS_RUNTIME_FILLABLE_SKIP_TYPES;

