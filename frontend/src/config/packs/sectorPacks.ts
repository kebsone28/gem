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
