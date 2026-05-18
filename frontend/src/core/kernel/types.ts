import { ComponentType } from 'react';

/**
 * ModuleManifest - Architecture "GED OS Kernel"
 * Chaque module métier déclare ses capacités, ses dépendances et son comportement au Kernel.
 */
export interface ModuleManifest {
  key: string; // ex: 'terrain'
  name: string; // Nom d'affichage
  icon: string; // Nom de l'icône Lucide
  category: 'PILOTAGE' | 'OPÉRATIONS' | 'SYSTÈME' | 'UTILITAIRE';
  description: string;
  tags?: string[];
  
  // 1. Capability Runtime Engine
  runtime?: {
    preload?: boolean;
    offlineFirst?: boolean;
    realtime?: boolean;
    sync?: boolean;
  };
  
  // 2. Dependency Engine
  dependencies?: string[]; // IDs des autres modules requis
  
  // 3. Event Bus & Orchestration
  events?: {
    emits?: string[];
    listens?: string[];
  };
  
  // 4. AI Integration
  ai?: {
    autoPilot?: boolean;
    contextProvider?: boolean;
    predictions?: boolean;
  };
  
  // 5. Routing & Component
  route: string;
  component: any; // React Component (souvent lazy-loaded)
  noLayout?: boolean; // Si vrai, n'utilise pas le shell principal
  
  // 6. Security Gateway (Backwards compatible)
  requiredPermission?: string | readonly string[];
  allowedRoles?: string[];
  visible?: (context: any) => boolean;
  
  // 7. Marketplace / Packaging (Backwards compatible)
  isPackage?: boolean;
  packageCategory?: 'core' | 'advanced' | 'experimental' | 'admin';
  global?: boolean;
  required?: boolean;
}

export type ModuleRegistry = Record<string, ModuleManifest>;
