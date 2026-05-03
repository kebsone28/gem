import { describe, expect, it } from 'vitest';
import {
  INTERNAL_KOBO_CHOICES,
  INTERNAL_KOBO_FIELD_NAMES,
  INTERNAL_KOBO_FORM_SETTINGS,
  getVisibleInternalKoboFields,
  validateInternalKoboFields,
  validateInternalKoboRequiredFields,
} from '../src/components/terrain/internalKoboFormDefinition';

const XLS_REQUIRED_FIELD_NAMES = [
  'Numero_ordre',
  'nom_key',
  'telephone_key',
  'latitude_key',
  'longitude_key',
  'region_key',
  'LOCALISATION_CLIENT',
  'role',
  'Longueur_Cable_2_5mm_Int_rieure',
  'Longueur_Cable_1_5mm_Int_rieure',
  'Longueur_Tranch_e_Cable_arm_4mm',
  'Longueur_Tranch_e_C_ble_arm_1_5mm',
  'Je_confirme_la_remis_u_materiel_au_m_nage',
  'Je_confirme_le_marqu_osition_des_coffrets',
  'Je_confirme_le_marqu_coffrets_lectriques',
  'kit_disponible_macon',
  'type_mur_realise_macon',
  'validation_macon_final',
  'verification_mur_reseau',
  'problemes_mur_reseau',
  'etat_branchement_reseau',
  'validation_reseau_final',
  'verification_branchement_interieur',
  'etat_installation_interieur',
  'validation_interieur_final',
  'ETAT_DE_L_INSTALLATION',
  'controleurPROB',
  'Phase_de_controle',
  'ETAT_BRANCHEMENT',
  'OBSERVATION',
  'Position_du_branchement',
  'Observations_sur_la_ition_du_branchement',
  'Hauteur_branchement',
  'Observations',
  'Hauteur_coffret',
  'Observations_001',
  'OBSERVATION_001',
  'Continuit_PVC',
  'OBSERVATION_002',
  'Mise_en_oeuvre',
  'OBSERVATION_003',
  'DISJONCTEUR_GENERAL_EN_TETE_D_',
  'OBSERVATIONS_',
  'TYPE_DE_DISJONCTEUR_GENERAL',
  'ENSEMBLE_DE_L_INSTALLATION_PRO',
  'OBSERVATIONS__001',
  'PROTECTION_L_ORIGINE_DE_CHAQ',
  'OBSERVATIONS_002',
  'S_PARATION_DES_CIRCUITS_Lumi_',
  'OBSERVATIONS__002',
  'PROTECTION_CONTRE_LES_CONTACTS',
  'OBSERVATIONS__003',
  'MISE_EN_OEUVRE_MAT_RIEL_ET_APP',
  'OBSERVATIONS__004',
  'CONTINUITE_DE_LA_PROTECTION_ME',
  'OBSERVATIONS__005',
  'MISE_EN_UVRE_DU_R_SEAU_DE_TER',
  'OBSERVATIONS__006',
  'VALEUR_DE_LA_RESISTANCE_DE_TER',
  'OBSERVATIONS__007',
  'validation_controleur_final',
  'notes_generales',
];

const XLS_CHOICE_LIST_SIZES = {
  roles: 6,
  cj3rh91: 3,
  pr4rq21: 4,
  pg7bi79: 2,
  kit_disponible: 2,
  problemes_kit_macon: 4,
  type_mur: 2,
  problemes_travail_macon: 4,
  verification_mur: 2,
  problemes_mur_reseau: 3,
  etat_branchement: 2,
  problemes_branchement_reseau: 3,
  verification_branchement: 2,
  problemes_branchement_interieur: 3,
  etat_installation: 2,
  problemes_installation_interieur: 3,
  rr4dg37: 4,
  oo84j36: 5,
  ga7rh54: 3,
  sv3tg34: 3,
  kx9fr02: 7,
  lo9ia24: 2,
  la7vc77: 5,
  nk1mo89: 2,
  ur9iq73: 2,
  rz78v01: 3,
  fv5uq33: 3,
  ey6uw71: 8,
  el0wa18: 2,
  zs4mw04: 5,
  nr78z46: 2,
  gk2qz88: 2,
  py9cc56: 3,
  nm4md59: 2,
  nr8tv95: 3,
  bm2rn03: 2,
  ps4nb23: 7,
  jm8qy41: 29,
  vo5kj15: 4,
  pi0xx78: 12,
  lk4xz51: 2,
};

const BASE_VALUES = {
  Numero_ordre: '26',
  nom_key: 'Aladji Sow',
  telephone_key: '771234567',
  latitude_key: '13.4332708',
  longitude_key: '-13.6843772',
  region_key: 'Kolda',
  LOCALISATION_CLIENT: '13.4332708 -13.6843772',
};

const missingNamesFor = (values: Record<string, unknown>) =>
  validateInternalKoboRequiredFields(values).map((field) => field.name);

describe('internal Kobo form definition', () => {
  it('keeps the audited XLSForm version and required field coverage', () => {
    expect(INTERNAL_KOBO_FORM_SETTINGS.version).toBe('8 (2021-07-24 19:48:35)');

    const fieldNames = new Set(INTERNAL_KOBO_FIELD_NAMES);
    expect(XLS_REQUIRED_FIELD_NAMES.filter((fieldName) => !fieldNames.has(fieldName))).toEqual([]);
  });

  it('keeps every XLSForm choice list and option count', () => {
    const choiceListSizes = Object.fromEntries(
      Object.entries(INTERNAL_KOBO_CHOICES).map(([listName, choices]) => [listName, choices.length])
    );

    expect(choiceListSizes).toEqual(XLS_CHOICE_LIST_SIZES);
  });

  it('shows the preparateur fields through the shared preparation section', () => {
    const visibleNames = getVisibleInternalKoboFields({ role: '__pr_parateur' }).map((field) => field.name);

    expect(visibleNames).toEqual(expect.arrayContaining([
      'Nombre_de_KIT_pr_par',
      'Nombre_de_KIT_Charg_pour_livraison',
      'notes_generales',
    ]));
    expect(visibleNames).not.toContain('Situation_du_M_nage');
    expect(visibleNames).not.toContain('kit_disponible_macon');
  });

  it('locks controller final validation behind earth value and observation', () => {
    const controllerBase = {
      ...BASE_VALUES,
      role: 'controleur',
      ETAT_DE_L_INSTALLATION: 'terminee',
      Phase_de_controle: 'visite_1',
      ETAT_BRANCHEMENT: 'non_termine',
      OBSERVATION: ['potelet_non_encore_pos'],
      DISJONCTEUR_GENERAL_EN_TETE_D_: 'conforme',
      TYPE_DE_DISJONCTEUR_GENERAL: 'differentiel',
      ENSEMBLE_DE_L_INSTALLATION_PRO: 'conforme',
      PROTECTION_L_ORIGINE_DE_CHAQ: 'conforme',
      S_PARATION_DES_CIRCUITS_Lumi_: 'conforme',
      PROTECTION_CONTRE_LES_CONTACTS: 'conforme',
      MISE_EN_OEUVRE_MAT_RIEL_ET_APP: 'conforme',
      CONTINUITE_DE_LA_PROTECTION_ME: 'conforme',
      MISE_EN_UVRE_DU_R_SEAU_DE_TER: 'conforme',
      notes_generales: 'RAS',
    };

    expect(missingNamesFor(controllerBase)).toContain('VALEUR_DE_LA_RESISTANCE_DE_TER');
    expect(missingNamesFor(controllerBase)).not.toContain('OBSERVATIONS__007');
    expect(missingNamesFor(controllerBase)).not.toContain('validation_controleur_final');

    expect(missingNamesFor({
      ...controllerBase,
      VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme',
    })).toContain('OBSERVATIONS__007');

    expect(missingNamesFor({
      ...controllerBase,
      VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme',
      OBSERVATIONS__007: '8',
    })).toContain('validation_controleur_final');
  });

  it('blocks final submission when numeric or GPS values are invalid', () => {
    const issues = validateInternalKoboFields({
      ...BASE_VALUES,
      Numero_ordre: '-1',
      LOCALISATION_CLIENT: '999 999',
      role: 'macon',
      kit_disponible_macon: 'oui',
      type_mur_realise_macon: 'mur-standard',
      validation_macon_final: true,
      notes_generales: 'RAS',
    });

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: expect.objectContaining({ name: 'Numero_ordre' }), type: 'constraint' }),
      expect.objectContaining({ field: expect.objectContaining({ name: 'LOCALISATION_CLIENT' }), type: 'constraint' }),
    ]));
  });

  it('validates optional preparateur integer fields when they are visible', () => {
    const issues = validateInternalKoboFields({
      ...BASE_VALUES,
      role: '__pr_parateur',
      Nombre_de_KIT_pr_par: '-2',
      Nombre_de_KIT_Charg_pour_livraison: '1.5',
      notes_generales: 'RAS',
    });

    expect(issues.map((issue) => issue.field.name)).toEqual(expect.arrayContaining([
      'Nombre_de_KIT_pr_par',
      'Nombre_de_KIT_Charg_pour_livraison',
    ]));
  });
});
