import { addDays, differenceInDays } from 'date-fns';
import { memoize } from 'lodash';
import type { Household, ProjectConfig, Team } from '../utils/types';
import {
  PHASE_TRADE_KEYS,
  isLogisticsPlanningTeam,
  isPreparationPlanningTeam,
  recommendTeamForPlanningTask,
  teamMatchesPlanningRegion,
  type PlanningAllocationSource,
  type PlanningPhase,
} from './planningAllocation';

export type PhaseFilter = 'ALL' | PlanningPhase;

export interface PlanningAlert {
  type: string;
}

export interface PlanningTask {
  id: string;
  householdId: string;
  householdName: string;
  lotNumber: string;
  village: string;
  region: string;
  phase: PlanningPhase;
  phaseProgress: number;
  teamId?: string;
  existingAlerts?: PlanningAlert[];
  teamName?: string;
  allocationSource?: PlanningAllocationSource;
  startDate?: Date;
  endDate?: Date;
  plannedDuration: number;
  isDelayed: boolean;
  delayDays: number;
}

export interface TeamPlanning {
  team: Team;
  tasks: PlanningTask[];
  utilization: number;
  status: 'available' | 'busy' | 'overloaded';
}

export interface RegionalPlanningSummary {
  region: string;
  totalHouseholds: number;
  delayedHouseholds: number;
  teamsAssigned: Record<string, number>;
}

export interface TheoreticalNeeds {
  livraison: number;
  macons: number;
  reseau: number;
  interieur: number;
  controle: number;
  workingDays: number;
  workDaysPerWeek: number;
  effectiveRates: {
    livraison: number;
    macons: number;
    reseau: number;
    interieur: number;
    controle: number;
  };
}

export interface WorkflowStage {
  key:
    | 'FORMATION'
    | 'LIVRAISON'
    | 'MACONNERIE'
    | 'RESEAU'
    | 'INSTALLATION'
    | 'CONTROLE';
  label: string;
  teamLabel: string;
  progressLabel: string;
  teamCount: number;
  requiredTeams: number;
  ratePerTeam: number;
  dailyCapacity: number;
  projectCapacity: number;
  householdsCount: number;
  completedCount: number;
  remainingHouseholds: number;
  progress: number;
  workingDays: number;
  calendarDays: number;
  projectedWorkingDays: number | null;
  projectedCalendarDays: number | null;
  startDay: number;
  endDay: number;
  atRisk: boolean;
  isBlocked: boolean;
  details?: string;
}

export type PlanningHousehold = Household & {
  assignedTeamId?: string | null;
  alerts?: PlanningAlert[];
  createdAt?: string;
};

// Optimisation : Memoization des calculs coûteux
const DEFAULT_PRODUCTION_RATES = Object.freeze({
  livraison: 12,
  macons: 5,
  reseau: 8,
  interieur_type1: 6,
  controle: 15,
});

const DEFAULT_FORMATION_DAYS = 3;
const DEFAULT_FORMATION_TEAM_BATCH = 2;

// Cache pour les calculs fréquents
const calculationCache = new Map<string, any>();
const CACHE_TTL = 60000; // 1 minute

const getCacheKey = (prefix: string, params: Record<string, any>) => {
  return `${prefix}:${JSON.stringify(params)}`;
};

const getCachedResult = (key: string) => {
  const cached = calculationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
};

const setCachedResult = (key: string, result: any) => {
  calculationCache.set(key, { result, timestamp: Date.now() });
};

// Optimisation : Memoization des fonctions pures
export const getPlanningWorkDaysPerWeek = memoize((includeSaturday: boolean) => 
  includeSaturday ? 6 : 5
);

export const getPlanningWorkingDays = memoize((targetMonths: number, includeSaturday: boolean) =>
  targetMonths * (includeSaturday ? 26 : 22)
);

// Optimisation : Version memoizée de getCalendarDaysFromWorkingDays
const getCalendarDaysFromWorkingDays = memoize((workingDays: number, workDaysPerWeek: number) => {
  const weeks = Math.floor(workingDays / workDaysPerWeek);
  const remainder = workingDays % workDaysPerWeek;
  return weeks * 7 + remainder;
});

// Optimisation : Version améliorée de la normalisation de texte
const normalizedDeliveryStatuses = Object.freeze([
  'livre', 'livree', 'livraison effectuee', 'delivered'
]);

const includesNormalizedStatus = (() => {
  const cache = new Map<string, boolean>();
  
  return (value: string | undefined, candidates: readonly string[]) => {
    if (!value) return false;
    
    const cacheKey = `${value}:${candidates.join(',')}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const normalized = String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const result = candidates.some((candidate) => normalized.includes(candidate));
    cache.set(cacheKey, result);
    return result;
  };
})();

// Optimisation : Version memoizée de la vérification de livraison
export const hasHouseholdDeliveryEvidence = memoize((household: Household) =>
  !!household.koboSync?.livreurDate ||
  !!household.delivery?.date ||
  includesNormalizedStatus(household.deliveryStatus, normalizedDeliveryStatuses)
);

// Optimisation : Fonctions de filtrage optimisées avec des Set pour O(1) lookup
const createTeamFilter = (() => {
  const cache = new Map<string, (team: Team) => boolean>();
  
  return (selectedRegion: string, matcher: (team: Team) => boolean) => {
    const cacheKey = `${selectedRegion}:${matcher.name || 'anonymous'}`;
    
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    
    const filter = (team: Team) => {
      if (!matcher(team)) return false;
      if (selectedRegion === 'ALL') return true;
      return teamMatchesPlanningRegion(team, selectedRegion);
    };
    
    cache.set(cacheKey, filter);
    return filter;
  };
})();

const getTeamsForRegion = (teams: Team[], selectedRegion: string, matcher: (team: Team) => boolean) => {
  const filter = createTeamFilter(selectedRegion, matcher);
  return teams.filter(filter);
};

// Optimisation : Vérification d'équipe opérationnelle avec Set
const isOperationalTeam = (() => {
  const parentTeamCache = new Set<string>();
  
  return (team: Team, allTeams: Team[]) => {
    const cacheKey = team.id;
    if (parentTeamCache.has(cacheKey)) {
      return false;
    }
    
    const hasChild = allTeams.some((candidate) => candidate.parentTeamId === team.id);
    if (!hasChild) {
      parentTeamCache.add(cacheKey);
    }
    return !hasChild;
  };
})();

const getOperationalTeams = (
  teams: Team[],
  selectedRegion: string,
  matcher: (team: Team) => boolean
) => getTeamsForRegion(teams, selectedRegion, matcher).filter((team) => isOperationalTeam(team, teams));

// Optimisation : Calcul de capacité avec réduction
const sumOperationalTeamCapacity = (
  teams: Team[],
  selectedRegion: string,
  matcher: (team: Team) => boolean,
  fallbackRate: number
) => 
  getOperationalTeams(teams, selectedRegion, matcher)
    .reduce((sum, team) => sum + Math.max(Number(team.capacity) || 0, fallbackRate), 0);

// Optimisation : Version améliorée du calcul de taux effectif
const getEffectiveRatePerTeam = (
  teams: Team[] | undefined,
  selectedRegion: string,
  matcher: (team: Team) => boolean,
  fallbackRate: number
) => {
  const operationalTeams = getOperationalTeams(teams || [], selectedRegion, matcher)
    .filter((team) => Number(team.capacity) > 0);

  if (operationalTeams.length === 0) {
    return fallbackRate;
  }

  const totalCapacity = operationalTeams.reduce((sum, team) => 
    sum + Math.max(Number(team.capacity) || 0, 0), 0
  );
  
  const averageRate = totalCapacity / operationalTeams.length;
  return Math.max(1, averageRate);
};

// Optimisation : Version memoizée de getHouseholdPhase
export const getHouseholdPhase = memoize((household: Household): { phase: PlanningPhase; progress: number } => {
  const sync = household.koboSync;

  if (!sync) return { phase: 'LIVRAISON', progress: 0 };
  if (sync.controleOk) return { phase: 'TERMINE', progress: 100 };
  if (sync.interieurOk) return { phase: 'CONTROLE', progress: 80 };
  if (sync.reseauOk) return { phase: 'INTERIEUR', progress: 60 };
  if (sync.maconOk) return { phase: 'RESEAU', progress: 40 };
  if (hasHouseholdDeliveryEvidence(household)) return { phase: 'MACONNERIE', progress: 25 };

  return { phase: 'LIVRAISON', progress: 10 };
});

// Optimisation : Version simple de getEstimatedDuration
export const getEstimatedDuration = memoize((phase: PlanningPhase): number => {
  const durations = {
    PREPARATION: 3,
    LIVRAISON: 4,
    MACONNERIE: 5,
    RESEAU: 4,
    INTERIEUR: 3,
    CONTROLE: 2,
    TERMINE: 0,
  };
  return durations[phase] || 3;
});

// Optimisation : Version améliorée de getAvailablePlanningRegions
export const getAvailablePlanningRegions = memoize((households: Household[]) => {
  const regions = new Set<string>();
  households.forEach(household => {
    if (household.region) {
      regions.add(household.region);
    }
  });
  return Array.from(regions).sort();
});

// Optimisation : Version améliorée de computeTheoreticalNeeds
export function computeTheoreticalNeeds({
  households,
  teams,
  targetMonths,
  selectedRegion,
  productionRates,
  includeSaturday = false,
}: {
  households: Household[];
  teams?: Team[];
  targetMonths: number;
  selectedRegion: string;
  productionRates?: ProjectConfig['productionRates'];
  includeSaturday?: boolean;
}): TheoreticalNeeds | null {
  const cacheKey = getCacheKey('theoreticalNeeds', {
    householdsCount: households.length,
    targetMonths,
    selectedRegion,
    productionRates,
    includeSaturday
  });
  
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const total =
    selectedRegion === 'ALL'
      ? households.length
      : households.filter((household) => household.region === selectedRegion).length;

  if (total === 0 || targetMonths <= 0) {
    setCachedResult(cacheKey, null);
    return null;
  }

  const workDaysPerWeek = getPlanningWorkDaysPerWeek(includeSaturday);
  const workingDays = getPlanningWorkingDays(targetMonths, includeSaturday);
  const rates = productionRates || DEFAULT_PRODUCTION_RATES;
  
  const effectiveRates = {
    livraison: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team),
      rates.livraison || DEFAULT_PRODUCTION_RATES.livraison
    ),
    macons: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'macons',
      rates.macons || DEFAULT_PRODUCTION_RATES.macons
    ),
    reseau: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'reseau',
      rates.reseau || DEFAULT_PRODUCTION_RATES.reseau
    ),
    interieur: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'interieur_type1',
      rates.interieur_type1 || DEFAULT_PRODUCTION_RATES.interieur_type1
    ),
    controle: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'controle',
      rates.controle || DEFAULT_PRODUCTION_RATES.controle
    ),
  };

  const result = {
    livraison: Math.ceil(total / (workingDays * effectiveRates.livraison)),
    macons: Math.ceil(total / (workingDays * effectiveRates.macons)),
    reseau: Math.ceil(total / (workingDays * effectiveRates.reseau)),
    interieur: Math.ceil(total / (workingDays * effectiveRates.interieur)),
    controle: Math.ceil(total / (workingDays * effectiveRates.controle)),
    workingDays,
    workDaysPerWeek,
    effectiveRates,
  };

  setCachedResult(cacheKey, result);
  return result;
}

// Optimisation : Version améliorée de buildWorkflowStages
export function buildWorkflowStages({
  households,
  teams,
  projectConfig,
  targetMonths,
  selectedRegion,
  includeSaturday = false,
}: {
  households: Household[];
  teams: Team[];
  projectConfig?: ProjectConfig;
  targetMonths: number;
  selectedRegion: string;
  includeSaturday?: boolean;
}): WorkflowStage[] {
  const cacheKey = getCacheKey('workflowStages', {
    householdsCount: households.length,
    teamsCount: teams.length,
    targetMonths,
    selectedRegion,
    includeSaturday
  });
  
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const regionHouseholds =
    selectedRegion === 'ALL'
      ? households
      : households.filter((household) => household.region === selectedRegion);

  if (regionHouseholds.length === 0) {
    setCachedResult(cacheKey, []);
    return [];
  }

  const needs = computeTheoreticalNeeds({
    households,
    teams,
    targetMonths,
    selectedRegion,
    productionRates: projectConfig?.productionRates,
    includeSaturday,
  });

  if (!needs) {
    setCachedResult(cacheKey, []);
    return [];
  }

  const workDaysPerWeek = needs.workDaysPerWeek;
  const projectWorkingDays = getPlanningWorkingDays(targetMonths, includeSaturday);
  const rates = projectConfig?.productionRates || DEFAULT_PRODUCTION_RATES;
  const totalHouseholds = regionHouseholds.length;
  
  // Optimisation : Pré-filtrage des entrepôts
  const warehouses =
    selectedRegion === 'ALL'
      ? (projectConfig?.warehouses || []).filter((warehouse) => !warehouse.deletedAt)
      : (projectConfig?.warehouses || []).filter(
          (warehouse) =>
            !warehouse.deletedAt &&
            (warehouse.regionId === selectedRegion || warehouse.region === selectedRegion)
        );

  // Optimisation : Calcul parallèle des équipes par type
  const teamCalculations = {
    preparation: getOperationalTeams(teams, selectedRegion, isPreparationPlanningTeam),
    delivery: getOperationalTeams(
      teams,
      selectedRegion,
      (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team)
    ),
    masonry: getOperationalTeams(teams, selectedRegion, (team) => team.tradeKey === 'macons'),
    network: getOperationalTeams(teams, selectedRegion, (team) => team.tradeKey === 'reseau'),
    installation: getOperationalTeams(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'interieur_type1'
    ),
    controller: getOperationalTeams(teams, selectedRegion, (team) => team.tradeKey === 'controle'),
  };

  const teamCounts = {
    preparation: teamCalculations.preparation.length,
    delivery: teamCalculations.delivery.length,
    masonry: teamCalculations.masonry.length,
    network: teamCalculations.network.length,
    installation: teamCalculations.installation.length,
    controller: teamCalculations.controller.length,
  };

  // Optimisation : Comptage avec réduction
  const completedCounts = {
    delivered: regionHouseholds.filter(hasHouseholdDeliveryEvidence).length,
    masonry: regionHouseholds.filter((household) => !!household.koboSync?.maconOk).length,
    network: regionHouseholds.filter((household) => !!household.koboSync?.reseauOk).length,
    installation: regionHouseholds.filter((household) => !!household.koboSync?.interieurOk).length,
    control: regionHouseholds.filter((household) => !!household.koboSync?.controleOk).length,
  };

  const formationDailyCapacity = DEFAULT_FORMATION_TEAM_BATCH;

  // Optimisation : Calcul des capacités journalières
  const dailyCapacities = {
    delivery: sumOperationalTeamCapacity(
      teams,
      selectedRegion,
      (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team),
      rates.livraison || DEFAULT_PRODUCTION_RATES.livraison
    ),
    masonry: sumOperationalTeamCapacity(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'macons',
      rates.macons || DEFAULT_PRODUCTION_RATES.macons
    ),
    network: sumOperationalTeamCapacity(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'reseau',
      rates.reseau || DEFAULT_PRODUCTION_RATES.reseau
    ),
    installation: sumOperationalTeamCapacity(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'interieur_type1',
      rates.interieur_type1 || DEFAULT_PRODUCTION_RATES.interieur_type1
    ),
    control: sumOperationalTeamCapacity(
      teams,
      selectedRegion,
      (team) => team.tradeKey === 'controle',
      rates.controle || DEFAULT_PRODUCTION_RATES.controle
    ),
  };

  const workflowDefinitions = [
    {
      key: 'FORMATION' as const,
      label: 'Formation des électriciens',
      teamLabel: 'Équipes installation',
      progressLabel: 'équipes mobilisées',
      teamCount: teamCounts.installation,
      requiredTeams: needs.interieur,
      ratePerTeam: formationDailyCapacity,
      completedCount: Math.min(teamCounts.installation, Math.max(needs.interieur, 1)),
      details: `${warehouses.length} magasin(s) tampon · ${teamCounts.preparation} équipe(s) préparation`,
    },
    {
      key: 'LIVRAISON' as const,
      label: 'Livraison matériel ménages + magasin tampon',
      teamLabel: 'Équipes logistique / préparation',
      progressLabel: 'ménages livrés',
      teamCount: teamCounts.delivery,
      requiredTeams: needs.livraison,
      ratePerTeam:
        teamCounts.delivery > 0 ? Math.max(1, Math.round(dailyCapacities.delivery / teamCounts.delivery)) : rates.livraison || DEFAULT_PRODUCTION_RATES.livraison,
      completedCount: completedCounts.delivered,
      details: `${warehouses.length} magasin(s) tampon · ${teamCounts.preparation} équipe(s) préparation`,
    },
    {
      key: 'MACONNERIE' as const,
      label: 'Travaux de maçonnerie des murs',
      teamLabel: 'Équipes maçons',
      progressLabel: 'ménages maçonnés',
      teamCount: teamCounts.masonry,
      requiredTeams: needs.macons,
      ratePerTeam:
        teamCounts.masonry > 0
          ? Math.max(1, Math.round(dailyCapacities.masonry / teamCounts.masonry))
          : rates.macons || DEFAULT_PRODUCTION_RATES.macons,
      completedCount: completedCounts.masonry,
    },
    {
      key: 'RESEAU' as const,
      label: 'Travaux de réseau de branchement',
      teamLabel: 'Équipes réseau',
      progressLabel: 'ménages raccordés',
      teamCount: teamCounts.network,
      requiredTeams: needs.reseau,
      ratePerTeam:
        teamCounts.network > 0
          ? Math.max(1, Math.round(dailyCapacities.network / teamCounts.network))
          : rates.reseau || DEFAULT_PRODUCTION_RATES.reseau,
      completedCount: completedCounts.network,
    },
    {
      key: 'INSTALLATION' as const,
      label: "Travaux d'installation intérieure",
      teamLabel: 'Équipes installation',
      progressLabel: 'ménages installés',
      teamCount: teamCounts.installation,
      requiredTeams: needs.interieur,
      ratePerTeam:
        teamCounts.installation > 0
          ? Math.max(1, Math.round(dailyCapacities.installation / teamCounts.installation))
          : rates.interieur_type1 || DEFAULT_PRODUCTION_RATES.interieur_type1,
      completedCount: completedCounts.installation,
    },
    {
      key: 'CONTROLE' as const,
      label: 'Contrôle et validation finale',
      teamLabel: 'Équipes contrôle',
      progressLabel: 'ménages contrôlés',
      teamCount: teamCounts.controller,
      requiredTeams: needs.controle,
      ratePerTeam:
        teamCounts.controller > 0
          ? Math.max(1, Math.round(dailyCapacities.control / teamCounts.controller))
          : rates.controle || DEFAULT_PRODUCTION_RATES.controle,
      completedCount: completedCounts.control,
    },
  ];

  let cursor = 1;
  const result = workflowDefinitions.map((definition) => {
    const remainingHouseholds =
      definition.key === 'FORMATION'
        ? Math.max(definition.requiredTeams - definition.completedCount, 0)
        : Math.max(totalHouseholds - definition.completedCount, 0);

    const nominalDailyCapacity =
      definition.key === 'FORMATION'
        ? Math.max(definition.requiredTeams, 1) * formationDailyCapacity
        : definition.requiredTeams * definition.ratePerTeam;
    
    const actualDailyCapacity =
      definition.key === 'FORMATION'
        ? definition.teamCount * formationDailyCapacity
        : definition.key === 'LIVRAISON'
          ? dailyCapacities.delivery
          : definition.key === 'MACONNERIE'
            ? dailyCapacities.masonry
            : definition.key === 'RESEAU'
              ? dailyCapacities.network
              : definition.key === 'INSTALLATION'
                ? dailyCapacities.installation
                : dailyCapacities.control;

    const progress =
      definition.key === 'FORMATION'
        ? Math.min(
            100,
            Math.round((definition.completedCount / Math.max(definition.requiredTeams, 1)) * 100)
          )
        : Math.min(100, Math.round((definition.completedCount / Math.max(totalHouseholds, 1)) * 100));

    const workingDays =
      remainingHouseholds === 0
        ? 0
        : definition.key === 'FORMATION'
          ? DEFAULT_FORMATION_DAYS
          : nominalDailyCapacity > 0
            ? Math.ceil(remainingHouseholds / nominalDailyCapacity)
            : projectWorkingDays;
            
    const calendarDays = workingDays > 0 ? getCalendarDaysFromWorkingDays(workingDays, workDaysPerWeek) : 0;
    
    const projectedWorkingDays =
      remainingHouseholds === 0
        ? 0
        : definition.key === 'FORMATION'
          ? definition.teamCount > 0
            ? DEFAULT_FORMATION_DAYS
            : null
          : actualDailyCapacity > 0
            ? Math.ceil(remainingHouseholds / actualDailyCapacity)
            : null;
            
    const projectedCalendarDays =
      projectedWorkingDays === null
        ? null
        : projectedWorkingDays > 0
          ? getCalendarDaysFromWorkingDays(projectedWorkingDays, workDaysPerWeek)
          : 0;
          
    const startDay = workingDays > 0 ? cursor : cursor;
    const endDay = workingDays > 0 ? cursor + calendarDays - 1 : cursor;

    if (calendarDays > 0) {
      cursor = endDay + 1;
    }

    return {
      ...definition,
      dailyCapacity: actualDailyCapacity,
      projectCapacity: actualDailyCapacity * projectWorkingDays,
      householdsCount: totalHouseholds,
      remainingHouseholds,
      progress,
      workingDays,
      calendarDays,
      projectedWorkingDays,
      projectedCalendarDays,
      startDay,
      endDay,
      atRisk:
        definition.key === 'FORMATION'
          ? definition.teamCount < definition.requiredTeams
          : actualDailyCapacity <= 0 || definition.teamCount < definition.requiredTeams,
      isBlocked: remainingHouseholds > 0 && actualDailyCapacity <= 0,
    };
  });

  setCachedResult(cacheKey, result);
  return result;
}

// Nettoyage périodique du cache
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of calculationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      calculationCache.delete(key);
    }
  }
}, CACHE_TTL);

export {
  ALLOCATION_SOURCE_LABELS,
  PHASE_COLORS,
  PHASE_LABELS,
  buildPlanningAllocationPlan,
  buildPlanningTasks,
  buildTeamPlannings,
  buildPlanningStats,
  buildRegionalPlanningSummaries,
  filterPlanningTasks,
  filterVisibleTeamPlannings,
} from './planningDomain';
