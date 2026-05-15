/**
 * 🌍 Packs Pays (Country Packs)
 * Définit les spécificités territoriales, administratives et réglementaires par pays.
 */

export interface CountryPack {
  id: string;
  name: string;
  flag: string;
  currency: string;
  timezone: string;
  administrativeLevels: string[]; // ex: ['Région', 'Département', 'Commune', 'Village']
  languages: string[];
  norms: string[]; // ex: ['SENELEC_C1', 'ERP_2024']
}

export const COUNTRY_PACKS: Record<string, CountryPack> = {
  SENEGAL: {
    id: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    administrativeLevels: ['Région', 'Département', 'Commune', 'Village'],
    languages: ['Français', 'Wolof', 'Pulaar', 'Serer'],
    norms: ['SENELEC', 'ANASER', 'CONSUEL_SN'],
  },
  COTE_IVOIRE: {
    id: 'CI',
    name: 'Côte d’Ivoire',
    flag: '🇨🇮',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    administrativeLevels: ['District', 'Région', 'Département', 'Sous-Préfecture'],
    languages: ['Français', 'Dioula', 'Baoulé'],
    norms: ['CI-ENERGIES', 'LBTP'],
  },
  MALI: {
    id: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    currency: 'XOF',
    timezone: 'Africa/Bamako',
    administrativeLevels: ['Région', 'Cercle', 'Commune', 'Quartier'],
    languages: ['Français', 'Bambara'],
    norms: ['EDM-SA'],
  },
};
