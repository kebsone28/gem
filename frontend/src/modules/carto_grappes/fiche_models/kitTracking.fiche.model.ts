


import type { FicheFieldDef } from '../types';

export interface KitTrackingFicheData {
  region: string;
  grappe: string;
  menageId: string; // ID du ménage
  prestataireId: string; // ID du prestataire
  dateLivraisonMagasin: string; // Date de sortie du magasin (format YYYY-MM-DD)
  dateLivraisonMenage: string; // Date de livraison au ménage (format YYYY-MM-DD)
  etatKit: 'Complet' | 'Incomplet' | 'Endommagé';
  composantsManquants?: string; // Optionnel: liste des composants manquants/endommagés
  signatureBeneficiaire?: string; // Optionnel: URL de la signature
  gpsLivraisonLat?: number; // Optionnel: latitude GPS
  gpsLivraisonLon?: number; // Optionnel: longitude GPS
  photoLivraisonUrl?: string; // Optionnel: URL de la photo
}

// Définition complète de la fiche pour l'UI
export const KitTrackingFicheModel = {
  id: 'kit_tracking',
  title: 'Suivi de Kit & Matériel',
  description: 'Enregistre la livraison et l\'état des kits et matériels au ménage.',
  level: 1, // Niveau de fiche (ex: 1 pour production)
  fields: [
    { key: 'region', label: 'Région', type: 'region' },
    { key: 'grappe', label: 'Grappe', type: 'grappe' },
    { key: 'menageId', label: 'ID Ménage', type: 'text', required: true, editable: true },
    { key: 'prestataireId', label: 'ID Prestataire', type: 'text', required: true, editable: true },
    { key: 'dateLivraisonMagasin', label: 'Date Magasin', type: 'date', required: true, editable: true },
    { key: 'dateLivraisonMenage', label: 'Date Livraison', type: 'date', required: true, editable: true },
    { 
      key: 'etatKit', label: 'État Kit', type: 'select', required: true, editable: true,
      options: ['Complet', 'Incomplet', 'Endommagé'],
    },
    { key: 'composantsManquants', label: 'Composants Manquants', type: 'textarea', editable: true },
    { key: 'signatureBeneficiaire', label: 'Signature Bénéficiaire', type: 'text', editable: true, inputType: 'url' }, // URL de l'image
    { key: 'gpsLivraisonLat', label: 'GPS Latitude', type: 'number', editable: true },
    { key: 'gpsLivraisonLon', label: 'GPS Longitude', type: 'number', editable: true },
    { key: 'photoLivraisonUrl', label: 'Photo Livraison', type: 'text', editable: true, inputType: 'url' }, // URL de l'image
  ] as FicheFieldDef[],
};

export type KitTrackingFicheFields = (typeof KitTrackingFicheModel.fields)[number]['key'];
