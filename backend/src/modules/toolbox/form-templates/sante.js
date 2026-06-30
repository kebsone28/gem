/**
 * Template Santé — GED OS Toolbox
 * Formulaire de collecte pour le suivi sanitaire des ménages
 */
export default {
  key: 'sante',
  title: 'Suivi sanitaire',
  description: 'Collecte terrain pour le suivi sanitaire et nutritionnel',
  sector: 'Sante',
  country: 'Senegal',
  defaultLanguage: 'fr',
  languages: ['fr', 'en', 'wo'],
  settings: { style: 'pages', default_language: 'Francais (fr)' },
  survey: [
    { type: 'begin_group', name: 'identification', label: 'Identification' },
    { type: 'integer', name: 'Numero_ordre', label: 'Numero ordre', required: true },
    { type: 'text', name: 'nom_agent_sante', label: "Nom de l'agent", required: true },
    { type: 'date', name: 'date_visite', label: 'Date de visite', required: true },
    { type: 'geopoint', name: 'gps_visite', label: 'GPS' },
    { type: 'end_group', name: 'end_identification' },

    { type: 'begin_group', name: 'membres', label: 'Membres du ménage' },
    { type: 'integer', name: 'nb_personnes', label: 'Nombre de personnes', required: true },
    { type: 'integer', name: 'nb_enfants', label: 'Nombre enfants (-5 ans)', required: true },
    { type: 'integer', name: 'nb_femmes_enceintes', label: 'Femmes enceintes' },
    { type: 'end_group', name: 'end_membres' },

    { type: 'begin_group', name: 'vaccination', label: 'Vaccination' },
    { type: 'select_one oui_non', name: 'carnet_vaccination', label: 'Carnet de vaccination présent ?', required: true },
    { type: 'select_one complet_incomplet', name: 'statut_vaccination', label: 'Statut vaccination enfants', relevant: "${carnet_vaccination} = 'oui'", required: true },
    { type: 'image', name: 'photo_carnet', label: 'Photo du carnet' },
    { type: 'end_group', name: 'end_vaccination' },

    { type: 'begin_group', name: 'nutrition', label: 'Nutrition' },
    { type: 'select_one oui_non', name: 'allaitement', label: 'Allaitement maternel exclusif -6 mois ?' },
    { type: 'select_one oui_non', name: 'moustiquaire', label: 'Moustiquaire imprégnée utilisée ?' },
    { type: 'select_one acces_eau', name: 'acces_eau_potable', label: "Accès à l'eau potable" },
    { type: 'end_group', name: 'end_nutrition' },

    { type: 'signature', name: 'signature_agent', label: "Signature de l'agent" },
  ],
  choices: {
    oui_non: [
      { name: 'oui', label: 'Oui' },
      { name: 'non', label: 'Non' },
    ],
    complet_incomplet: [
      { name: 'complet', label: 'Complet' },
      { name: 'incomplet', label: 'Incomplet' },
      { name: 'non_disponible', label: 'Non disponible' },
    ],
    acces_eau: [
      { name: 'robinet', label: 'Robinet intérieur' },
      { name: 'pompe', label: 'Pompe publique' },
      { name: 'puits', label: 'Puits' },
      { name: 'eau_surface', label: "Eau de surface" },
      { name: 'autre', label: 'Autre' },
    ],
  },
};
