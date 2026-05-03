export type InternalKoboFieldType =
  | 'integer'
  | 'text'
  | 'geopoint'
  | 'select_one'
  | 'select_multiple'
  | 'acknowledge'
  | 'note'
  | 'image';

export type InternalKoboChoice = {
  name: string;
  label: string;
};

export type InternalKoboField = {
  name: string;
  type: InternalKoboFieldType;
  label: string;
  listName?: string;
  required?: boolean;
  relevant?: string;
  constraint?: string;
  constraintMessage?: string;
  hint?: string;
  guidanceHint?: string;
  appearance?: string;
  parameters?: string;
  defaultValue?: unknown;
  readOnly?: boolean;
};

export type InternalKoboValidationIssue = {
  field: InternalKoboField;
  type: 'required' | 'constraint';
  message: string;
};

export type InternalKoboSection = {
  id: string;
  title: string;
  subtitle: string;
  role?: string;
  fields: InternalKoboField[];
};

export const INTERNAL_KOBO_FORM_SETTINGS = {
  style: 'pages',
  version: '8 (2021-07-24 19:48:35)',
  defaultLanguage: 'Francais (fr)',
} as const;

export const INTERNAL_KOBO_SYSTEM_FIELD_NAMES = [
  'start',
  'end',
  'today',
  'username',
  'phonenumber',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
];

export const INTERNAL_KOBO_CHOICES: Record<string, InternalKoboChoice[]> = {
  roles: [
    { name: 'livreur', label: 'Livreur' },
    { name: 'macon', label: 'Macon' },
    { name: 'reseau', label: 'Equipe reseau' },
    { name: 'interieur', label: 'Equipe installateur' },
    { name: 'controleur', label: 'Controleur' },
    { name: '__pr_parateur', label: 'Preparateur' },
  ],
  cj3rh91: [
    { name: 'menage_eligible', label: 'Menage eligible' },
    { name: 'menage_non_eligible', label: 'Menage non eligible' },
    { name: 'menage_injoignable', label: 'Menage injoignable' },
  ],
  pr4rq21: [
    { name: 'desistement_du_menage', label: 'Desistement du menage' },
    { name: 'probleme_technique_d_installation', label: "Probleme technique d'installation" },
    { name: 'maison_en_paille', label: 'Maison en paille' },
    { name: 'probleme_de_fixation_coffret', label: 'Probleme de fixation coffret' },
  ],
  pg7bi79: [
    { name: 'menage_sans_mur', label: 'Menage sans mur' },
    { name: 'menage_avec_mur', label: 'Menage avec mur' },
  ],
  kit_disponible: [
    { name: 'oui', label: 'Oui - Kit macon disponible' },
    { name: 'non', label: 'Non - Kit macon non disponible' },
  ],
  problemes_kit_macon: [
    { name: 'pas_de_kit', label: 'Kit non livre' },
    { name: 'kit_incomplet', label: 'Kit incomplet' },
    { name: 'pas_de_potelet', label: 'Pas de potelet' },
    { name: 'autres_problemes_kit', label: 'Autres problemes' },
  ],
  type_mur: [
    { name: 'mur-standard', label: 'Mur standard (2 poteaux)' },
    { name: 'mur_en_chemine', label: 'Mur en forme de cheminee' },
  ],
  problemes_travail_macon: [
    { name: 'terrain_probleme', label: 'Probleme avec le terrain' },
    { name: 'meteo_probleme', label: 'Probleme meteo' },
    { name: 'materiel_manquant', label: 'Materiel manquant' },
    { name: 'autres_problemes_travail', label: 'Autres problemes' },
  ],
  verification_mur: [
    { name: 'oui', label: 'Oui - Mur conforme' },
    { name: 'non', label: 'Non - Mur non conforme' },
  ],
  problemes_mur_reseau: [
    { name: 'mur_non_realise', label: 'Mur non realise' },
    { name: 'mur_non_conforme', label: 'Mur non conforme' },
    { name: 'autre_probleme_mur', label: 'Autre probleme avec le mur' },
  ],
  etat_branchement: [
    { name: 'termine', label: 'Branchement termine' },
    { name: 'probleme', label: 'Probleme lors du branchement' },
  ],
  problemes_branchement_reseau: [
    { name: 'pas_de_materiel_reseau', label: 'Pas de materiel disponible' },
    { name: 'probleme_technique_reseau', label: 'Probleme technique' },
    { name: 'autres_problemes_reseau', label: 'Autres problemes' },
  ],
  verification_branchement: [
    { name: 'oui', label: 'Oui - Branchement conforme' },
    { name: 'non', label: 'Non - Branchement non conforme' },
  ],
  problemes_branchement_interieur: [
    { name: 'branchement_non_realise', label: 'Branchement non realise' },
    { name: 'branchement_non_conforme', label: 'Branchement non conforme' },
    { name: 'autre_probleme_branchement', label: 'Autre probleme avec le branchement' },
  ],
  etat_installation: [
    { name: 'termine', label: 'Installation terminee' },
    { name: 'probleme', label: "Probleme lors de l'installation" },
  ],
  problemes_installation_interieur: [
    { name: 'pas_de_materiel_interieur', label: 'Pas de materiel disponible' },
    { name: 'probleme_technique_interieur', label: 'Probleme technique' },
    { name: 'autres_problemes_interieur', label: 'Autres problemes' },
  ],
  rr4dg37: [
    { name: 'terminee', label: 'Terminee' },
    { name: 'non_terminee', label: 'Non terminee' },
    { name: 'non_encore_instalee', label: 'Non encore installee' },
    { name: 'probleme_a_signaler', label: 'Probleme a signaler' },
  ],
  oo84j36: [
    { name: 'demande_extension', label: 'Demande une extension reseau' },
    { name: 'menage_ineligible2', label: 'Menage ineligible' },
    { name: 'menage_no_disponible', label: 'Menage non disponible' },
    { name: 'confusio_de_menage', label: 'Confusion de menage' },
    { name: '__maison_inaccessible', label: 'Maison inaccessible' },
  ],
  ga7rh54: [
    { name: 'visite_1', label: 'Premier controle' },
    { name: 'visite_2', label: 'Mise en conformite' },
    { name: 'visite_renouvelee', label: 'Visite renouvelee' },
  ],
  sv3tg34: [
    { name: 'realise', label: 'Realise' },
    { name: 'non_realise', label: 'Non encore realise' },
    { name: 'non_termine', label: 'Non termine' },
  ],
  kx9fr02: [
    { name: 'coffret_compteur_non_encore_pos', label: 'Coffret compteur non encore pose' },
    { name: 'potelet_non_encore_pos', label: 'Potelet non encore pose' },
    { name: 'cable_preassemble_non_encore_tire', label: 'Cable preassemble non encore tire' },
    { name: 'necessite_une_extension', label: 'Necessite une extension' },
    { name: 'pas_de_pince_d_encrages', label: "Pas de pince d'encrages" },
    { name: 'pas_de_connecteurs', label: 'Pas de connecteurs' },
    { name: 'pas_de_queue_de_cochon', label: 'Pas de queue de cochon' },
  ],
  lo9ia24: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  la7vc77: [
    { name: 'plus_de_2_positions__zone_urbaine', label: 'Depasse la position 2 en zone urbaine' },
    { name: 'plus_de_3_positions__zone_rurale', label: 'Depasse la position 3 en zone rurale' },
    { name: 'longueur_branchement_sup_rieure___40m__z', label: 'Longueur superieure a 40 m en zone urbaine' },
    { name: 'longueur_branchement_sup_rieure___50m__z', label: 'Longueur superieure a 50 m en zone rurale' },
    { name: 'necessite_une_extension', label: 'Necessite une extension' },
  ],
  nk1mo89: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  ur9iq73: [
    { name: 'c', label: 'Conforme' },
    { name: 'nc', label: 'Non conforme' },
  ],
  rz78v01: [
    { name: 'pas_de_coupe_circuit__cc', label: 'Pas de coupe circuit' },
    { name: 'coupe_circuit_deteriore', label: 'Coupe-circuit deteriore' },
    { name: 'calibre_fusible_superieur_25a', label: 'Calibre fusible superieur a 25A' },
  ],
  fv5uq33: [
    { name: 'pas_de_tube_pvc', label: 'Pas de tube PVC' },
    { name: 'protection_mecanique_non_assure_sur_tou', label: 'Protection mecanique non assuree sur toute la longueur' },
    { name: 'coffret_compteur_perce', label: 'Coffret compteur perce' },
  ],
  ey6uw71: [
    { name: 'mode_de_pose_non_conforme', label: 'Mode de pose non conforme' },
    { name: 'potelet_trop_inclin', label: 'Potelet trop incline' },
    { name: 'pas_de_pince_d_encrage', label: "Pas de pince d'encrage" },
    { name: 'pas_de_queue_de_cochon', label: 'Pas de queue de cochon' },
    { name: 'hauteur_coffret_compteur_trop_bas___inf_', label: 'Hauteur coffret inferieure a 1,20 m' },
    { name: 'le_c_ble_pr_assembl__est_jonctionn', label: 'Cable preassemble jonctionne' },
    { name: 'le_coffret_est_place_interieure_de', label: 'Coffret place a l interieur de la propriete' },
    { name: 'hauteur_coffret_compteur__hublot___sol__', label: 'Hauteur coffret superieure a 1,60 m' },
  ],
  el0wa18: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  zs4mw04: [
    { name: 'absence_de_disjoncteur_general', label: 'Absence de disjoncteur general' },
    { name: 'disjoncteur_general_non_fix', label: 'Disjoncteur general non fixe' },
    { name: 'disjoncteur_general_deterior', label: 'Disjoncteur general deteriore' },
    { name: 'disjoncteur_general_non_adapt', label: 'Disjoncteur general non adapte' },
    { name: 'emplacement_tgbt_non_adequate', label: 'Emplacement TGBT non adequat' },
  ],
  nr78z46: [
    { name: 'differentiel', label: 'Differentiel' },
    { name: 'non_differentiel', label: 'Non differentiel' },
  ],
  gk2qz88: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  py9cc56: [
    { name: 'differentiel_30ma_d_t_rior', label: 'Differentiel 30mA deteriore' },
    { name: 'differentiel_30ma_mal_positionn', label: 'Differentiel 30mA mal positionne' },
    { name: 'pas_de_differentiel_30ma', label: 'Pas de differentiel 30mA' },
  ],
  nm4md59: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  nr8tv95: [
    { name: 'absence_de_modulaire_lumiere', label: 'Absence de modulaire lumiere' },
    { name: 'absence_de_modulaire_prise', label: 'Absence de modulaire prise' },
    { name: 'calibre_modulaire_non_adapt', label: 'Calibre modulaire non adapte' },
  ],
  bm2rn03: [
    { name: 'conforme', label: 'Conforme' },
    { name: 'non_conforme', label: 'Non conforme' },
  ],
  ps4nb23: [
    { name: 'boite_de_derivation_sans_couvercle', label: 'Boite de derivation sans couvercle' },
    { name: 'coffret_trou', label: 'Coffret disjoncteur troue' },
    { name: 'option_1', label: 'PNST accessible sur douille' },
    { name: 'option_2', label: 'PNST accessible sur prise' },
    { name: 'pnst_accessible_sur_c_ble', label: 'PNST accessible sur cable' },
    { name: 'pnst_accessible_sur_interrupteur', label: 'PNST accessible sur interrupteur' },
    { name: 'prise_sans_obturateur', label: 'Prise sans obturateur' },
  ],
  jm8qy41: [
    { name: 'absence_de_douille', label: 'Absence de douille' },
    { name: 'absence_de_prise', label: 'Absence de prise' },
    { name: 'boite_de_d_rivation_mal_fix_e', label: 'Boite de derivation mal fixee' },
    { name: 'c_blage__lumi_re_interrupteur__mal_effec', label: 'Cablage lumiere/interrupteur mal effectue' },
    { name: 'c_blage___refaire_c_blage_prise_mal_effe', label: 'Cablage prise mal effectue' },
    { name: 'cable_1_5mm__jonctionn__par__pissure', label: 'Cable 1,5mm2 jonctionne par epissure' },
    { name: 'cable_2_5mm__jonctionn__par__pissure', label: 'Cable 2,5mm2 jonctionne par epissure' },
    { name: 'c_ble_arm__non_enterr', label: 'Cable alimentation mal enterre' },
    { name: 'cable_d_alimentation_non_adapt', label: 'Cable alimentation non adapte' },
    { name: 'cable_mal_fix', label: 'Cablage interieur mal fixe' },
    { name: 'coffret_disjoncteur___d_placer_en_lieu_c', label: 'Coffret disjoncteur a deplacer en lieu couvert' },
    { name: 'code_de_couleur__conducteur__non_respect', label: 'Code couleur conducteur non respecte' },
    { name: 'coffret_disjoncteur_mal_fix', label: 'Coffret disjoncteur mal fixe' },
    { name: 'cable_d_alimentation_4mm__mal_fix', label: 'Cable alimentation 4mm2 mal fixe' },
    { name: 'c_blage_pass__en_a_rien', label: 'Cablage passe en aerien' },
    { name: 'd_faut_connexion_lumi_re', label: 'Defaut connexion lumiere' },
    { name: 'douille___remplacer', label: 'Douille a remplacer' },
    { name: 'douille_mal_fix', label: 'Douille mal fixee' },
    { name: 'd_faut_connexion_prise__mal_c_bl', label: 'Defaut connexion prise' },
    { name: 'interrupteur___d_placer_en_lieu_couvert_', label: 'Interrupteur a deplacer en lieu couvert' },
    { name: 'interrupteur___remplacer', label: 'Interrupteur a remplacer' },
    { name: 'interrupteur_mal_fix', label: 'Interrupteur mal fixe' },
    { name: 'prise___remplacer', label: 'Prise a remplacer' },
    { name: 'pas_de_boite_de_d_rivation', label: 'Pas de boite de derivation' },
    { name: 'prise_mal_fix_e', label: 'Prise mal fixee' },
    { name: 'profondeur_tranch_e_non_ad_quate__minimu', label: 'Profondeur tranchee non adequate' },
    { name: 'pas_de_domino_au_niveau_de_la_boite_de_d', label: 'Pas de domino dans la boite de derivation' },
    { name: 'section_2_5mm__non_adapt_e_pour_les_lamp', label: 'Section 2,5mm2 non adaptee pour lampes' },
    { name: 'section_cable_d_alimentation_non_respect', label: 'Section cable alimentation non respectee' },
  ],
  vo5kj15: [
    { name: 'conducteurs_visibles_sur_c_ble_1_5mm', label: 'Conducteurs visibles cable 1,5mm2' },
    { name: 'conducteurs_visibles_sur_c_ble_2_5mm', label: 'Conducteurs visibles cable 2,5mm2' },
    { name: 'conducteurs_visibles_sur_c_ble_4mm', label: 'Conducteurs visibles cable 4mm2' },
    { name: 'conducteur_principal_de_protection_vert_', label: 'Conducteur vert/jaune sans gaine' },
  ],
  pi0xx78: [
    { name: 'absence_de_piquet_de_terre', label: 'Absence de piquet de terre' },
    { name: 'terre_non_raccord__sur_boite_de_d_rivati', label: 'Terre non raccordee boite derivation' },
    { name: 'terre_non_raccord__au_niveau_du_coffret', label: 'Terre non raccordee coffret disjoncteur' },
    { name: 'd_placer_la_barrette_de_terre___l_endroi', label: 'Deplacer la barrette de terre' },
    { name: 'pas_de_barrette_de_terre', label: 'Pas de barrette de terre' },
    { name: 'pas_de_continuit__du_conducteur_de_prote', label: 'Pas de continuite conducteur de protection' },
    { name: 'pas_de_domino_sur_circuit_de_terre__coff', label: 'Pas de domino terre coffret' },
    { name: 'pas_de_domino_sur_circuit_de_terre__boit', label: 'Pas de domino terre boite' },
    { name: 'piquet_de_terre_d_connect', label: 'Piquet de terre deconnecte' },
    { name: 'pas_de_protection_m_canique_du_conducteu', label: 'Pas de protection mecanique conducteur principal' },
    { name: 'r_seau_de_terre_non_raccord', label: 'Reseau de terre non raccorde' },
    { name: 'r_seau_terre_en_cours_de_pose', label: 'Reseau terre en cours de pose' },
  ],
  lk4xz51: [
    { name: 'barrette_conforme', label: 'Barrette conforme' },
    { name: 'barrette_rouill_e', label: 'Barrette rouillee' },
  ],
};

export const INTERNAL_KOBO_SECTIONS: InternalKoboSection[] = [
  {
    id: 'menage',
    title: 'Menage',
    subtitle: 'Identification et localisation',
    fields: [
      { name: 'Numero_ordre', type: 'integer', label: 'Numero ordre', required: true },
      { name: 'nom_key', type: 'text', label: 'Prenom et nom', required: true, readOnly: true },
      { name: 'telephone_key', type: 'text', label: 'Telephone', required: true, readOnly: true },
      { name: 'latitude_key', type: 'text', label: 'Latitude', required: true, readOnly: true },
      { name: 'longitude_key', type: 'text', label: 'Longitude', required: true, readOnly: true },
      { name: 'region_key', type: 'text', label: 'Region', required: true, readOnly: true },
      { name: 'LOCALISATION_CLIENT', type: 'geopoint', label: 'GPS du menage', required: true, hint: 'Coordonnees GPS du menage' },
      { name: 'role', type: 'select_one', listName: 'roles', label: 'Votre role', required: true, appearance: 'likert', parameters: 'randomize=true' },
    ],
  },
  {
    id: 'preparation_livraison',
    title: 'Preparation et livraison',
    subtitle: 'Kit, eligibilite et quantites de cable',
    role: 'livreur',
    fields: [
      { name: 'PREPARATION_DES_KITS', type: 'note', label: 'Preparation des kits', relevant: "${role} = '__pr_parateur'" },
      { name: 'Nombre_de_KIT_pr_par', type: 'integer', label: 'Nombre de KIT prepare', relevant: "${role} = '__pr_parateur'" },
      { name: 'Nombre_de_KIT_Charg_pour_livraison', type: 'integer', label: 'Nombre de KIT charge pour livraison', relevant: "${role} = '__pr_parateur'" },
      { name: 'note_Livreur', type: 'note', label: 'Etape 1/4: livreur', relevant: "${role} = 'livreur'" },
      { name: 'Situation_du_M_nage', type: 'select_one', listName: 'cj3rh91', label: 'Situation du menage', relevant: "${role} = 'livreur'" },
      { name: 'justificatif', type: 'select_multiple', listName: 'pr4rq21', label: 'Justificatif', relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_non_eligible'" },
      { name: 'Longueur_Cable_2_5mm_Int_rieure', type: 'integer', label: 'Longueur cable 2,5mm2 interieure', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Longueur_Cable_1_5mm_Int_rieure', type: 'integer', label: 'Longueur cable 1,5mm2 interieure', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Longueur_Tranch_e_Cable_arm_4mm', type: 'integer', label: 'Longueur tranchee cable arme 4mm2', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Longueur_Tranch_e_C_ble_arm_1_5mm', type: 'integer', label: 'Longueur tranchee cable arme 1,5mm2', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Je_confirme_la_remis_u_materiel_au_m_nage', type: 'acknowledge', label: 'Je confirme la remise du materiel au menage', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Je_confirme_le_marqu_osition_des_coffrets', type: 'acknowledge', label: 'Je confirme le marquage du mur et des coffrets', required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Presence_de_Mur', type: 'select_one', listName: 'pg7bi79', label: 'Presence de mur', relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Je_confirme_le_marqu_coffrets_lectriques', type: 'acknowledge', label: "Je confirme le marquage de l'emplacement des coffrets electriques", required: true, relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'" },
      { name: 'Photo', type: 'image', label: 'Photo', relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'", parameters: 'max-pixels=1024' },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'livreur' or ${role} = '__pr_parateur'", appearance: 'multiline' },
    ],
  },
  {
    id: 'macon',
    title: 'Macon',
    subtitle: 'Disponibilite du kit et mur',
    role: 'macon',
    fields: [
      { name: 'note_macon_1', type: 'note', label: 'Etape 2/4: realisation du mur', relevant: "${role} = 'macon'" },
      { name: 'kit_disponible_macon', type: 'select_one', listName: 'kit_disponible', label: 'Le kit est-il disponible et complet ?', required: true, relevant: "${role} = 'macon'" },
      { name: 'problemes_kit_macon', type: 'select_multiple', listName: 'problemes_kit_macon', label: 'Pourquoi ?', relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'non'" },
      { name: 'type_mur_realise_macon', type: 'select_one', listName: 'type_mur', label: 'Type de mur', required: true, relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'oui'" },
      { name: 'problemes_travail_macon', type: 'select_multiple', listName: 'problemes_travail_macon', label: 'Probleme', relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'oui'" },
      { name: 'validation_macon_final', type: 'acknowledge', label: 'Je valide que le mur est termine et conforme', required: true, relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'oui' and ${type_mur_realise_macon} != ''" },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'macon'", appearance: 'multiline' },
    ],
  },
  {
    id: 'reseau',
    title: 'Reseau',
    subtitle: 'Verification mur et branchement',
    role: 'reseau',
    fields: [
      { name: 'note_reseau_1', type: 'note', label: 'Etape 3/4: branchement', relevant: "${role} = 'reseau'" },
      { name: 'verification_mur_reseau', type: 'select_one', listName: 'verification_mur', label: 'Le mur est-il realise et conforme ?', required: true, relevant: "${role} = 'reseau'" },
      { name: 'problemes_mur_reseau', type: 'select_multiple', listName: 'problemes_mur_reseau', label: 'Problemes avec le mur', required: true, relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'non'" },
      { name: 'etat_branchement_reseau', type: 'select_one', listName: 'etat_branchement', label: 'Etat du branchement', required: true, relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'oui'" },
      { name: 'problemes_branchement_reseau', type: 'select_multiple', listName: 'problemes_branchement_reseau', label: 'Problemes lors du branchement', relevant: "${role} = 'reseau' and ${etat_branchement_reseau} = 'probleme'" },
      { name: 'validation_reseau_final', type: 'acknowledge', label: 'Je valide que le branchement est termine et conforme', required: true, relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'oui' and ${etat_branchement_reseau} = 'termine'" },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'reseau'", appearance: 'multiline' },
    ],
  },
  {
    id: 'interieur',
    title: 'Installation interieure',
    subtitle: 'Verification branchement et installation',
    role: 'interieur',
    fields: [
      { name: 'note_interieur_1', type: 'note', label: 'Etape 4/4: installation interieure', relevant: "${role} = 'interieur'" },
      { name: 'verification_branchement_interieur', type: 'select_one', listName: 'verification_branchement', label: 'Le branchement est-il realise et conforme ?', required: true, relevant: "${role} = 'interieur'" },
      { name: 'problemes_branchement_interieur', type: 'select_multiple', listName: 'problemes_branchement_interieur', label: 'Problemes avec le branchement', relevant: "${role} = 'interieur' and ${verification_branchement_interieur} = 'non'" },
      { name: 'etat_installation_interieur', type: 'select_one', listName: 'etat_installation', label: "Etat de l'installation interieure realisee", required: true, relevant: "${role} = 'interieur' and ${verification_branchement_interieur} = 'oui'" },
      { name: 'problemes_installation_interieur', type: 'select_multiple', listName: 'problemes_installation_interieur', label: "Problemes lors de l'installation interieure", relevant: "${role} = 'interieur' and ${etat_installation_interieur} = 'probleme'" },
      { name: 'validation_interieur_final', type: 'acknowledge', label: "Je valide que l'installation interieure est terminee et conforme", required: true, relevant: "${role} = 'interieur' and ${verification_branchement_interieur} = 'oui' and ${etat_installation_interieur} = 'termine'" },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'interieur'", appearance: 'multiline' },
    ],
  },
  {
    id: 'controle_branchement',
    title: 'Controle branchement',
    subtitle: 'Controle prealable, branchement et anomalies reseau',
    role: 'controleur',
    fields: [
      { name: 'ETAT_DE_L_INSTALLATION', type: 'select_one', listName: 'rr4dg37', label: 'Controle prealable', required: true, relevant: "${role} = 'controleur'" },
      { name: 'controleurPROB', type: 'select_multiple', listName: 'oo84j36', label: 'Quel est le probleme ?', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'probleme_a_signaler'" },
      { name: 'Phase_de_controle', type: 'select_one', listName: 'ga7rh54', label: 'Phase du controle', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'minimal' },
      { name: 'ETAT_BRANCHEMENT', type: 'select_one', listName: 'sv3tg34', label: 'Etat du branchement', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'" },
      { name: 'OBSERVATION', type: 'select_multiple', listName: 'kx9fr02', label: 'Observation', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'non_termine'" },
      { name: 'Position_du_branchement', type: 'select_one', listName: 'lo9ia24', label: 'Position et longueur du branchement sur le reseau', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'Observations_sur_la_ition_du_branchement', type: 'select_multiple', listName: 'la7vc77', label: 'Observations sur la position du branchement', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Position_du_branchement} = 'non_conforme'" },
      { name: 'Hauteur_branchement', type: 'select_one', listName: 'nk1mo89', label: 'Hauteur branchement', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'Observations', type: 'text', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Hauteur_branchement} = 'non_conforme'", defaultValue: 'La Hauteur du branchement est inferieure a la norme' },
      { name: 'Hauteur_coffret', type: 'select_one', listName: 'nk1mo89', label: 'Hauteur du coffret', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'Observations_001', type: 'text', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Hauteur_coffret} = 'non_conforme'", defaultValue: "Coffret place a l'exterieur des deux limites fixees 1,20m Mini ET 1,60m Maxi" },
      { name: 'Etat_du_coupe_circuit', type: 'select_one', listName: 'ur9iq73', label: 'Etat du coupe circuit ?', relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'OBSERVATION_001', type: 'select_multiple', listName: 'rz78v01', label: 'Observation', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Etat_du_coupe_circuit} = 'nc'" },
      { name: 'Continuit_PVC', type: 'select_one', listName: 'nk1mo89', label: 'Isolation coffret et protection descente cable', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'OBSERVATION_002', type: 'select_multiple', listName: 'fv5uq33', label: 'Observation', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Continuit_PVC} = 'non_conforme'" },
      { name: 'Mise_en_oeuvre', type: 'select_one', listName: 'nk1mo89', label: 'Mise en oeuvre du branchement', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'" },
      { name: 'OBSERVATION_003', type: 'select_multiple', listName: 'ey6uw71', label: 'Observation', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Mise_en_oeuvre} = 'non_conforme'" },
      { name: '_1_photo_anomalie_si_possible', type: 'image', label: '1 photo anomalie si possible', relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'", parameters: 'max-pixels=1024' },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'controleur'", appearance: 'multiline' },
    ],
  },
  {
    id: 'controle_interieur',
    title: 'Controle installation interieure',
    subtitle: 'Disjoncteur, DDR, circuits, terre et validation finale',
    role: 'controleur',
    fields: [
      { name: 'DISJONCTEUR_GENERAL_EN_TETE_D_', type: 'select_one', listName: 'el0wa18', label: "Disjoncteur general en tete d'installation", required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", hint: 'Verifier conformite materiel, mise en oeuvre, coupure generale, calibre et emplacement du coffret.' },
      { name: 'OBSERVATIONS_', type: 'select_multiple', listName: 'zs4mw04', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${DISJONCTEUR_GENERAL_EN_TETE_D_} = 'non_conforme'" },
      { name: 'TYPE_DE_DISJONCTEUR_GENERAL', type: 'select_one', listName: 'nr78z46', label: 'Type de disjoncteur general', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${DISJONCTEUR_GENERAL_EN_TETE_D_} = 'conforme'" },
      { name: 'ENSEMBLE_DE_L_INSTALLATION_PRO', type: 'select_one', listName: 'gk2qz88', label: "Ensemble de l'installation protege par DDR 30mA", required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS__001', type: 'select_multiple', listName: 'py9cc56', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ENSEMBLE_DE_L_INSTALLATION_PRO} = 'non_conforme'" },
      { name: 'PROTECTION_L_ORIGINE_DE_CHAQ', type: 'select_one', listName: 'nm4md59', label: "Protection a l'origine de chaque circuit", required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS_002', type: 'select_multiple', listName: 'nr8tv95', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${PROTECTION_L_ORIGINE_DE_CHAQ} = 'non_conforme'" },
      { name: 'S_PARATION_DES_CIRCUITS_Lumi_', type: 'select_one', listName: 'nm4md59', label: 'Separation des circuits lumiere et prise', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false', guidanceHint: 'Circuit prise et lumiere non separe' },
      { name: 'OBSERVATIONS__002', type: 'text', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${S_PARATION_DES_CIRCUITS_Lumi_} = 'non_conforme'", defaultValue: 'Circuits prise et lumiere non separes' },
      { name: 'PROTECTION_CONTACT_D_TOUTE_L_INSTALLATION', type: 'note', label: "Protection contact direct a verifier sur toute l'installation", relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'" },
      { name: 'PROTECTION_CONTRE_LES_CONTACTS', type: 'select_one', listName: 'bm2rn03', label: 'Protection contre les contacts directs', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'" },
      { name: 'OBSERVATIONS__003', type: 'select_multiple', listName: 'ps4nb23', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${PROTECTION_CONTRE_LES_CONTACTS} = 'non_conforme'" },
      { name: 'MISE_EN_OEUVRE_MAT_RIEL_ET_APP', type: 'select_one', listName: 'nm4md59', label: 'Mise en oeuvre materiel et appareillage', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS__004', type: 'select_multiple', listName: 'jm8qy41', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${MISE_EN_OEUVRE_MAT_RIEL_ET_APP} = 'non_conforme'" },
      { name: 'CONTINUITE_DE_LA_PROTECTION_ME', type: 'select_one', listName: 'nm4md59', label: 'Continuite de la protection mecanique des conducteurs', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS__005', type: 'select_multiple', listName: 'vo5kj15', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${CONTINUITE_DE_LA_PROTECTION_ME} = 'non_conforme'" },
      { name: 'RESEAU_DE_TERRE_A_VE_TOUTE_L_INSTALLATION', type: 'note', label: "Reseau de terre a verifier sur toute l'installation", relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'" },
      { name: 'MISE_EN_UVRE_DU_R_SEAU_DE_TER', type: 'select_one', listName: 'nm4md59', label: 'Mise en oeuvre du reseau de terre et continuite', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS__006', type: 'select_multiple', listName: 'pi0xx78', label: 'Observations', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${MISE_EN_UVRE_DU_R_SEAU_DE_TER} = 'non_conforme'" },
      { name: 'ETAT_DE_LA_BARRETTE_DE_TERRE', type: 'select_one', listName: 'lk4xz51', label: 'Etat de la barrette de terre', relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'" },
      { name: 'VALEUR_DE_LA_RESISTANCE_DE_TER', type: 'select_one', listName: 'nm4md59', label: 'Valeur de la resistance de terre ou de boucle', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'", appearance: 'quick', parameters: 'randomize=false' },
      { name: 'OBSERVATIONS__007', type: 'integer', label: 'Valeur mesuree / observation', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${VALEUR_DE_LA_RESISTANCE_DE_TER} != ''" },
      { name: 'validation_controleur_final', type: 'acknowledge', label: 'Je confirme avoir tout controle', required: true, relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${OBSERVATIONS__007} != ''" },
      { name: 'notes_generales', type: 'text', label: 'Notes generales', required: true, relevant: "${role} = 'controleur'", appearance: 'multiline' },
    ],
  },
];

export const INTERNAL_KOBO_FIELD_NAMES = Array.from(
  new Set(INTERNAL_KOBO_SECTIONS.flatMap((section) => section.fields.map((field) => field.name)))
);

export const INTERNAL_KOBO_CONTROL_FIELD_NAMES = [
  'DISJONCTEUR_GENERAL_EN_TETE_D_',
  'ENSEMBLE_DE_L_INSTALLATION_PRO',
  'PROTECTION_L_ORIGINE_DE_CHAQ',
  'S_PARATION_DES_CIRCUITS_Lumi_',
  'PROTECTION_CONTRE_LES_CONTACTS',
  'MISE_EN_OEUVRE_MAT_RIEL_ET_APP',
  'CONTINUITE_DE_LA_PROTECTION_ME',
  'MISE_EN_UVRE_DU_R_SEAU_DE_TER',
  'VALEUR_DE_LA_RESISTANCE_DE_TER',
];

const INTERNAL_KOBO_FIELD_ALIASES: Record<string, string[]> = {
  Longueur_Cable_2_5mm_Int_rieure: ['Longueur_c\u00e2ble_2_5mm_Int_rieure'],
  Longueur_Cable_1_5mm_Int_rieure: ['Longueur_c\u00e2ble_1_5mm_Int_rieure'],
  Longueur_Tranch_e_Cable_arm_4mm: ['Longueur_Tranch_e_c\u00e2ble_arm_4mm'],
  Presence_de_Mur: ['New_Question'],
  Je_confirme_le_marqu_coffrets_lectriques: ['Je_confirme_le_marqu_s_coffret_lectrique'],
};

const NON_NEGATIVE_INTEGER_FIELDS = new Set(
  INTERNAL_KOBO_SECTIONS.flatMap((section) =>
    section.fields.filter((field) => field.type === 'integer').map((field) => field.name)
  )
);

const parseKoboNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const isValidLatitude = (value: unknown) => {
  const number = parseKoboNumber(value);
  return number !== null && number >= -90 && number <= 90;
};

const isValidLongitude = (value: unknown) => {
  const number = parseKoboNumber(value);
  return number !== null && number >= -180 && number <= 180;
};

const parseGeopoint = (value: unknown) => {
  const parts = String(value ?? '')
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  return {
    latitude: parseKoboNumber(parts[0]),
    longitude: parseKoboNumber(parts[1]),
  };
};

const getInternalKoboConstraintMessage = (field: InternalKoboField, values: Record<string, unknown>) => {
  const value = getInternalKoboFieldValue(field, values);
  if (!hasInternalKoboValue(value)) return '';

  if (field.name === 'Numero_ordre') {
    const number = parseKoboNumber(value);
    return number !== null && Number.isInteger(number) && number > 0
      ? ''
      : 'Le numero ordre doit etre un entier positif.';
  }

  if (field.name === 'latitude_key') {
    return isValidLatitude(value) ? '' : 'La latitude doit etre comprise entre -90 et 90.';
  }

  if (field.name === 'longitude_key') {
    return isValidLongitude(value) ? '' : 'La longitude doit etre comprise entre -180 et 180.';
  }

  if (field.type === 'geopoint') {
    const point = parseGeopoint(value);
    return point && isValidLatitude(point.latitude) && isValidLongitude(point.longitude)
      ? ''
      : 'Le GPS doit contenir latitude et longitude valides.';
  }

  if (NON_NEGATIVE_INTEGER_FIELDS.has(field.name)) {
    const number = parseKoboNumber(value);
    return number !== null && Number.isInteger(number) && number >= 0
      ? ''
      : 'La valeur doit etre un entier positif ou nul.';
  }

  return '';
};

export const isTruthyKoboValue = (value: unknown) =>
  value === true || value === 'true' || value === 'yes' || value === 'oui' || value === '1';

export const hasInternalKoboValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

export const getInternalKoboFieldValue = (
  field: InternalKoboField,
  values: Record<string, unknown>
) => {
  const value = values[field.name];
  return hasInternalKoboValue(value) ? value : field.defaultValue;
};

export const hasInternalKoboRequiredValue = (
  field: InternalKoboField,
  values: Record<string, unknown>
) => {
  const value = getInternalKoboFieldValue(field, values);
  if (field.type === 'acknowledge') return isTruthyKoboValue(value);
  return hasInternalKoboValue(value);
};

export const getInternalKoboSubmissionValues = (values: Record<string, unknown>) => {
  const submissionValues: Record<string, unknown> = {};

  getVisibleInternalKoboFields(values).forEach((field) => {
    if (field.type === 'note') return;
    const value = getInternalKoboFieldValue(field, values);
    if (hasInternalKoboValue(value)) {
      submissionValues[field.name] = value;
      INTERNAL_KOBO_FIELD_ALIASES[field.name]?.forEach((alias) => {
        submissionValues[alias] = value;
      });
    }
  });

  return submissionValues;
};

const getValue = (values: Record<string, unknown>, name: string) => values[name];

const evaluateAtomicRelevant = (expression: string, values: Record<string, unknown>) => {
  const cleaned = expression.trim().replace(/^\((.*)\)$/, '$1').trim();
  const comparison = cleaned.match(/^\$\{([^}]+)\}\s*(=|!=)\s*'([^']*)'$/);
  if (comparison) {
    const [, fieldName, operator, expected] = comparison;
    const actual = getValue(values, fieldName);
    const actualValues = Array.isArray(actual) ? actual.map(String) : String(actual ?? '');
    const matches = Array.isArray(actualValues)
      ? actualValues.includes(expected)
      : actualValues === expected;
    return operator === '=' ? matches : !matches;
  }

  const presence = cleaned.match(/^\$\{([^}]+)\}$/);
  if (presence) return hasInternalKoboValue(getValue(values, presence[1]));

  return true;
};

export const isInternalKoboFieldVisible = (
  field: InternalKoboField,
  values: Record<string, unknown>
) => {
  if (!field.relevant) return true;

  return field.relevant
    .split(/\s+or\s+/i)
    .some((orPart) =>
      orPart
        .split(/\s+and\s+/i)
        .every((andPart) => evaluateAtomicRelevant(andPart, values))
    );
};

const dedupeFieldsByName = (fields: InternalKoboField[]) => {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.name)) return false;
    seen.add(field.name);
    return true;
  });
};

export const getVisibleInternalKoboFields = (values: Record<string, unknown>) =>
  dedupeFieldsByName(
    INTERNAL_KOBO_SECTIONS.flatMap((section) =>
      section.fields.filter((field) => isInternalKoboFieldVisible(field, values))
    )
  );

export const validateInternalKoboRequiredFields = (values: Record<string, unknown>) =>
  getVisibleInternalKoboFields(values).filter(
    (field) => field.type !== 'note' && field.required && !hasInternalKoboRequiredValue(field, values)
  );

export const validateInternalKoboConstraintFields = (
  values: Record<string, unknown>
): InternalKoboValidationIssue[] =>
  getVisibleInternalKoboFields(values)
    .filter((field) => field.type !== 'note')
    .map((field) => ({
      field,
      type: 'constraint' as const,
      message: field.constraintMessage || getInternalKoboConstraintMessage(field, values),
    }))
    .filter((issue) => Boolean(issue.message));

export const validateInternalKoboFields = (
  values: Record<string, unknown>
): InternalKoboValidationIssue[] => [
  ...validateInternalKoboRequiredFields(values).map((field) => ({
    field,
    type: 'required' as const,
    message: 'Champ obligatoire pour cette branche Kobo.',
  })),
  ...validateInternalKoboConstraintFields(values),
];

export const formatInternalKoboValue = (value: unknown, listName?: string): string => {
  if (Array.isArray(value)) {
    return value.map((item): string => formatInternalKoboValue(item, listName)).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  const raw = String(value ?? '');
  if (!raw) return '';
  const option = listName ? INTERNAL_KOBO_CHOICES[listName]?.find((choice) => choice.name === raw) : null;
  return option?.label || raw.replace(/_/g, ' ');
};
