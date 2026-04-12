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

export type OptimizationMode =
  | 'duration'
  | 'cost'
  | 'cashflow'
  | 'profit_max'
  | 'risk_averse'
  | 'quick_start'
  | 'low_logistics';

export type OptimizationOptions = {
  teamConfigs: Record<RoleKey, TeamConfig>;
  ROLE_CAPACITY: Record<RoleKey, number>;
  targetDuration: number;
  budgetLimitPercent: number;
  minMarginPercent: number;
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

// V2: Realistic pipeline schedule (parallel flow, not sequential)
// Controller spans entire project to inspect all phases.
function computePipelineSchedule(
  durations: Record<RoleKey, number>,
  unforeseenRate: number
): Record<RoleKey, RoleSchedule> {
  const delayFactor = Math.min(unforeseenRate / 100, 0.25);
  const maconDelay = Math.ceil(durations.macon * delayFactor * 0.2);
  const networkDelay = Math.ceil(durations.network * delayFactor * 0.2);
  const interiorDelay = Math.ceil(durations.interior * delayFactor * 0.2);

  const schedule: Record<RoleKey, RoleSchedule> = {
    macon: { start: 0, duration: durations.macon, end: durations.macon },
    network: { start: 0, duration: durations.network, end: 0 },
    interior: { start: 0, duration: durations.interior, end: 0 },
    controller: { start: 0, duration: durations.controller, end: 0 },
  };

  schedule.network.start = Math.floor(schedule.macon.duration * 0.3) + maconDelay;
  schedule.network.end = schedule.network.start + durations.network;

  schedule.interior.start =
    Math.floor(schedule.network.start + durations.network * 0.3) + networkDelay;
  schedule.interior.end = schedule.interior.start + durations.interior;

  const projectEnd = Math.max(schedule.macon.end, schedule.network.end, schedule.interior.end);
  schedule.controller.start = 0;
  schedule.controller.end = projectEnd + interiorDelay;
  schedule.controller.duration = schedule.controller.end;

  return schedule;
}

// V2: Realistic cashflow timeline (weekly simulation)
function computeCashflow({
  laborCost,
  logisticsCost,
  devisTotalPlanned,
  acompteRate,
  duration,
}: {
  laborCost: number;
  logisticsCost: number;
  devisTotalPlanned: number;
  acompteRate: number;
  duration: number;
}): {
  initialCash: number;
  minCash: number;
  hasRisk: boolean;
} {
  const acompte = devisTotalPlanned * (acompteRate / 100);
  const weeklyOutflow = (laborCost + logisticsCost) / Math.max(duration / 7, 1);

  let cash = acompte;
  let minCash = cash;

  const weeks = Math.ceil(duration / 7);
  for (let week = 1; week <= weeks; week++) {
    cash -= weeklyOutflow;

    // Milestone payments: 20% every 4 weeks and a mid-project top-up
    if (week % 4 === 0 && week < weeks) {
      cash += devisTotalPlanned * 0.2;
    }

    if (weeks >= 8 && week === Math.ceil(weeks / 2)) {
      cash += devisTotalPlanned * 0.1;
    }

    if (cash < minCash) minCash = cash;
  }

  return {
    initialCash: acompte,
    minCash,
    hasRisk: minCash < 0,
  };
}

// V2: Improved logistics with utilization factor
function computeLogisticsCostV2(
  teams: Record<RoleKey, TeamConfig>,
  duration: number,
  isHivernage: boolean
): number {
  const fuelPerDay = isHivernage ? 70000 : 60000;
  const utilization = 0.85; // realistic usage

  let total = 0;
  (Object.values(teams) as TeamConfig[]).forEach((team) => {
    total += team.count * team.vehiclesPerTeam * fuelPerDay * duration * utilization;
  });

  return total;
}

// V2: Main calculation with pipeline + cashflow
export function calculateScenarioV2(inputs: SimulationInputs): Scenario {
  const base = calculateScenario(inputs);

  // Improved pipeline schedule with unforeseen buffer
  const improvedSchedule = computePipelineSchedule(
    {
      macon: base.schedule.macon.duration,
      network: base.schedule.network.duration,
      interior: base.schedule.interior.duration,
      controller: base.schedule.controller.duration,
    },
    inputs.unforeseenRate
  );

  const newDuration = improvedSchedule.controller.end;
  const newCalendarDuration = getCalendarDays(
    newDuration,
    inputs.workDaysPerWeek,
    inputs.holidaysCount
  );

  const teamsLogisticsCost = computeLogisticsCostV2(
    inputs.teamConfigs,
    newDuration,
    inputs.isHivernage
  );
  const baseLogisticsCost = inputs.baseVehicleCount * 60000 * newCalendarDuration;
  const logisticsCost = teamsLogisticsCost + baseLogisticsCost;
  const materialsCost = inputs.devisTotalPlanned * 0.4;
  const totalCost = base.laborCost + logisticsCost + materialsCost;
  const margin = inputs.devisTotalPlanned - totalCost;

  // Realistic cashflow
  const cashflow = computeCashflow({
    laborCost: base.laborCost,
    logisticsCost,
    devisTotalPlanned: inputs.devisTotalPlanned,
    acompteRate: inputs.acompteRate,
    duration: newDuration,
  });

  return {
    ...base,
    duration: newDuration,
    calendarDuration: newCalendarDuration,
    schedule: improvedSchedule,
    cost: totalCost,
    margin,
    logisticsCost,
    initialCash: cashflow.initialCash,
    maxOutflow: Math.max(base.laborCost + logisticsCost, Math.abs(cashflow.minCash)),
    hasCashflowRisk: cashflow.hasRisk,
  };
}

function compareScenarios(
  a: Scenario,
  b: Scenario,
  mode: OptimizationMode,
  targetDuration: number,
  devisTotalPlanned: number,
  budgetLimitPercent: number,
  minMarginPercent: number
) {
  const budgetLimit = devisTotalPlanned * (budgetLimitPercent / 100);
  const minMarginThreshold = devisTotalPlanned * (minMarginPercent / 100);

  const budgetPenalty = (scenario: Scenario) =>
    scenario.cost > budgetLimit ? 5000000 + (scenario.cost - budgetLimit) * 0.1 : 0;
  const marginPenalty = (scenario: Scenario) =>
    scenario.margin < minMarginThreshold
      ? 5000000 + (minMarginThreshold - scenario.margin) * 0.1
      : 0;

  if (mode === 'duration') {
    if (a.calendarDuration !== b.calendarDuration) {
      return a.calendarDuration - b.calendarDuration;
    }
    const aPenalty = budgetPenalty(a) + marginPenalty(a);
    const bPenalty = budgetPenalty(b) + marginPenalty(b);
    if (aPenalty !== bPenalty) {
      return aPenalty - bPenalty;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cost') {
    const aPenalty = a.calendarDuration > targetDuration ? 100000000 : a.cost;
    const bPenalty = b.calendarDuration > targetDuration ? 100000000 : b.cost;
    const aBudgetPenalty = budgetPenalty(a);
    const bBudgetPenalty = budgetPenalty(b);
    if (aPenalty + aBudgetPenalty !== bPenalty + bBudgetPenalty) {
      return aPenalty + aBudgetPenalty - (bPenalty + bBudgetPenalty);
    }
    const aMarginPenalty = marginPenalty(a);
    const bMarginPenalty = marginPenalty(b);
    if (aMarginPenalty !== bMarginPenalty) {
      return aMarginPenalty - bMarginPenalty;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cashflow') {
    if (a.hasCashflowRisk !== b.hasCashflowRisk) {
      return a.hasCashflowRisk ? 1 : -1;
    }
    const aScore = a.cost + budgetPenalty(a) + marginPenalty(a);
    const bScore = b.cost + budgetPenalty(b) + marginPenalty(b);
    if (aScore !== bScore) {
      return aScore - bScore;
    }
    return b.margin - a.margin;
  }

  if (mode === 'profit_max') {
    const riskPenaltyA = a.hasCashflowRisk ? 7000000 : 0;
    const delayPenaltyA = a.calendarDuration > targetDuration ? 3000000 : 0;
    const scoreA = a.margin - riskPenaltyA - delayPenaltyA - budgetPenalty(a) - marginPenalty(a);

    const riskPenaltyB = b.hasCashflowRisk ? 7000000 : 0;
    const delayPenaltyB = b.calendarDuration > targetDuration ? 3000000 : 0;
    const scoreB = b.margin - riskPenaltyB - delayPenaltyB - budgetPenalty(b) - marginPenalty(b);

    return scoreB - scoreA;
  }

  if (mode === 'risk_averse') {
    if (a.hasCashflowRisk !== b.hasCashflowRisk) {
      return a.hasCashflowRisk ? 1 : -1;
    }
    const aPenalty = budgetPenalty(a) + marginPenalty(a);
    const bPenalty = budgetPenalty(b) + marginPenalty(b);
    if (aPenalty !== bPenalty) {
      return aPenalty - bPenalty;
    }
    return b.margin - a.margin;
  }

  if (mode === 'quick_start') {
    const startScoreA = a.schedule.network.start + a.schedule.interior.start * 1.2;
    const startScoreB = b.schedule.network.start + b.schedule.interior.start * 1.2;
    if (startScoreA !== startScoreB) {
      return startScoreA - startScoreB;
    }
    return a.calendarDuration - b.calendarDuration;
  }

  if (mode === 'low_logistics') {
    const aPenalty = budgetPenalty(a) + marginPenalty(a);
    const bPenalty = budgetPenalty(b) + marginPenalty(b);
    if (aPenalty !== bPenalty) {
      return aPenalty - bPenalty;
    }
    if (a.logisticsCost !== b.logisticsCost) {
      return a.logisticsCost - b.logisticsCost;
    }
    return b.margin - a.margin;
  }

  return b.margin - a.margin;
}

export function optimizeTeamConfigs(options: OptimizationOptions): Record<RoleKey, TeamConfig> {
  const {
    teamConfigs,
    targetDuration,
    budgetLimitPercent,
    minMarginPercent,
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

  let currentConfigs: Record<RoleKey, TeamConfig> = JSON.parse(JSON.stringify(teamConfigs));
  let bestScenario = calculateScenarioV2({
    householdsCount,
    devisTotalPlanned,
    projectConfig,
    teamConfigs: currentConfigs,
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

  let improved = true;
  let iteration = 0;
  const MAX_ITER = 50;
  const paymentModes: PaymentMode[] = ['task', 'day'];

  // Phase 1: Greedy optimization by bottleneck (30 iterations)
  while (improved && iteration < 30) {
    iteration++;
    improved = false;

    const bottleneck = bestScenario.bottleneck;
    const testConfigs = JSON.parse(JSON.stringify(currentConfigs));

    // Try increasing bottleneck
    testConfigs[bottleneck].count = Math.min(testConfigs[bottleneck].count + 1, 8);

    const scenario = calculateScenarioV2({
      householdsCount,
      devisTotalPlanned,
      projectConfig,
      teamConfigs: testConfigs,
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

    if (
      compareScenarios(
        scenario,
        bestScenario,
        mode,
        targetDuration,
        devisTotalPlanned,
        budgetLimitPercent,
        minMarginPercent
      ) < 0
    ) {
      currentConfigs = testConfigs;
      bestScenario = scenario;
      improved = true;
    }
  }

  // Phase 2: Payment mode optimization (20 iterations)
  const roles: RoleKey[] = ['macon', 'network', 'interior', 'controller'];
  improved = true;
  while (improved && iteration < MAX_ITER) {
    iteration++;
    improved = false;

    for (const role of roles) {
      const testConfigs = JSON.parse(JSON.stringify(currentConfigs));
      const currentMode = testConfigs[role].paymentMode;
      const newMode = currentMode === 'task' ? 'day' : 'task';
      testConfigs[role].paymentMode = newMode;

      const scenario = calculateScenarioV2({
        householdsCount,
        devisTotalPlanned,
        projectConfig,
        teamConfigs: testConfigs,
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

      if (
        compareScenarios(
          scenario,
          bestScenario,
          mode,
          targetDuration,
          devisTotalPlanned,
          budgetLimitPercent,
          minMarginPercent
        ) < 0
      ) {
        currentConfigs = testConfigs;
        bestScenario = scenario;
        improved = true;
        break; // Restart loop after improvement
      }
    }
  }

  return currentConfigs;
}
