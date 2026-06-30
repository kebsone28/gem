/**
 * Template Eau et Assainissement — GED OS Toolbox
 * Formulaire de collecte pour l'accès à l'eau et l'assainissement
 */
export default {
  key: 'eau_assainissement',
  title: "Suivi Eau et Assainissement",
  description: 'Évaluation de l\'accès à l\'eau potable et aux infrastructures sanitaires',
  sector: 'Eau et assainissement',
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

    { type: 'begin_group', name: 'source_eau', label: 'Source d\'eau principale' },
    { type: 'select_one source_eau', name: 'source_eau_principale', label: 'Source principale', required: true },
    { type: 'integer', name: 'distance_source', label: 'Distance (minutes aller/retour)', required: true },
    { type: 'select_one qualite_eau', name: 'qualite_eau', label: 'Qualité perçue de l\'eau', required: true },
    { type: 'select_one traitement_eau', name: 'traitement_eau', label: 'Traitement de l\'eau avant consommation' },
    { type: 'image', name: 'photo_source', label: 'Photo de la source' },
    { type: 'end_group', name: 'end_source_eau' },

    { type: 'begin_group', name: 'assainissement', label: 'Assainissement' },
    { type: 'select_one type_toilette', name: 'type_toilette', label: 'Type de toilette', required: true },
    { type: 'select_one oui_non', name: 'toilette_partagee', label: 'Toilette partagée ?' },
    { type: 'select_one oui_non', name: 'lave_mains', label: 'Dispositif de lavage des mains avec savon ?' },
    { type: 'select_one gestion_dechets', name: 'gestion_dechets', label: 'Gestion des déchets ménagers' },
    { type: 'end_group', name: 'end_assainissement' },

    { type: 'geopoint', name: 'gps_enquete', label: 'GPS' },
    { type: 'signature', name: 'signature', label: 'Signature' },
  ],
  choices: {
    oui_non: [
      { name: 'oui', label: 'Oui' },
      { name: 'non', label: 'Non' },
    ],
    source_eau: [
      { name: 'robinet_interieur', label: 'Robinet intérieur' },
      { name: 'robinet_exterieur', label: 'Robinet extérieur' },
      { name: 'forage', label: 'Forage' },
      { name: 'puits_protege', label: 'Puits protégé' },
      { name: 'puits_non_protege', label: 'Puits non protégé' },
      { name: 'eau_pluie', label: 'Eau de pluie' },
      { name: 'citerne', label: 'Citerne / camion' },
      { name: 'eau_surface', label: 'Eau de surface' },
    ],
    qualite_eau: [
      { name: 'bonne', label: 'Bonne' },
      { name: 'acceptable', label: 'Acceptable' },
      { name: 'mauvaise', label: 'Mauvaise' },
    ],
    traitement_eau: [
      { name: 'ebullition', label: 'Ébullition' },
      { name: 'chlore', label: 'Chlore / javellisant' },
      { name: 'filtration', label: 'Filtre' },
      { name: 'solaire', label: 'Solaire (SODIS)' },
      { name: 'aucun', label: 'Aucun traitement' },
    ],
    type_toilette: [
      { name: 'chasse_eau', label: 'Chasse d\'eau connectée réseau' },
      { name: 'chasse_fosse', label: 'Chasse d\'eau connectée fosse' },
      { name: 'latrine_vip', label: 'Latrine VIP' },
      { name: 'latrine_traditionnelle', label: 'Latrine traditionnelle' },
      { name: 'pas_toilette', label: 'Pas de toilette / nature' },
    ],
    gestion_dechets: [
      { name: 'collecte_municipale', label: 'Collecte municipale' },
      { name: 'decharge_sauvage', label: 'Décharge sauvage' },
      { name: 'incineration', label: 'Incinération' },
      { name: 'compostage', label: 'Compostage' },
      { name: 'enfouissement', label: 'Enfouissement' },
    ],
  },
};
