import type { FicheFieldDef } from '../types';



export interface PaymentSlipFicheData {
  region: string;
  grappe: string;
  bordereauId: string;
  prestataireId: string;
  periode: string; // Ex: "Juillet 2026"
  dateValidation: string;
  statutPaiement: 'En attente' | 'Approuvé' | 'Payé' | 'Refusé';
  totalDuHT: number;
  taxes?: number;
  penalitesAppliquees?: string; // Détail des pénalités
  montantNetAPayer: number;
  prestationsRealisees?: Array<{ type: string; quantite: string; montantUnitaire: number; total: number }>;
}

export const PaymentSlipFicheModel = {
  id: 'payment_slip',
  title: 'Bordereau de Paiement',
  description: 'Enregistre et justifie les paiements aux prestataires.',
  level: 3, // Niveau de fiche (ex: 3 pour facturation)
  fields: [
    { key: 'region', label: 'Région', type: 'region' },
    { key: 'grappe', label: 'Grappe', type: 'grappe' },
    { key: 'bordereauId', label: 'ID Bordereau', type: 'text', required: true, editable: true },
    { key: 'prestataireId', label: 'ID Prestataire', type: 'text', required: true, editable: true },
    { key: 'periode', label: 'Période', type: 'text', required: true, editable: true },
    { key: 'dateValidation', label: 'Date Validation', type: 'date', required: true, editable: true },
    { 
      key: 'statutPaiement', label: 'Statut Paiement', type: 'select', required: true, editable: true,
      options: ['En attente', 'Approuvé', 'Payé', 'Refusé'],
    },
    { key: 'totalDuHT', label: 'Total Dû HT', type: 'number', required: true, editable: true, inputType: 'currency' },
    { key: 'taxes', label: 'Taxes', type: 'number', editable: true, inputType: 'currency' },
    { key: 'penalitesAppliquees', label: 'Pénalités', type: 'textarea', editable: true },
    { key: 'montantNetAPayer', label: 'Montant Net à Payer', type: 'number', required: true, editable: true, inputType: 'currency' },
    // Pour prestationsRealisees, une interface utilisateur plus complexe serait nécessaire. Ici, un champ texte.
    { key: 'prestationsRealisees', label: 'Prestations Réalisées (JSON)', type: 'textarea', editable: true },
  ] as FicheFieldDef[],
};

export type PaymentSlipFicheFields = (typeof PaymentSlipFicheModel.fields)[number]['key'];
