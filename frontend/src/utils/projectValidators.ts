export interface ProjectCustomField {
  id: string;
  label: string;
  type: string;
}

export interface ProjectCreateFormPayload {
  name: string;
  client: string;
  country: string;
  mode: 'enterprise' | 'gov' | 'ong' | 'bailleur';
  budget: number;
  customFields: ProjectCustomField[];
  labels: Record<string, any>;
}

export interface ProjectSelection {
  module: string;
  enabled: boolean;
}

const normalizeString = (value: string | undefined, fallback = ''): string => {
  return value?.trim() || fallback;
};

export const normalizeCustomFields = (fields: ProjectCustomField[]): ProjectCustomField[] =>
  fields.map((field, index) => {
    const sanitizedLabel = normalizeString(field.label, `Champ ${index + 1}`);
    const sanitizedId =
      field.id && field.id !== 'new'
        ? field.id.trim().replace(/[^a-z0-9_]/gi, '_')
        : sanitizedLabel
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '') || `field_${index}`;

    return {
      ...field,
      label: sanitizedLabel,
      id: sanitizedId,
    };
  });

export const validateProjectCreation = (
  payload: ProjectCreateFormPayload,
  selectedFeatures: ProjectSelection[]
): string | null => {
  if (!normalizeString(payload.name)) {
    return 'Le nom du projet est requis.';
  }

  if (!normalizeString(payload.client)) {
    return 'Le client / organisation est requis.';
  }

  if (!selectedFeatures.some((feature) => feature.enabled)) {
    return 'Sélectionnez au moins un module actif.';
  }

  if (payload.customFields.some((field) => !normalizeString(field.label))) {
    return 'Tous les champs métier doivent avoir un libellé.';
  }

  return null;
};

export const buildProjectCreationPayload = (
  payload: ProjectCreateFormPayload,
  selectedFeatures: ProjectSelection[],
  selectedTemplateId?: string,
  complexity?: 'essential' | 'advanced'
) => {
  const enabledModules = selectedFeatures.filter((f) => f.enabled).map((f) => f.module);

  return {
    name: normalizeString(payload.name),
    client: normalizeString(payload.client),
    budget: payload.budget || 0,
    status: 'active',
    mode: payload.mode,
    config: {
      enabledModules,
      country: normalizeString(payload.country),
      sector: selectedTemplateId || 'elec_bt',
      customFields: normalizeCustomFields(payload.customFields),
      labels: payload.labels || {},
      complexity: complexity || 'essential',
      client: normalizeString(payload.client),
    },
  };
};
