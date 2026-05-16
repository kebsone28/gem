/**
 * Backend Module Registry - GEM SAAS Core
 * 
 * Ce fichier est la référence canonique côté API pour les métadonnées des modules.
 * Il permet d'assurer que lors de la création d'un projet, les modules sont 
 * instanciés avec des noms et des configurations cohérents.
 */

export const BACKEND_MODULE_REGISTRY = {
  dashboard: {
    name: 'Tableau de Bord',
    description: "Vue d'ensemble de la mission et indicateurs clés",
    isPackage: true,
    packageCategory: 'CORE',
    global: true
  },
  terrain: {
    name: 'Terrain (Carte)',
    description: 'Suivi spatial et SIG des entités terrain',
    isPackage: true,
    packageCategory: 'CORE',
    global: true
  },
  mission: {
    name: 'Missions',
    description: 'Gestion des ordres de mission et interventions',
    isPackage: true,
    packageCategory: 'CORE',
    global: false
  },
  planning: {
    name: 'Planning',
    description: 'Gantt et ordonnancement des travaux',
    isPackage: true,
    packageCategory: 'OPERATIONAL',
    global: false
  },
  logistique: {
    name: 'Logistique',
    description: 'Stocks, livraisons et inventaires matériels',
    isPackage: true,
    packageCategory: 'OPERATIONAL',
    global: false
  },
  approbation: {
    name: 'Approbation',
    description: 'Workflows de validation multi-niveaux',
    isPackage: true,
    packageCategory: 'ADMIN',
    global: false
  },
  communication: {
    name: 'Communication',
    description: 'Messagerie équipe et alertes temps réel',
    isPackage: true,
    packageCategory: 'CORE',
    global: true
  },
  simulation: {
    name: 'Simulation IA',
    description: 'Calculs et prévisions budgétaires IA',
    isPackage: true,
    packageCategory: 'ADVANCED',
    global: false
  },
  charges: {
    name: 'Tableau de Charge',
    description: 'Suivi des coûts et budgets réels',
    isPackage: true,
    packageCategory: 'CORE',
    global: false
  },
  bordereau: {
    name: 'Bordereau OM',
    description: 'Logistique financière des équipes',
    isPackage: true,
    packageCategory: 'ADMIN',
    global: false
  },
  formation: {
    name: 'Formations',
    description: 'Planification des sessions de formation',
    isPackage: true,
    packageCategory: 'OPERATIONAL',
    global: false
  },
  sharedoc: {
    name: 'Documents',
    description: 'Dépôt de documents et PV de réception',
    isPackage: true,
    packageCategory: 'CORE',
    global: true
  },
  kobo_terminal: {
    name: 'Terminal Kobo',
    description: 'Synchronisation directe KoboToolbox',
    isPackage: true,
    packageCategory: 'ADMIN',
    global: false
  },
  gem_toolbox: {
    name: 'GEM Toolbox',
    description: 'Outils internes de collecte terrain',
    isPackage: true,
    packageCategory: 'ADMIN',
    global: false
  }
};

/**
 * Récupère les métadonnées d'un module par sa clé
 */
export const getModuleMetadata = (key) => {
  return BACKEND_MODULE_REGISTRY[key] || {
    name: key.charAt(0).toUpperCase() + key.slice(1),
    description: ''
  };
};
