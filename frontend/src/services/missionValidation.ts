import type { MissionOrderData, MissionMember } from '../pages/mission/core/missionTypes';

export interface MissionValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: MissionValidationError[];
  warnings: MissionValidationError[];
}

export const validateMissionOrder = (
  data: Partial<MissionOrderData>,
  members: MissionMember[]
): ValidationResult => {
  const errors: MissionValidationError[] = [];
  const warnings: MissionValidationError[] = [];

  // Validations critiques (erreurs)
  if (!data.orderNumber?.trim()) {
    errors.push({
      field: 'orderNumber',
      message: "Le numéro d'ordre est obligatoire",
      severity: 'error',
    });
  }

  if (!data.purpose?.trim()) {
    errors.push({
      field: 'purpose',
      message: "L'objectif stratégique est obligatoire",
      severity: 'error',
    });
  }

  if (!data.startDate?.trim()) {
    errors.push({
      field: 'startDate',
      message: 'La date de début est obligatoire',
      severity: 'error',
    });
  }

  if (!data.endDate?.trim()) {
    errors.push({
      field: 'endDate',
      message: 'La date de fin est obligatoire',
      severity: 'error',
    });
  }

  // Valider ordre des dates
  if (data.startDate && data.endDate) {
    const start = parseDate(data.startDate);
    const end = parseDate(data.endDate);
    if (start && end && end < start) {
      errors.push({
        field: 'endDate',
        message: 'La date de fin doit être après la date de début',
        severity: 'error',
      });
    }
  }

  if (!data.region?.trim()) {
    errors.push({
      field: 'region',
      message: 'La région est obligatoire',
      severity: 'error',
    });
  }

  if (members.length === 0) {
    errors.push({
      field: 'members',
      message: "Au moins 1 membre d'équipe doit être assigné",
      severity: 'error',
    });
  }

  // Valider membres
  members.forEach((m, i) => {
    if (!m.name?.trim()) {
      errors.push({
        field: `members.${i}.name`,
        message: `Le nom du membre ${i + 1} est obligatoire`,
        severity: 'error',
      });
    }
    if (!m.role?.trim()) {
      errors.push({
        field: `members.${i}.role`,
        message: `Le rôle du membre ${i + 1} est obligatoire`,
        severity: 'error',
      });
    }
    if (m.dailyIndemnity < 0) {
      errors.push({
        field: `members.${i}.dailyIndemnity`,
        message: `L'indemnité du membre ${i + 1} ne peut pas être négative`,
        severity: 'error',
      });
    }
    if (m.days < 1) {
      errors.push({
        field: `members.${i}.days`,
        message: `Le nombre de jours du membre ${i + 1} doit être ≥ 1`,
        severity: 'error',
      });
    }
  });

  // Avertissements (warnings)
  if (!data.itineraryAller?.trim()) {
    warnings.push({
      field: 'itineraryAller',
      message: "L'itinéraire aller n'est pas rempli",
      severity: 'warning',
    });
  }

  if (!data.itineraryRetour?.trim()) {
    warnings.push({
      field: 'itineraryRetour',
      message: "L'itinéraire retour n'est pas rempli",
      severity: 'warning',
    });
  }

  if (!data.transport?.trim()) {
    warnings.push({
      field: 'transport',
      message: "Le vecteur de transport n'est pas spécifié",
      severity: 'warning',
    });
  }

  if (!data.planning || data.planning.length === 0) {
    warnings.push({
      field: 'planning',
      message: "Le planning n'est pas défini - générez-le ou remplissez-le",
      severity: 'warning',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

const parseDate = (dateStr: string): Date | null => {
  try {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
};

export const getMissionReadiness = (
  data: Partial<MissionOrderData>,
  members: MissionMember[],
  isCertified: boolean,
  isSubmitted: boolean
): {
  percentage: number;
  status: 'draft' | 'ready' | 'certified' | 'executed' | 'submitted';
  nextSteps: string[];
} => {
  let score = 0;
  const nextSteps: string[] = [];

  // Préparation (60% max)
  if (data.orderNumber?.trim()) score += 5;
  else nextSteps.push("Définir le numéro d'ordre");

  if (data.purpose?.trim()) score += 10;
  else nextSteps.push("Remplir l'objectif stratégique");

  if (data.startDate?.trim() && data.endDate?.trim()) score += 10;
  else nextSteps.push('Définir les dates de mission');

  if (data.region?.trim()) score += 5;
  else nextSteps.push('Sélectionner la région');

  if (members.length > 0 && members.every((m) => m.name && m.role && m.dailyIndemnity > 0))
    score += 15;
  else nextSteps.push("Compléter les membres de l'équipe");

  if (data.planning && data.planning.length > 0) score += 15;
  else nextSteps.push('Générer ou remplir le planning');

  // Certification (20% bonus)
  if (isCertified) score += 20;
  else nextSteps.push('Signer et certifier la mission');

  // Exécution (20% bonus)
  const executionDays = data.reportDays?.filter((d) => d.isCompleted).length || 0;
  const totalDays = data.reportDays?.length || 0;
  if (totalDays > 0) {
    score += (executionDays / totalDays) * 20;
  }

  const percentage = Math.min(100, score);
  let status: 'draft' | 'ready' | 'certified' | 'executed' | 'submitted' = 'draft';

  if (percentage === 100) status = 'executed';
  else if (isCertified) status = 'certified';
  else if (isSubmitted) status = 'submitted';
  else if (percentage >= 60) status = 'ready';

  return { percentage, status, nextSteps };
};

export const formatValidationError = (error: MissionValidationError): string => {
  return `${error.field}: ${error.message}`;
};
