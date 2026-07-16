import type { FicheFieldDef } from '../types';



export interface DetailedPlanningFicheData {
  region: string;
  grappe: string;
  lotConcerne: 'A' | 'B' | 'C';
  prestataireId: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  progressionPourcentage: number; // Ex: 0-100
  notes?: string;
  listeTaches?: Array<{ nomTache: string; responsable: string; dateDebut: string; dateFin: string; statut: 'Non démarré' | 'En cours' | 'Terminé' | 'Bloqué' }>;
  jalons?: Array<{ nomJalon: string; dateCible: string; atteint: boolean }>;
  ressourcesRequises?: string; // Ex: "2 équipes, 1 camion"
}

export const DetailedPlanningFicheModel = {
  id: 'detailed_planning',
  title: 'Planification Détaillée',
  description: 'Décompose les activités d\'un lot en tâches fines.',
  level: 2, // Niveau de fiche (ex: 2 pour activité/planification)
  fields: [
    { key: 'region', label: 'Région', type: 'region' },
    { key: 'grappe', label: 'Grappe', type: 'grappe' },
    { 
      key: 'lotConcerne', label: 'Lot Concerné', type: 'select', required: true, editable: true,
      options: ['A', 'B', 'C'],
    },
    { key: 'prestataireId', label: 'ID Prestataire', type: 'text', required: true, editable: true },
    { key: 'prestataireId', label: 'ID Prestataire', type: 'text', required: true, editable: true },
    { key: 'dateDebutPrevue', label: 'Début Prévu', type: 'date', required: true, editable: true },
    { key: 'dateFinPrevue', label: 'Fin Prévue', type: 'date', required: true, editable: true },
    { key: 'progressionPourcentage', label: 'Progression (%)', type: 'number', required: true, editable: true, min: 0, max: 100 },
    { key: 'notes', label: 'Notes', type: 'textarea', editable: true },
    // Pour listeTaches et jalons, des interfaces UI plus complexes seraient nécessaires.
    { key: 'listeTaches', label: 'Liste des Tâches (JSON)', type: 'textarea', editable: true },
    { key: 'jalons', label: 'Jalons (JSON)', type: 'textarea', editable: true },
    { key: 'ressourcesRequises', label: 'Ressources Requises', type: 'textarea', editable: true },
  ] as FicheFieldDef[],
};

export type DetailedPlanningFicheFields = (typeof DetailedPlanningFicheModel.fields)[number]['key'];
