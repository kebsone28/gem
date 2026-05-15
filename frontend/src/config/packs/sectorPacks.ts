/**
 * 🏗️ Packs Sectoriels GED OS (Écosystème Business)
 * Définit l'intelligence métier, les KPIs et les types d'IA pour chaque domaine.
 */

export interface SectorPack {
  id: string;
  name: string;
  category: string;
  aiFeatures: string[];
  kpis: { id: string; label: string; unit: string }[];
  workflows: string[];
  entityTypes: string[];
}

export const SECTOR_PACKS: Record<string, SectorPack> = {
  // --- 1. ÉNERGIE ---
  ELECTRICITY_BT: {
    id: 'elec_bt',
    name: 'GED Énergie BT',
    category: 'Énergie',
    aiFeatures: ['Détection Fraude', 'Chute de Tension', 'Optimisation Tracé'],
    kpis: [
      { id: 'loss_rate', label: 'Taux de Perte Tech', unit: '%' },
      { id: 'connection_rate', label: 'Taux Branchement', unit: '%' },
      { id: 'revenue_protection', label: 'Recettes Sécurisées', unit: 'XOF' }
    ],
    workflows: ['Demande Raccordement', 'Pose Compteur', 'Validation Consuel'],
    entityTypes: ['Abonnés', 'Compteurs', 'Postes BT'],
  },
  ELECTRICITY_HT: {
    id: 'elec_ht',
    name: 'GED Énergie HT',
    category: 'Énergie',
    aiFeatures: ['Maintenance Prédictive', 'Analyse Thermographique', 'Drone Inspection'],
    kpis: [
      { id: 'availability', label: 'Disponibilité Ligne', unit: '%' },
      { id: 'load_factor', label: 'Facteur de Charge', unit: '%' },
    ],
    workflows: ['Inspection Pylône', 'Maintenance Transformateur', 'Intervention Urgence'],
    entityTypes: ['Pylônes', 'Transformateurs', 'Postes HT'],
  },
  SOLAR: {
    id: 'solar',
    name: 'GED Solaire',
    category: 'Énergie',
    aiFeatures: ['Optimisation Production', 'Santé Batteries', 'Simulation IA'],
    kpis: [
      { id: 'production', label: 'Production Solaire', unit: 'kWh' },
      { id: 'battery_health', label: 'État Batteries', unit: '%' },
    ],
    workflows: ['Installation Kit', 'Monitoring Temps Réel', 'Maintenance Panneaux'],
    entityTypes: ['Sites Solaires', 'Batteries', 'Onduleurs', 'Panneaux'],
  },

  // --- 2. EAU ---
  WATER: {
    id: 'water',
    name: 'GED Eau',
    category: 'Hydraulique',
    aiFeatures: ['Détection Fuites', 'Qualité de l\'Eau IA', 'Optimisation Pompage'],
    kpis: [
      { id: 'pressure', label: 'Pression Réseau', unit: 'Bar' },
      { id: 'turbidity', label: 'Turbidité', unit: 'NTU' },
      { id: 'flow_rate', label: 'Débit Moyen', unit: 'm3/h' }
    ],
    workflows: ['Réparation Fuite', 'Analyse Qualité', 'Maintenance Pompe'],
    entityTypes: ['Forages', 'Conduites', 'Châteaux d\'eau'],
  },

  // --- 3. AGRICULTURE ---
  AGRICULTURE: {
    id: 'agri',
    name: 'GED Agro',
    category: 'Agriculture',
    aiFeatures: ['Diagnostic Maladies', 'Prévision Rendement', 'Besoin Irrigation'],
    kpis: [
      { id: 'yield', label: 'Rendement estimé', unit: 't/ha' },
      { id: 'soil_moisture', label: 'Humidité Sol', unit: '%' },
    ],
    workflows: ['Préparation Sol', 'Semis', 'Récolte'],
    entityTypes: ['Parcelles', 'Producteurs', 'Cultures'],
  },
  LIVESTOCK: {
    id: 'livestock',
    name: 'GED Élevage',
    category: 'Agriculture',
    aiFeatures: ['Suivi Sanitaire IA', 'Traçabilité Bétail', 'Prédiction Épidémies'],
    kpis: [
      { id: 'mortality', label: 'Taux Mortalité', unit: '%' },
      { id: 'vaccination_coverage', label: 'Couverture Vaccinale', unit: '%' },
    ],
    workflows: ['Campagne Vaccination', 'Suivi Troupeau', 'Transhumance'],
    entityTypes: ['Troupeaux', 'Éleveurs', 'Zones Pastorales'],
  },

  // --- 4. SANTÉ ---
  HEALTH: {
    id: 'health',
    name: 'GED Santé',
    category: 'Santé',
    aiFeatures: ['Alerte Épidémique', 'Tri Patient IA', 'Optimisation Stocks'],
    kpis: [
      { id: 'patient_flow', label: 'Flux Patients', unit: 'Pers/jour' },
      { id: 'vaccination_rate', label: 'Taux Vaccination', unit: '%' },
    ],
    workflows: ['Consultation', 'Prescription', 'Suivi Vaccination'],
    entityTypes: ['Patients', 'Médecins', 'Centres Santé'],
  },

  // --- 5. ÉDUCATION ---
  EDUCATION: {
    id: 'education',
    name: 'GED Éducation',
    category: 'Services Sociaux',
    aiFeatures: ['IA Pédagogique', 'Analyse Absentéisme', 'Optimisation Carte Scolaire'],
    kpis: [
      { id: 'attendance', label: 'Taux Présence', unit: '%' },
      { id: 'success_rate', label: 'Taux de Réussite', unit: '%' },
    ],
    workflows: ['Inscription', 'Examen', 'Suivi Formateur'],
    entityTypes: ['Élèves', 'Enseignants', 'Classes', 'Écoles'],
  },

  // --- 6. INFRASTRUCTURES & BTP ---
  INFRA: {
    id: 'infra',
    name: 'GED Infra',
    category: 'Infrastructure',
    aiFeatures: ['Analyse de Chantier IA', 'Suivi Routes par Satellite', 'Contrôle Qualité'],
    kpis: [
      { id: 'execution_rate', label: 'Taux d\'Exécution', unit: '%' },
      { id: 'safety_compliance', label: 'Conformité HSE', unit: '%' },
    ],
    workflows: ['Validation DOE', 'Rapport de Chantier', 'Contrôle Béton'],
    entityTypes: ['Chantiers', 'Ouvrages', 'Entreprises'],
  },

  // --- 7. SMART CITY ---
  SMART_CITY: {
    id: 'smart_city',
    name: 'GED VilleIntelligente',
    category: 'Territoire',
    aiFeatures: ['IA Urbaine Supervision', 'Détection Incidents Vidéo', 'Optimisation Éclairage'],
    kpis: [
      { id: 'energy_saving', label: 'Économie Énergie', unit: '%' },
      { id: 'response_time', label: 'Temps d\'Intervention', unit: 'min' },
    ],
    workflows: ['Maintenance Éclairage', 'Supervision Trafic', 'Collecte Déchets'],
    entityTypes: ['Quartiers', 'Caméras', 'Points Lumineux'],
  },

  // --- 8. ENVIRONNEMENT ---
  CLIMATE: {
    id: 'climate',
    name: 'GED Climat',
    category: 'Environnement',
    aiFeatures: ['IA Environnementale', 'Détection Déforestation', 'Analyse Carbone'],
    kpis: [
      { id: 'forest_cover', label: 'Couverture Forestière', unit: 'ha' },
      { id: 'carbon_offset', label: 'Carbone Séquestré', unit: 'tCO2' },
    ],
    workflows: ['Reboisement', 'Surveillance Zone', 'Audit Pollution'],
    entityTypes: ['Zones Protégées', 'Forêts', 'Émissions'],
  },

  // --- 9. TRANSPORT ---
  MOBILITY: {
    id: 'mobility',
    name: 'GED Mobilité',
    category: 'Transport',
    aiFeatures: ['IA Logistique Flotte', 'Eco-Conduite', 'Maintenance Prédictive'],
    kpis: [
      { id: 'fuel_consumption', label: 'Consommation Carburant', unit: 'L/100' },
      { id: 'fleet_availability', label: 'Dispo Flotte', unit: '%' },
    ],
    workflows: ['Mission Transport', 'Maintenance Véhicule', 'Suivi Trajet'],
    entityTypes: ['Véhicules', 'Chauffeurs', 'Trajets'],
  },

  // --- 10. LOGISTIQUE ---
  LOGISTICS: {
    id: 'logistics',
    name: 'GED Logistique',
    category: 'Logistique',
    aiFeatures: ['IA Stock Prédictif', 'Optimisation Livraison', 'Traçabilité QR/RFID'],
    kpis: [
      { id: 'stock_accuracy', label: 'Précision Inventaire', unit: '%' },
      { id: 'lead_time', label: 'Délai Livraison', unit: 'h' },
    ],
    workflows: ['Entrée Stock', 'Livraison Client', 'Inventaire'],
    entityTypes: ['Stocks', 'Dépôts', 'Articles'],
  },

  // --- 11. GOUVERNANCE ---
  GOV: {
    id: 'gov',
    name: 'GED Gouvernance',
    category: 'Gouvernance',
    aiFeatures: ['Analyse de Conformité IA', 'Signature Électronique', 'Workflow État'],
    kpis: [
      { id: 'admin_efficiency', label: 'Temps de Traitement', unit: 'jours' },
      { id: 'citizen_satisfaction', label: 'Satisfaction Citoyen', unit: '%' },
    ],
    workflows: ['Validation Hiérarchique', 'Audit Public', 'Signature PV'],
    entityTypes: ['Directions', 'Régions', 'Agents'],
  },

  // --- 12. IMPACT ---
  IMPACT: {
    id: 'impact',
    name: 'GED Impact',
    category: 'Social',
    aiFeatures: ['Analyse Impact IA', 'Reporting Bailleurs Auto', 'Cartographie Sociale'],
    kpis: [
      { id: 'beneficiaries_reached', label: 'Bénéficiaires', unit: 'Pers' },
      { id: 'impact_score', label: 'Score d\'Impact', unit: '/100' },
    ],
    workflows: ['Enquête Sociale', 'Distribution Aide', 'Rapport Bailleur'],
    entityTypes: ['Bénéficiaires', 'Programmes', 'Donateurs'],
  },

  // --- 13. INDUSTRIE ---
  INDUSTRY: {
    id: 'industry',
    name: 'GED Industrie',
    category: 'Industrie',
    aiFeatures: ['Maintenance Prédictive Industrielle', 'Optimisation Production', 'IA Énergie'],
    kpis: [
      { id: 'oee', label: 'Rendement Global (OEE)', unit: '%' },
      { id: 'downtime', label: 'Temps d\'Arrêt', unit: 'min' },
    ],
    workflows: ['Production Lot', 'Maintenance Machine', 'Contrôle Qualité'],
    entityTypes: ['Machines', 'Lignes de Production', 'Usines'],
  },

  // --- 14. SÉCURITÉ ---
  SECURE: {
    id: 'secure',
    name: 'GED Sécurité',
    category: 'Sécurité',
    aiFeatures: ['IA Vidéo Protection', 'Détection Intrusion', 'Alerte Temps Réel'],
    kpis: [
      { id: 'incident_count', label: 'Incidents Détectés', unit: 'Nb' },
      { id: 'patrol_coverage', label: 'Couverture Patrouille', unit: '%' },
    ],
    workflows: ['Rapport Incident', 'Contrôle Accès', 'Mission Surveillance'],
    entityTypes: ['Caméras', 'Zones Sensibles', 'Équipes Sécu'],
  },

  // --- 15. TÉLÉCOMS ---
  TELECOM: {
    id: 'telecom',
    name: 'GED Télécom',
    category: 'Numérique',
    aiFeatures: ['Optimisation Réseau', 'Maintenance Antennes', 'IA Fibre'],
    kpis: [
      { id: 'network_availability', label: 'Dispo Réseau', unit: '%' },
      { id: 'data_traffic', label: 'Trafic Data', unit: 'TB' },
    ],
    workflows: ['Maintenance Antenne', 'Déploiement Fibre', 'Réparation Incident'],
    entityTypes: ['Antennes', 'Fibre Optique', 'Nœuds Réseau'],
  },

  // --- 16. COMMERCE ---
  COMMERCE: {
    id: 'commerce',
    name: 'GED Commerce',
    category: 'Commerce',
    aiFeatures: ['Prédiction Ventes IA', 'Marketing Dynamique', 'Gestion Marketplace'],
    kpis: [
      { id: 'sales_growth', label: 'Croissance Ventes', unit: '%' },
      { id: 'conversion_rate', label: 'Taux Conversion', unit: '%' },
    ],
    workflows: ['Gestion Vente', 'Approvisionnement', 'Facturation'],
    entityTypes: ['Boutiques', 'Stocks', 'Clients'],
  },

  // --- 17. FINANCE ---
  FINANCE: {
    id: 'finance',
    name: 'GED Finance',
    category: 'Finance',
    aiFeatures: ['Scoring Crédit IA', 'Détection Fraude Financière', 'Analyse Mobile Money'],
    kpis: [
      { id: 'transaction_volume', label: 'Volume Transactions', unit: 'Nb' },
      { id: 'npl_ratio', label: 'Taux Créances Douteuses', unit: '%' },
    ],
    workflows: ['Demande Crédit', 'Paiement', 'Validation Transaction'],
    entityTypes: ['Comptes', 'Crédits', 'Points de Vente'],
  },

  // --- 18. FONCIER ---
  LAND: {
    id: 'land',
    name: 'GED Foncier',
    category: 'Territoire',
    aiFeatures: ['Analyse Titres par Blockchain', 'IA Résolution Conflits', 'SIG Foncier'],
    kpis: [
      { id: 'parcel_registered', label: 'Parcelles Immatriculées', unit: 'Nb' },
      { id: 'conflict_reduction', label: 'Réduction Conflits', unit: '%' },
    ],
    workflows: ['Immatriculation', 'Mutation', 'Règlement Litige'],
    entityTypes: ['Parcelles', 'Titres Fonciers', 'Propriétaires'],
  },

  // --- 19. URGENCE ---
  RESCUE: {
    id: 'rescue',
    name: 'GED Secours',
    category: 'Urgence',
    aiFeatures: ['IA Gestion Crise', 'Détection Inondations Satellite', 'Coordination Secours'],
    kpis: [
      { id: 'rescue_time', label: 'Temps Secours', unit: 'min' },
      { id: 'safety_index', label: 'Indice Sécurité', unit: '/100' },
    ],
    workflows: ['Alerte Rouge', 'Coordination Secours', 'Plan Évacuation'],
    entityTypes: ['Inondations', 'Zones Sinistrées', 'Centres Secours'],
  },

  // --- 20. IA CENTRALE ---
  GED_AI: {
    id: 'ged_ai',
    name: 'GED IA Core',
    category: 'Intelligence',
    aiFeatures: ['NLP Multilingue', 'Vision Artificielle', 'Analytique Transversale'],
    kpis: [
      { id: 'ai_accuracy', label: 'Précision IA', unit: '%' },
      { id: 'automation_gain', label: 'Gain Automatisation', unit: 'h/mois' },
    ],
    workflows: ['Génération Rapport', 'Analyse Sentiment', 'Prédiction Tendance'],
    entityTypes: ['Modèles IA', 'Datasets', 'Requêtes'],
  },
};
