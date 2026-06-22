import type { ModuleCategory } from './kernel/types';

export interface CategoryConfig {
  label: string;
  icon: string; // Nom de l'icône Lucide (ex: 'Home', 'Folder')
  color: string;
  glow: string;
}

export const CATEGORY_ORDER: ModuleCategory[] = [
  'EXECUTIVE',
  'PROJECTS',
  'OPERATIONS',
  'RESOURCES',
  'QUALITY',
  'FINANCE',
  'DOCUMENTS',
  'SECTORS',
  'GOVERNANCE',
  'ADMIN'
];

export const CATEGORY_METADATA: Record<Exclude<ModuleCategory, 'UTILITAIRE'>, CategoryConfig> = {
  EXECUTIVE: {
    label: 'CENTRE EXÉCUTIF',
    icon: 'Home',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  PROJECTS: {
    label: 'PORTEFEUILLE PROJETS',
    icon: 'Folder',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  OPERATIONS: {
    label: 'OPÉRATIONS TERRAIN',
    icon: 'Map',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  RESOURCES: {
    label: 'GESTION DES RESSOURCES',
    icon: 'Truck',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  QUALITY: {
    label: 'QUALITÉ & CONTRÔLE',
    icon: 'ClipboardCheck',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  FINANCE: {
    label: 'GESTION FINANCIÈRE',
    icon: 'Calculator',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  DOCUMENTS: {
    label: 'GED & COLLABORATION',
    icon: 'FileText',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  SECTORS: {
    label: 'PACKS SECTORIELS',
    icon: 'Sprout',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  GOVERNANCE: {
    label: 'GOUVERNANCE',
    icon: 'Building2',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  },
  ADMIN: {
    label: 'ADMINISTRATION',
    icon: 'Settings',
    color: 'blue',
    glow: 'shadow-blue-500/10'
  }
};
