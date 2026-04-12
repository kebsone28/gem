export type RoleKey = 'macon' | 'network' | 'interior' | 'controller';
export type PaymentMode = 'task' | 'day';

export type TeamConfig = {
  count: number;
  paymentMode: PaymentMode;
  rate: number;
  vehiclesPerTeam: number;
};

export type RoleSchedule = {
  start: number;
  end: number;
  duration: number;
};

export type Scenario = {
  duration: number;
  calendarDuration: number;
  schedule: Record<RoleKey, RoleSchedule>;
  bottleneck: RoleKey;
  capacity: number;
  cost: number;
  margin: number;
  laborCost: number;
  logisticsCost: number;
  initialCash: number;
  maxOutflow: number;
  hasCashflowRisk: boolean;
};

export type SimulationInputs = {
  householdsCount: number;
  devisTotalPlanned: number;
  projectConfig: any;
  teamConfigs: Record<RoleKey, TeamConfig>;
  baseVehicleCount: number;
  unforeseenRate: number;
  isHivernage: boolean;
  rejectRate: number;
  acompteRate: number;
  workDaysPerWeek: number;
  holidaysCount: number;
  hivernagePenaltyMacon: number;
  hivernagePenaltyNetwork: number;
};

export const ROLE_CAPACITY_DEFAULTS: Record<RoleKey, number> = {
  macon: 5,
  network: 8,
  interior: 6,
  controller: 15,
};

export function buildRoleCapacities(productionRates: any): Record<RoleKey, number> {
  return {
    macon: productionRates?.macons ?? ROLE_CAPACITY_DEFAULTS.macon,
    network: productionRates?.reseau ?? ROLE_CAPACITY_DEFAULTS.network,
    interior: productionRates?.interieur_type1 ?? ROLE_CAPACITY_DEFAULTS.interior,
    controller: productionRates?.controle ?? ROLE_CAPACITY_DEFAULTS.controller,
  };
}

export function getCalendarDays(
  workingDays: number,
  workDaysPerWeek: number,
  holidaysCount: number
) {
  const weeks = Math.floor(workingDays / workDaysPerWeek);
  const remainder = workingDays % workDaysPerWeek;
  return weeks * 7 + remainder + holidaysCount;
}

export function calculateScenario({
  householdsCount,
  devisTotalPlanned,
  projectConfig,
  teamConfigs,
  baseVehicleCount,
  unforeseenRate,
  isHivernage,
  rejectRate,
  acompteRate,
  workDaysPerWeek,
  holidaysCount,
  hivernagePenaltyMacon,
  hivernagePenaltyNetwork,
}: SimulationInputs): Scenario {
  const productionRates = projectConfig?.config?.productionRates;
  const ROLE_CAPACITY = buildRoleCapacities(productionRates);
  const factor = 1 + unforeseenRate / 100 + (isHivernage ? 0.05 : 0);

  const maconCap = ROLE_CAPACITY.macon * (isHivernage ? 1 - hivernagePenaltyMacon / 100 : 1);
  const networkCap = ROLE_CAPACITY.network * (isHivernage ? 1 - hivernagePenaltyNetwork / 100 : 1);
  const interiorCap = ROLE_CAPACITY.interior;
  const controllerCap = ROLE_CAPACITY.controller * (isHivernage ? 0.9 : 1);

  const capacities = {
    macon: teamConfigs.macon.count * maconCap,
    network: teamConfigs.network.count * networkCap,
    interior: teamConfigs.interior.count * interiorCap,
    controller: teamConfigs.controller.count * controllerCap,
  };

  const minDailyCapacity = Math.max(1, Math.min(...Object.values(capacities).filter((c) => c > 0)));
  const bottleneck = (Object.entries(capacities) as [RoleKey, number][])
    .filter(([, cap]) => cap > 0)
    .reduce((best, current) => (current[1] < best[1] ? current : best), [
      'macon',
      capacities.macon,
    ] as [RoleKey, number])[0];

  const baseHouseholds = householdsCount;
  const rejectHouseholds = Math.ceil(baseHouseholds * (rejectRate / 100));
  const totalNetworkHouseholds = baseHouseholds + rejectHouseholds;
  const totalInteriorHouseholds = baseHouseholds + rejectHouseholds;

  const durations = {
    macon: Math.max(1, Math.ceil((baseHouseholds / Math.max(capacities.macon, 1)) * factor)),
    network: Math.max(
      1,
      Math.ceil((totalNetworkHouseholds / Math.max(capacities.network, 1)) * factor)
    ),
    interior: Math.max(
      1,
      Math.ceil((totalInteriorHouseholds / Math.max(capacities.interior, 1)) * factor)
    ),
    controller: Math.max(
      1,
      Math.ceil((baseHouseholds / Math.max(capacities.controller, 1)) * factor)
    ),
  };

  const schedule: Record<RoleKey, RoleSchedule> = {
    macon: { start: 0, duration: durations.macon, end: durations.macon },
    network: { start: 0, duration: durations.network, end: 0 },
    interior: { start: 0, duration: durations.interior, end: 0 },
    controller: { start: 0, duration: durations.controller, end: 0 },
  };

  schedule.network.end = Math.max(
    schedule.macon.end + 1,
    schedule.macon.start + 1 + schedule.network.duration
  );
  schedule.network.start = schedule.network.end - schedule.network.duration;

  schedule.interior.end = Math.max(
    schedule.network.end + 1,
    schedule.network.start + 1 + schedule.interior.duration
  );
  schedule.interior.start = schedule.interior.end - schedule.interior.duration;

  schedule.controller.end = Math.max(
    schedule.interior.end + 1,
    schedule.interior.start + 1 + schedule.controller.duration
  );
  schedule.controller.start = schedule.controller.end - schedule.controller.duration;

  const globalDuration = schedule.controller.end;
  const globalCalendarDuration = getCalendarDays(globalDuration, workDaysPerWeek, holidaysCount);

  let laborCost = 0;
  let teamsLogisticsCost = 0;

  (Object.entries(teamConfigs) as [RoleKey, TeamConfig][]).forEach(([role, config]) => {
    const teamDuration = schedule[role].duration;
    const householdsTreated =
      role === 'network' || role === 'interior'
        ? baseHouseholds + rejectHouseholds
        : baseHouseholds;

    if (config.paymentMode === 'task') {
      laborCost += householdsTreated * config.rate;
    } else {
      laborCost += config.count * config.rate * teamDuration;
    }

    const teamCalendarDuration = getCalendarDays(teamDuration, workDaysPerWeek, holidaysCount);
    teamsLogisticsCost += config.count * config.vehiclesPerTeam * 60000 * teamCalendarDuration;
  });

  const baseLogisticsCost = baseVehicleCount * 60000 * globalCalendarDuration;
  const logisticsCost = teamsLogisticsCost + baseLogisticsCost;
  const materialsCost = devisTotalPlanned * 0.4;
  const totalCost = laborCost + logisticsCost + materialsCost;
  const margin = devisTotalPlanned - totalCost;
  const initialCash = devisTotalPlanned * (acompteRate / 100);
  const maxOutflow = laborCost + logisticsCost;
  const hasCashflowRisk = maxOutflow > initialCash;

  return {
    duration: globalDuration,
    calendarDuration: globalCalendarDuration,
    schedule,
    bottleneck,
    capacity: minDailyCapacity,
    cost: totalCost,
    margin,
    laborCost,
    logisticsCost,
    initialCash,
    maxOutflow,
    hasCashflowRisk,
  };
}

export type OptimizationMode = 'duration' | 'cost' | 'cashflow';

export type OptimizationOptions = {
  teamConfigs: Record<RoleKey, TeamConfig>;
  ROLE_CAPACITY: Record<RoleKey, number>;
  targetDuration: number;
  householdsCount: number;
  devisTotalPlanned: number;
  workDaysPerWeek: number;
  holidaysCount: number;
  projectConfig: any;
  baseVehicleCount: number;
  unforeseenRate: number;
  isHivernage: boolean;
  rejectRate: number;
  acompteRate: number;
  hivernagePenaltyMacon: number;
  hivernagePenaltyNetwork: number;
  mode: OptimizationMode;
};

function compareScenarios(
  a: Scenario,
  b: Scenario,
  mode: OptimizationMode,
  targetDuration: number
) {
  if (mode === 'duration') {
    if (a.calendarDuration !== b.calendarDuration) {
      return a.calendarDuration - b.calendarDuration;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cost') {
    const aPenalty = a.calendarDuration > targetDuration ? 100000000 : a.cost;
    const bPenalty = b.calendarDuration > targetDuration ? 100000000 : b.cost;
    if (aPenalty !== bPenalty) {
      return aPenalty - bPenalty;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cashflow') {
    if (a.hasCashflowRisk !== b.hasCashflowRisk) {
      return a.hasCashflowRisk ? 1 : -1;
    }
    return b.margin - a.margin;
  }

  return b.margin - a.margin;
}

export function optimizeTeamConfigs(options: OptimizationOptions): Record<RoleKey, TeamConfig> {
  const {
    teamConfigs,
    ROLE_CAPACITY,
    targetDuration,
    householdsCount,
    devisTotalPlanned,
    workDaysPerWeek,
    holidaysCount,
    projectConfig,
    baseVehicleCount,
    unforeseenRate,
    isHivernage,
    rejectRate,
    acompteRate,
    hivernagePenaltyMacon,
    hivernagePenaltyNetwork,
    mode,
  } = options;

  const maxCount = 8;
  let bestScenario: Scenario | null = null;
  let bestConfigs: Record<RoleKey, TeamConfig> = { ...teamConfigs };

  for (let macon = 1; macon <= maxCount; macon += 1) {
    for (let network = 1; network <= maxCount; network += 1) {
      for (let interior = 1; interior <= maxCount; interior += 1) {
        for (let controller = 1; controller <= maxCount; controller += 1) {
          const candidateConfigs: Record<RoleKey, TeamConfig> = {
            macon: { ...teamConfigs.macon, count: macon },
            network: { ...teamConfigs.network, count: network },
            interior: { ...teamConfigs.interior, count: interior },
            controller: { ...teamConfigs.controller, count: controller },
          };

          const scenario = calculateScenario({
            householdsCount,
            devisTotalPlanned,
            projectConfig,
            teamConfigs: candidateConfigs,
            baseVehicleCount,
            unforeseenRate,
            isHivernage,
            rejectRate,
            acompteRate,
            workDaysPerWeek,
            holidaysCount,
            hivernagePenaltyMacon,
            hivernagePenaltyNetwork,
          });

          if (!bestScenario || compareScenarios(scenario, bestScenario, mode, targetDuration) < 0) {
            bestScenario = scenario;
            bestConfigs = candidateConfigs;
          }
        }
      }
    }
  }

  return bestConfigs;
}
