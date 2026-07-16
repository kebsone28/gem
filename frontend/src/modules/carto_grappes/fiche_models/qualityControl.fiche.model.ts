import type { FicheFieldDef } from '../types';



export interface QualityControlFicheData {
  region: string;
  grappe: string;
  menageId: string;
  lotConcerne: 'A' | 'B' | 'C';
  prestataireId: string;
  dateInspection: string;
  inspecteurId: string;
  resultatInspection: 'Conforme' | 'Non-conforme' | 'Conforme avec réserves';
  observations?: string;
  listeNonConformites?: string; // Ex: "Câblage non conforme, Potelet instable"
  actionsCorrectivesRequises?: string;
  dateLeverReserves?: string;
  signatureInspecteur?: string; // URL de la signature
  photosAvantApresUrls?: string[]; // URLs des photos
}

export const QualityControlFicheModel = {
  id: 'quality_control',
  title: 'Contrôle Qualité / PV Réception',
  description: 'Documente l\'inspection et la conformité des travaux.',
  level: 3, // Niveau de fiche (ex: 3 pour qualité/réception)
  fields: [
    { key: 'region', label: 'Région', type: 'region' },
    { key: 'grappe', label: 'Grappe', type: 'grappe' },
    { key: 'menageId', label: 'ID Ménage', type: 'text', required: true, editable: true },
    { 
      key: 'lotConcerne', label: 'Lot Concerné', type: 'select', required: true, editable: true,
      options: ['A', 'B', 'C'],
    },
    { key: 'prestataireId', label: 'ID Prestataire', type: 'text', required: true, editable: true },
    { key: 'dateInspection', label: 'Date Inspection', type: 'date', required: true, editable: true },
    { key: 'inspecteurId', label: 'ID Inspecteur', type: 'text', required: true, editable: true },
    { 
      key: 'resultatInspection', label: 'Résultat', type: 'select', required: true, editable: true,
      options: ['Conforme', 'Non-conforme', 'Conforme avec réserves'],
    },
    { key: 'observations', label: 'Observations', type: 'textarea', editable: true },
    { key: 'listeNonConformites', label: 'Non-conformités', type: 'textarea', editable: true },
    { key: 'actionsCorrectivesRequises', label: 'Actions Correctives', type: 'textarea', editable: true },
    { key: 'dateLeverReserves', label: 'Date Levée Réserves', type: 'date', editable: true },
    { key: 'signatureInspecteur', label: 'Signature Inspecteur', type: 'text', editable: true, inputType: 'url' },
    { key: 'photosAvantApresUrls', label: 'Photos (URLs)', type: 'textarea', editable: true }, // Champs pour URLs multiples séparées par virgule
  ] as FicheFieldDef[],
};

export type QualityControlFicheFields = (typeof QualityControlFicheModel.fields)[number]['key'];
