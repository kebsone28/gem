/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization */
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

/**
 * Labels definition for the entire application.
 * Allows switching from "Ménage" to "Pylône", "École", "Client", etc.
 */
interface AppLabels {
  household: {
    singular: string;
    plural: string;
    definite: string; // e.g., "le ménage"
    indefinite: string; // e.g., "un ménage"
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
};

interface LabelsContextType {
  labels: AppLabels;
  getLabel: (path: string, count?: number) => string;
}

const LabelsContext = createContext<LabelsContextType | undefined>(undefined);

export const LabelsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const labels = useMemo(() => {
    const configLabels = (user?.organizationConfig as any)?.labels || {};
    return {
      household: { ...DEFAULT_LABELS.household, ...(configLabels.household || {}) },
      zone: { ...DEFAULT_LABELS.zone, ...(configLabels.zone || {}) },
      project: { ...DEFAULT_LABELS.project, ...(configLabels.project || {}) },
      mission: { ...DEFAULT_LABELS.mission, ...(configLabels.mission || {}) },
    };
  }, [user?.organizationConfig?.labels]);

  /**
   * Helper to get a label dynamically
   * @param path e.g., "household.plural"
   * @param count if > 1, returns plural automatically if path is just "household"
   */
  const getLabel = (path: string, count?: number): string => {
    const [category, sub] = path.split('.');
    const cat = (labels as any)[category];
    if (!cat) return path;

    if (sub) return cat[sub] || path;

    // Auto pluralize if only category is provided
    if (count !== undefined && count > 1) return cat.plural;
    return cat.singular;
  };

  return <LabelsContext.Provider value={{ labels, getLabel }}>{children}</LabelsContext.Provider>;
};

export const useLabels = () => {
  const context = useContext(LabelsContext);
  if (!context) throw new Error('useLabels must be used within LabelsProvider');
  return context;
};
