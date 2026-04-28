import { addDays, differenceInDays } from 'date-fns';
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

export const ALLOCATION_SOURCE_LABELS: Record<NonNullable<PlanningTask['allocationSource']>, string> = {
  manual: 'Force',
  configured: 'Config region',
  balanced: 'Equilibre',
  unassigned: 'Sans equipe',
};

export const PHASE_COLORS: Record<PlanningPhase, string> = {
  PREPARATION: 'bg-slate-500',
  LIVRAISON: 'bg-cyan-500',
  MACONNERIE: 'bg-amber-500',
  RESEAU: 'bg-blue-500',
  INTERIEUR: 'bg-purple-500',
  CONTROLE: 'bg-emerald-500',
  TERMINE: 'bg-emerald-600',
};

export const PHASE_LABELS: Record<PlanningPhase, string> = {
  PREPARATION: 'Preparation',
  LIVRAISON: 'Livraison',
  MACONNERIE: 'Maconnerie',
  RESEAU: 'Reseau',
  INTERIEUR: 'Installation',
  CONTROLE: 'Controle',
  TERMINE: 'Termine',
};

const DEFAULT_PRODUCTION_RATES = {
  livraison: 12,
  macons: 5,
  reseau: 8,
  interieur_type1: 6,
  controle: 15,
} satisfies Record<string, number>;

const DEFAULT_FORMATION_DAYS = 3;
const DEFAULT_FORMATION_TEAM_BATCH = 2;

const normalizedDeliveryStatuses = ['livre', 'livree', 'livraison effectuee', 'delivered'];

const includesNormalizedStatus = (value: string | undefined, candidates: string[]) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (!normalized) return false;
  return candidates.some((candidate) => normalized.includes(candidate));
};

export const hasHouseholdDeliveryEvidence = (household: Household) =>
  !!household.koboSync?.livreurDate ||
  !!household.delivery?.date ||
  includesNormalizedStatus(household.deliveryStatus, normalizedDeliveryStatuses);

export const getPlanningWorkDaysPerWeek = (includeSaturday: boolean) => (includeSaturday ? 6 : 5);

export const getPlanningWorkingDays = (targetMonths: number, includeSaturday: boolean) =>
  targetMonths * (includeSaturday ? 26 : 22);

const getCalendarDaysFromWorkingDays = (workingDays: number, workDaysPerWeek: number) => {
  const weeks = Math.floor(workingDays / workDaysPerWeek);
  const remainder = workingDays % workDaysPerWeek;
  return weeks * 7 + remainder;
};

const getTeamsForRegion = (teams: Team[], selectedRegion: string, matcher: (team: Team) => boolean) =>
  teams.filter((team) => {
    if (!matcher(team)) return false;
    if (selectedRegion === 'ALL') return true;
    return teamMatchesPlanningRegion(team, selectedRegion);
  });

const isOperationalTeam = (team: Team, allTeams: Team[]) =>
  !allTeams.some((candidate) => candidate.parentTeamId === team.id);

const getOperationalTeams = (
  teams: Team[],
  selectedRegion: string,
  matcher: (team: Team) => boolean
) => getTeamsForRegion(teams, selectedRegion, matcher).filter((team) => isOperationalTeam(team, teams));

const sumOperationalTeamCapacity = (
  teams: Team[],
  selectedRegion: string,
  matcher: (team: Team) => boolean,
  fallbackRate: number
) =>
  getOperationalTeams(teams, selectedRegion, matcher).reduce(
    (sum, team) => sum + Math.max(Number(team.capacity) || 0, fallbackRate),
    0
  );

const getEffectiveRatePerTeam = (
  teams: Team[] | undefined,
  selectedRegion: string,
  matcher: (team: Team) => boolean,
  fallbackRate: number
) => {
  const operationalTeams = getOperationalTeams(teams || [], selectedRegion, matcher).filter(
    (team) => Number(team.capacity) > 0
  );

  if (operationalTeams.length === 0) {
    return fallbackRate;
  }

  const averageRate =
    operationalTeams.reduce((sum, team) => sum + Math.max(Number(team.capacity) || 0, 0), 0) /
    operationalTeams.length;

  return Math.max(1, averageRate);
};

export function getHouseholdPhase(household: Household): { phase: PlanningPhase; progress: number } {
  const sync = household.koboSync;

  if (!sync) return { phase: 'LIVRAISON', progress: 0 };
  if (sync.controleOk) return { phase: 'TERMINE', progress: 100 };
  if (sync.interieurOk) return { phase: 'CONTROLE', progress: 80 };
  if (sync.reseauOk) return { phase: 'INTERIEUR', progress: 60 };
  if (sync.maconOk) return { phase: 'RESEAU', progress: 40 };
  if (hasHouseholdDeliveryEvidence(household)) return { phase: 'MACONNERIE', progress: 25 };

  return { phase: 'LIVRAISON', progress: 10 };
}

export function getEstimatedDuration(phase: PlanningPhase): number {
  switch (phase) {
    case 'PREPARATION':
      return 3;
    case 'LIVRAISON':
      return 4;
    case 'MACONNERIE':
      return 5;
    case 'RESEAU':
      return 4;
    case 'INTERIEUR':
      return 3;
    case 'CONTROLE':
      return 2;
    case 'TERMINE':
      return 0;
    default:
      return 3;
  }
}

export function getAvailablePlanningRegions(households: Household[]) {
  return Array.from(new Set(households.map((household) => household.region).filter(Boolean))).sort();
}

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
  const total =
    selectedRegion === 'ALL'
      ? households.length
      : households.filter((household) => household.region === selectedRegion).length;

  if (total === 0 || targetMonths <= 0) return null;

  const workDaysPerWeek = getPlanningWorkDaysPerWeek(includeSaturday);
  const workingDays = getPlanningWorkingDays(targetMonths, includeSaturday);
  const rates = productionRates || DEFAULT_PRODUCTION_RATES;
  const effectiveRates = {
    livraison: getEffectiveRatePerTeam(
      teams,
      selectedRegion,
      (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team),
      (rates as Record<string, number>).livraison || DEFAULT_PRODUCTION_RATES.livraison
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

  return {
    livraison: Math.ceil(
      total / (workingDays * effectiveRates.livraison)
    ),
    macons: Math.ceil(total / (workingDays * effectiveRates.macons)),
    reseau: Math.ceil(total / (workingDays * effectiveRates.reseau)),
    interieur: Math.ceil(total / (workingDays * effectiveRates.interieur)),
    controle: Math.ceil(total / (workingDays * effectiveRates.controle)),
    workingDays,
    workDaysPerWeek,
    effectiveRates,
  };
}

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
  const regionHouseholds =
    selectedRegion === 'ALL'
      ? households
      : households.filter((household) => household.region === selectedRegion);

  if (regionHouseholds.length === 0) return [];

  const needs = computeTheoreticalNeeds({
    households,
    teams,
    targetMonths,
    selectedRegion,
    productionRates: projectConfig?.productionRates,
    includeSaturday,
  });

  if (!needs) return [];

  const workDaysPerWeek = needs.workDaysPerWeek;
  const projectWorkingDays = getPlanningWorkingDays(targetMonths, includeSaturday);
  const rates = projectConfig?.productionRates || DEFAULT_PRODUCTION_RATES;
  const totalHouseholds = regionHouseholds.length;
  const warehouses =
    selectedRegion === 'ALL'
      ? (projectConfig?.warehouses || []).filter((warehouse) => !warehouse.deletedAt)
      : (projectConfig?.warehouses || []).filter(
          (warehouse) =>
            !warehouse.deletedAt &&
            (warehouse.regionId === selectedRegion || warehouse.region === selectedRegion)
        );

  const preparationTeamList = getOperationalTeams(teams, selectedRegion, isPreparationPlanningTeam);
  const deliveryTeamList = getOperationalTeams(
    teams,
    selectedRegion,
    (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team)
  );
  const masonryTeamList = getOperationalTeams(teams, selectedRegion, (team) => team.tradeKey === 'macons');
  const networkTeamList = getOperationalTeams(teams, selectedRegion, (team) => team.tradeKey === 'reseau');
  const installationTeamList = getOperationalTeams(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'interieur_type1'
  );
  const controllerTeamList = getOperationalTeams(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'controle'
  );

  const preparationTeams = preparationTeamList.length;
  const deliveryTeams = deliveryTeamList.length;
  const masonryTeams = masonryTeamList.length;
  const networkTeams = networkTeamList.length;
  const installationTeams = installationTeamList.length;
  const controllerTeams = controllerTeamList.length;

  const deliveredCount = regionHouseholds.filter(hasHouseholdDeliveryEvidence).length;
  const masonryCount = regionHouseholds.filter((household) => !!household.koboSync?.maconOk).length;
  const networkCount = regionHouseholds.filter((household) => !!household.koboSync?.reseauOk).length;
  const installationCount = regionHouseholds.filter((household) => !!household.koboSync?.interieurOk).length;
  const controlCount = regionHouseholds.filter((household) => !!household.koboSync?.controleOk).length;

  const formationDailyCapacity = DEFAULT_FORMATION_TEAM_BATCH;

  const deliveryFallbackRate =
    (rates as Record<string, number>).livraison || DEFAULT_PRODUCTION_RATES.livraison;
  const deliveryDailyCapacity = sumOperationalTeamCapacity(
    teams,
    selectedRegion,
    (team) => isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team),
    deliveryFallbackRate
  );
  const masonryDailyCapacity = sumOperationalTeamCapacity(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'macons',
    rates.macons || DEFAULT_PRODUCTION_RATES.macons
  );
  const networkDailyCapacity = sumOperationalTeamCapacity(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'reseau',
    rates.reseau || DEFAULT_PRODUCTION_RATES.reseau
  );
  const installationDailyCapacity = sumOperationalTeamCapacity(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'interieur_type1',
    rates.interieur_type1 || DEFAULT_PRODUCTION_RATES.interieur_type1
  );
  const controlDailyCapacity = sumOperationalTeamCapacity(
    teams,
    selectedRegion,
    (team) => team.tradeKey === 'controle',
    rates.controle || DEFAULT_PRODUCTION_RATES.controle
  );

  const workflowDefinitions = [
    {
      key: 'FORMATION' as const,
      label: 'Formation des électriciens',
      teamLabel: 'Équipes installation',
      progressLabel: 'équipes mobilisées',
      teamCount: installationTeams,
      requiredTeams: needs.interieur,
      ratePerTeam: formationDailyCapacity,
      completedCount: Math.min(installationTeams, Math.max(needs.interieur, 1)),
      details: `${warehouses.length} magasin(s) tampon · ${preparationTeams} équipe(s) préparation`,
    },
    {
      key: 'LIVRAISON' as const,
      label: 'Livraison matériel ménages + magasin tampon',
      teamLabel: 'Équipes logistique / préparation',
      progressLabel: 'ménages livrés',
      teamCount: deliveryTeams,
      requiredTeams: needs.livraison,
      ratePerTeam:
        deliveryTeams > 0 ? Math.max(1, Math.round(deliveryDailyCapacity / deliveryTeams)) : deliveryFallbackRate,
      completedCount: deliveredCount,
      details: `${warehouses.length} magasin(s) tampon · ${preparationTeams} équipe(s) préparation`,
    },
    {
      key: 'MACONNERIE' as const,
      label: 'Travaux de maçonnerie des murs',
      teamLabel: 'Équipes maçons',
      progressLabel: 'ménages maçonnés',
      teamCount: masonryTeams,
      requiredTeams: needs.macons,
      ratePerTeam:
        masonryTeams > 0
          ? Math.max(1, Math.round(masonryDailyCapacity / masonryTeams))
          : rates.macons || DEFAULT_PRODUCTION_RATES.macons,
      completedCount: masonryCount,
    },
    {
      key: 'RESEAU' as const,
      label: 'Travaux de réseau de branchement',
      teamLabel: 'Équipes réseau',
      progressLabel: 'ménages raccordés',
      teamCount: networkTeams,
      requiredTeams: needs.reseau,
      ratePerTeam:
        networkTeams > 0
          ? Math.max(1, Math.round(networkDailyCapacity / networkTeams))
          : rates.reseau || DEFAULT_PRODUCTION_RATES.reseau,
      completedCount: networkCount,
    },
    {
      key: 'INSTALLATION' as const,
      label: "Travaux d'installation intérieure",
      teamLabel: 'Équipes installation',
      progressLabel: 'ménages installés',
      teamCount: installationTeams,
      requiredTeams: needs.interieur,
      ratePerTeam:
        installationTeams > 0
          ? Math.max(1, Math.round(installationDailyCapacity / installationTeams))
          : rates.interieur_type1 || DEFAULT_PRODUCTION_RATES.interieur_type1,
      completedCount: installationCount,
    },
    {
      key: 'CONTROLE' as const,
      label: 'Contrôle et validation finale',
      teamLabel: 'Équipes contrôle',
      progressLabel: 'ménages contrôlés',
      teamCount: controllerTeams,
      requiredTeams: needs.controle,
      ratePerTeam:
        controllerTeams > 0
          ? Math.max(1, Math.round(controlDailyCapacity / controllerTeams))
          : rates.controle || DEFAULT_PRODUCTION_RATES.controle,
      completedCount: controlCount,
    },
  ];

  let cursor = 1;

  return workflowDefinitions.map((definition) => {
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
          ? deliveryDailyCapacity
          : definition.key === 'MACONNERIE'
            ? masonryDailyCapacity
            : definition.key === 'RESEAU'
              ? networkDailyCapacity
              : definition.key === 'INSTALLATION'
                ? installationDailyCapacity
                : controlDailyCapacity;

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
}

export function buildPlanningAllocationPlan({
  households,
  teams,
  projectConfig,
}: {
  households: PlanningHousehold[];
  teams: Team[];
  projectConfig?: ProjectConfig;
}) {
  const loadByTeamId = new Map<string, number>();
  const sortedHouseholds = [...households].sort((a, b) => {
    const regionCompare = (a.region || '').localeCompare(b.region || '', 'fr');
    if (regionCompare !== 0) return regionCompare;

    const villageCompare = (a.village || '').localeCompare(b.village || '', 'fr');
    if (villageCompare !== 0) return villageCompare;

    const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdAtA !== createdAtB) return createdAtA - createdAtB;

    return a.id.localeCompare(b.id);
  });

  const decisions = new Map<string, { team?: Team; source: PlanningAllocationSource }>();

  for (const household of sortedHouseholds) {
    const { phase } = getHouseholdPhase(household);
    const decision = recommendTeamForPlanningTask({
      phase,
      regionName: household.region,
      teams,
      projectConfig,
      manualTeamId: household.assignedTeamId,
      currentLoadByTeamId: loadByTeamId,
    });

    decisions.set(household.id, decision);
    if (decision.team) {
      loadByTeamId.set(decision.team.id, (loadByTeamId.get(decision.team.id) || 0) + 1);
    }
  }

  return decisions;
}

export function buildPlanningTasks({
  households,
  allocationPlanByHousehold,
  now = new Date(),
}: {
  households: PlanningHousehold[];
  allocationPlanByHousehold: Map<string, { team?: Team; source: PlanningAllocationSource }>;
  now?: Date;
}): PlanningTask[] {
  return households.map((household) => {
    const { phase, progress } = getHouseholdPhase(household);
    const estimatedDuration = getEstimatedDuration(phase);
    const createdAt = household.createdAt ? new Date(household.createdAt) : now;
    const daysElapsed = differenceInDays(now, createdAt);
    const expectedProgress = Math.min((daysElapsed / Math.max(estimatedDuration * 5, 1)) * 100, 100);
    const isDelayed = progress < expectedProgress && phase !== 'TERMINE';
    const delayDays = isDelayed ? Math.floor(expectedProgress - progress) : 0;

    const allocationDecision = allocationPlanByHousehold.get(household.id);
    const assignedTeam = allocationDecision?.team;

    return {
      id: household.id,
      householdId: household.id,
      householdName: household.name || 'Inconnu',
      lotNumber: household.numeroordre || '-',
      village: household.village || '-',
      region: household.region || '-',
      phase,
      phaseProgress: progress,
      teamId: assignedTeam?.id,
      existingAlerts: household.alerts || [],
      teamName: assignedTeam?.name,
      allocationSource: allocationDecision?.source || 'unassigned',
      startDate: createdAt,
      endDate: addDays(createdAt, estimatedDuration),
      plannedDuration: estimatedDuration,
      isDelayed,
      delayDays,
    };
  });
}

export function buildTeamPlannings(tasks: PlanningTask[], teams: Team[]): TeamPlanning[] {
  const teamMap = new Map<string, TeamPlanning>();

  teamMap.set('UNASSIGNED', {
    team: {
      id: 'UNASSIGNED',
      name: 'Non assignés',
      projectId: '',
      organizationId: '',
      level: 0,
      role: 'INSTALLATION',
      capacity: 0,
      status: 'active',
    } as Team,
    tasks: [],
    utilization: 0,
    status: 'available',
  });

  teams.forEach((team) => {
    teamMap.set(team.id, {
      team,
      tasks: [],
      utilization: 0,
      status: 'available',
    });
  });

  tasks.forEach((task) => {
    if (task.teamId && teamMap.has(task.teamId)) {
      teamMap.get(task.teamId)?.tasks.push(task);
      return;
    }

    teamMap.get('UNASSIGNED')?.tasks.push(task);
  });

  teamMap.forEach((teamPlanning, teamId) => {
    if (teamId === 'UNASSIGNED') return;

    const activeTasks = teamPlanning.tasks.filter((task) => task.phase !== 'TERMINE').length;
    const utilization = Math.min((activeTasks / Math.max(teamPlanning.team.capacity || 1, 1)) * 100, 150);

    teamPlanning.utilization = utilization;
    teamPlanning.status = utilization > 100 ? 'overloaded' : utilization > 70 ? 'busy' : 'available';
  });

  return Array.from(teamMap.values()).filter(
    (teamPlanning) => teamPlanning.tasks.length > 0 || teamPlanning.team.id === 'UNASSIGNED'
  );
}

export function buildPlanningStats(tasks: PlanningTask[], selectedRegion: string) {
  const relevantTasks =
    selectedRegion === 'ALL' ? tasks : tasks.filter((task) => task.region === selectedRegion);

  const byPhase = relevantTasks.reduce(
    (accumulator, task) => {
      accumulator[task.phase] = (accumulator[task.phase] || 0) + 1;
      return accumulator;
    },
    {} as Record<string, number>
  );

  return {
    total: relevantTasks.length,
    byPhase,
    delayed: relevantTasks.filter((task) => task.isDelayed).length,
    completed: byPhase.TERMINE || 0,
  };
}

export function buildRegionalPlanningSummaries({
  availableRegions,
  households,
  tasks,
  teams,
}: {
  availableRegions: string[];
  households: Household[];
  tasks: PlanningTask[];
  teams: Team[];
}): RegionalPlanningSummary[] {
  return availableRegions.map((region) => {
    const householdsInRegion = households.filter((household) => household.region === region);
    const tasksInRegion = tasks.filter((task) => task.region === region);
    const teamsAssigned: Record<string, number> = {};

    teams.forEach((team) => {
      if (!teamMatchesPlanningRegion(team, region)) return;
      teamsAssigned[team.tradeKey || team.role || 'unknown'] =
        (teamsAssigned[team.tradeKey || team.role || 'unknown'] || 0) + 1;
    });

    return {
      region,
      totalHouseholds: householdsInRegion.length,
      delayedHouseholds: tasksInRegion.filter((task) => task.isDelayed).length,
      teamsAssigned,
    };
  });
}

export function filterPlanningTasks({
  tasks,
  selectedRegion,
  phaseFilter,
  selectedTeam,
  selectedTrade,
}: {
  tasks: PlanningTask[];
  selectedRegion: string;
  phaseFilter: PhaseFilter;
  selectedTeam: string;
  selectedTrade: string;
}) {
  return tasks.filter((task) => {
    if (selectedRegion !== 'ALL' && task.region !== selectedRegion) return false;
    if (phaseFilter !== 'ALL' && task.phase !== phaseFilter) return false;
    if (selectedTeam !== 'ALL' && task.teamId !== selectedTeam) return false;
    if (selectedTrade !== 'ALL' && PHASE_TRADE_KEYS[task.phase] !== selectedTrade) return false;
    return true;
  });
}

export function filterVisibleTeamPlannings(teamPlannings: TeamPlanning[], selectedTrade: string) {
  return teamPlannings.filter((teamPlanning) => {
    if (teamPlanning.team.id === 'UNASSIGNED') {
      return teamPlanning.tasks.length > 0 && selectedTrade === 'ALL';
    }
    if (selectedTrade !== 'ALL' && teamPlanning.team.tradeKey !== selectedTrade) return false;
    return true;
  });
}
