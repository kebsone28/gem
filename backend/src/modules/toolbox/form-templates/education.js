/**
 * Template Éducation — GED OS Toolbox
 * Formulaire de collecte pour le suivi scolaire et éducatif
 */
export default {
  key: 'education',
  title: 'Suivi éducatif',
  description: "Collecte sur la scolarisation et les conditions d'apprentissage",
  sector: 'Education',
  country: 'Senegal',
  defaultLanguage: 'fr',
  languages: ['fr', 'en', 'wo'],
  settings: { style: 'pages', default_language: 'Francais (fr)' },
  survey: [
    { type: 'begin_group', name: 'identification', label: 'Identification' },
    { type: 'integer', name: 'Numero_ordre', label: 'Numero ordre', required: true },
    { type: 'text', name: 'enqueteur', label: "Nom de l'enquêteur", required: true },
    { type: 'date', name: 'date_enquete', label: "Date d'enquête", required: true },
    { type: 'end_group', name: 'end_identification' },

    { type: 'begin_group', name: 'scolarisation', label: 'Scolarisation' },
    { type: 'integer', name: 'nb_enfants_scolarises', label: 'Enfants scolarisés (6-16 ans)', required: true },
    { type: 'integer', name: 'nb_enfants_non_scolarises', label: 'Enfants non scolarisés', required: true },
    { type: 'select_one raison_non_scol', name: 'raison_principale', label: 'Raison principale non scolarisation', relevant: "${nb_enfants_non_scolarises} > 0" },
    { type: 'select_one type_ecole', name: 'type_ecole', label: "Type d'école fréquentée" },
    { type: 'end_group', name: 'end_scolarisation' },

    { type: 'begin_group', name: 'conditions', label: "Conditions d'apprentissage" },
    { type: 'select_one oui_non', name: 'fournitures', label: "L'enfant a-t-il des fournitures ?" },
    { type: 'select_one oui_non', name: 'repas_chaud', label: "Repas chaud à l'école ?" },
    { type: 'select_one oui_non', name: 'electricite_ecole', label: "L'école a l'électricité ?" },
    { type: 'select_one acces_eau_ecole', name: 'eau_ecole', label: "Accès à l'eau à l'école" },
    { type: 'image', name: 'photo_ecole', label: 'Photo école' },
    { type: 'end_group', name: 'end_conditions' },

    { type: 'geopoint', name: 'gps_ecole', label: 'GPS école' },
    { type: 'signature', name: 'signature', label: 'Signature' },
  ],
  choices: {
    oui_non: [{ name: 'oui', label: 'Oui' }, { name: 'non', label: 'Non' }],
    raison_non_scol: [
      { name: 'cout', label: 'Coût trop élevé' },
      { name: 'travail', label: 'Travail / aide familiale' },
      { name: 'distance', label: 'École trop loin' },
      { name: 'handicap', label: 'Handicap' },
      { name: 'autre', label: 'Autre' },
    ],
    type_ecole: [
      { name: 'public', label: 'Publique' },
      { name: 'prive', label: 'Privée' },
      { name: 'coranique', label: 'Coranique / Daara' },
      { name: 'communautaire', label: 'Communautaire' },
    ],
    acces_eau_ecole: [
      { name: 'robinet', label: 'Robinet' },
      { name: 'puits', label: 'Puits' },
      { name: 'forage', label: 'Forage' },
      { name: 'pas_eau', label: "Pas d'eau" },
    ],
  },
};
