
/**
 * Catalogue des questions techniques extraites du formulaire aEYZwPujJiFBTNb6mxMGCB
 * Utilisé pour le moteur de décision automatique.
 */
export const KOBO_TECHNICAL_QUESTIONS = [
  {
    id: 'group_pi0xx78',
    label: 'Réseau de Terre (Terre)',
    options: [
      { id: 'absence_de_piquet_de_terre', label: 'Absence de piquet de terre' },
      { id: 'piquet_de_terre_d_connect', label: 'Piquet de terre déconnecté' },
      { id: 'pas_de_barrette_de_terre', label: 'Pas de barrette de terre' },
      { id: 'terre_non_raccord__au_niveau_du_coffret', label: 'Terre non raccordée au coffret' },
      { id: 'pas_de_continuit__du_conducteur_de_prote', label: 'Pas de continuité du conducteur (V/J)' },
      { id: 'r_seau_de_terre_non_raccord', label: 'Réseau de terre non raccordé' }
    ]
  },
  {
    id: 'group_jm8qy41',
    label: 'Défauts d\'Installation (Appareillages)',
    options: [
      { id: 'coffret_disjoncteur_mal_fix', label: 'Coffret disjoncteur mal fixé' },
      { id: 'prise_mal_fix_e', label: 'Prise mal fixée' },
      { id: 'douille_mal_fix', label: 'Douille mal fixée' },
      { id: 'interrupteur_mal_fix', label: 'Interrupteur mal fixé' },
      { id: 'cable_mal_fix', label: 'Câblage intérieur mal fixé' },
      { id: 'd_faut_connexion_prise__mal_c_bl', label: 'Défaut connexion Prise (mal câblé)' },
      { id: 'pas_de_boite_de_d_rivation', label: 'Pas de boite de dérivation' }
    ]
  },
  {
    id: 'group_vo5kj15',
    label: 'Sécurité des Conducteurs (Fils)',
    options: [
      { id: 'conducteurs_visibles_sur_c_ble_1_5mm', label: 'Conducteurs visibles (1,5mm²)' },
      { id: 'conducteurs_visibles_sur_c_ble_2_5mm', label: 'Conducteurs visibles (2,5mm²)' },
      { id: 'conducteurs_visibles_sur_c_ble_4mm', label: 'Conducteurs visibles (4mm²)' },
      { id: 'conducteur_principal_de_protection_vert_', label: 'V/J sans gaine ou fourreau' }
    ]
  },
  {
    id: 'group_wu8kv54/Situation_du_M_nage',
    label: 'Éligibilité Globale',
    options: [
      { id: 'menage_non_eligible', label: 'Ménage déclaré Non Éligible' },
      { id: 'probleme_technique_d_installation', label: 'Problème technique d\'installation' }
    ]
  }
];
