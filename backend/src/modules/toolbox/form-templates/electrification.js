/**
 * Template Électrification — GED OS Toolbox
 * Formulaire de collecte pour le suivi des installations solaires
 */
export default {
  key: 'electrification',
  title: 'Suivi installation solaire',
  description: 'Collecte terrain pour installation et maintenance de kits solaires individuels',
  sector: 'Energie',
  country: 'Senegal',
  defaultLanguage: 'fr',
  languages: ['fr', 'en', 'wo'],
  settings: {
    style: 'pages',
    default_language: 'Francais (fr)',
  },
  survey: [
    // ── Identification ──
    { type: 'begin_group', name: 'identification', label: 'Identification du ménage' },
    { type: 'integer', name: 'Numero_ordre', label: 'Numero ordre', required: true },
    { type: 'text', name: 'nom_installateur', label: "Nom de l'installateur", required: true },
    { type: 'date', name: 'date_intervention', label: "Date d'intervention", required: true },
    { type: 'geopoint', name: 'gps_installation', label: 'GPS installation', required: true },
    { type: 'image', name: 'photo_menage', label: 'Photo du ménage', required: true },
    { type: 'end_group', name: 'end_identification' },

    // ── Kit solaire ──
    { type: 'begin_group', name: 'kit_solaire', label: 'Kit solaire installé' },
    {
      type: 'select_one panneaux',
      name: 'type_panneau',
      label: 'Type de panneau',
      required: true,
    },
    { type: 'integer', name: 'puissance_panneau', label: 'Puissance (Wc)', required: true },
    { type: 'integer', name: 'nb_panneaux', label: 'Nombre de panneaux', required: true },
    { type: 'select_one oui_non', name: 'batterie_installee', label: 'Batterie installée ?', required: true },
    { type: 'integer', name: 'capacite_batterie', label: 'Capacité batterie (Ah)', relevant: "${batterie_installee} = 'oui'" },
    { type: 'image', name: 'photo_installation', label: "Photo de l'installation" },
    { type: 'end_group', name: 'end_kit_solaire' },

    // ── État et satisfaction ──
    { type: 'begin_group', name: 'satisfaction', label: 'Satisfaction client' },
    {
      type: 'select_one satisfaction',
      name: 'satisfaction_client',
      label: 'Niveau de satisfaction',
      required: true,
    },
    { type: 'text', name: 'commentaire', label: 'Commentaires' },
    { type: 'signature', name: 'signature_client', label: 'Signature du client' },
    { type: 'end_group', name: 'end_satisfaction' },
  ],
  choices: {
    oui_non: [
      { name: 'oui', label: 'Oui', label_en: 'Yes' },
      { name: 'non', label: 'Non', label_en: 'No' },
    ],
    panneaux: [
      { name: 'monocristallin', label: 'Monocristallin' },
      { name: 'polycristallin', label: 'Polycristallin' },
      { name: 'couche_mince', label: 'Couche mince' },
    ],
    satisfaction: [
      { name: 'tres_satisfait', label: 'Très satisfait' },
      { name: 'satisfait', label: 'Satisfait' },
      { name: 'neutre', label: 'Neutre' },
      { name: 'insatisfait', label: 'Insatisfait' },
    ],
  },
};
