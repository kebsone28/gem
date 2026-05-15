/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';

/**
 * Labels definition for the entire application.
 * Allows switching from "Ménage" to "Pylône", "École", "Client", etc.
 */
interface AppLabels {
  household: {
    singular: string;
    plural: string;
    definite: string;
    indefinite: string;
  };
  zone: {
    singular: string;
    plural: string;
  };
  project: {
    singular: string;
    plural: string;
  };
  mission: {
    singular: string;
    plural: string;
  };
  trade: {
    singular: string;
    plural: string;
    livraison: string;
    macons: string;
    reseau: string;
    installation: string;
    controle: string;
  };
  phase: {
    singular: string;
    plural: string;
    formation: string;
    livraison: string;
    maconnerie: string;
    reseau: string;
    installation: string;
    controle: string;
  };
}

const DEFAULT_LABELS: AppLabels = {
  household: {
    singular: 'Ménage',
    plural: 'Ménages',
    definite: 'le ménage',
    indefinite: 'un ménage',
  },
  zone: {
    singular: 'Zone',
    plural: 'Zones',
  },
  project: {
    singular: 'Projet',
    plural: 'Projets',
  },
  mission: {
    singular: 'Mission',
    plural: 'Missions',
  },
  trade: {
    singular: 'Métier',
    plural: 'Métiers',
    livraison: 'Livraison',
    macons: 'Maçons',
    reseau: 'Réseau',
    installation: 'Installation',
    controle: 'Contrôle',
  },
  phase: {
    singular: 'Phase',
    plural: 'Phases',
    formation: 'Formation',
    livraison: 'Livraison matériel',
    maconnerie: 'Travaux maçonnerie',
    reseau: 'Travaux réseau',
    installation: 'Travaux intérieur',
    controle: 'Suivi contrôle et reporting',
  },
};

interface LabelsContextType {
  labels: AppLabels;
  getLabel: (path: string, countOrFallback?: number | string) => string;
}

const LabelsContext = createContext<LabelsContextType | undefined>(undefined);

import { useProject } from './ProjectContext';
 
 export const LabelsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const { user } = useAuth();
   const { project } = useProject();
 
   const labels = useMemo(() => {
     // 1. Labels de l'organisation (Global)
     const orgLabels = (user?.organizationConfig as any)?.labels || {};
     
     // 2. Labels du projet actif (SaaS Customization)
     const projectLabels = (project?.config as any)?.labels || {};
     
     return {
       household: { 
         ...DEFAULT_LABELS.household, 
         ...orgLabels.household,
         ...projectLabels.household 
       },
       zone: { 
         ...DEFAULT_LABELS.zone, 
         ...orgLabels.zone,
         ...projectLabels.zone 
       },
       project: { 
         ...DEFAULT_LABELS.project, 
         ...orgLabels.project,
         ...projectLabels.project 
       },
       mission: { 
         ...DEFAULT_LABELS.mission, 
         ...orgLabels.mission,
         ...projectLabels.mission 
       },
       trade: { 
         ...DEFAULT_LABELS.trade, 
         ...orgLabels.trade,
         ...projectLabels.trade 
       },
       phase: { 
         ...DEFAULT_LABELS.phase, 
         ...orgLabels.phase,
         ...projectLabels.phase 
       },
     };
   }, [user?.organizationConfig?.labels, project?.config?.labels]);

  const getLabel = useCallback(
    (path: string, countOrFallback?: number | string): string => {
      const fallback = typeof countOrFallback === 'string' ? countOrFallback : path;
      const count = typeof countOrFallback === 'number' ? countOrFallback : undefined;

      const [category, sub] = path.split('.');
      const cat = (labels as any)[category];
      if (!cat) return fallback;

      if (sub) return cat[sub] || fallback;

      if (count !== undefined && count > 1) return cat.plural;
      return cat.singular || fallback;
    },
    [labels]
  );

  return <LabelsContext.Provider value={{ labels, getLabel }}>{children}</LabelsContext.Provider>;
};

export const useLabels = () => {
  const context = useContext(LabelsContext);
  if (!context) throw new Error('useLabels must be used within LabelsProvider');
  return context;
};
