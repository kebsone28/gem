/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

export type ScenarioBase = {
  duration: number;
  calendarDuration: number;
  schedule: Record<RoleKey, RoleSchedule>;
  goulotDetroits: RoleKey;
  capacity: number;
  cost: number;
  margin: number;
  laborCost: number;
  logisticsCost: number;
};

export type Scenario = ScenarioBase & {
  // Nouvelles propriétés pour le planning
  dateDemarrageInitiale: Date;
  planningDetaille: Record<RoleKey, PlanningEquipe>;
  dateFinGlobale: Date;
  tresorerieInitiale: number;
  depenseMax: number;
  aRisqueTresorerie: boolean;
};

export type PlanningEquipe = {
  role: RoleKey;
  dateDebut: Date;
  dateFin: Date;
  dureeJours: number;
  dureeCalendrier: number;
  equipesAllouees: number;
  capaciteJournaliere: number;
  taches: string[];
};

export type SimulationInputs = {
  householdsCount: number;
  devisTotalPlanned: number;
  projectConfig: any;
  teamConfigs: Record<RoleKey, TeamConfig>;
  baseVehicleCount: number;
  tauxImprevu: number;
  isHivernage: boolean;
  tauxRejet: number;
  tauxAcompte: number;
  workDaysPerWeek: number;
  holidaysCount: number;
  penaliteHivernageMacon: number;
  penaliteHivernageReseau: number;
  dateDemarrageInitiale?: Date;
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
  tauxImprevu,
  isHivernage,
  tauxRejet,
  tauxAcompte,
  workDaysPerWeek,
  holidaysCount,
  penaliteHivernageMacon,
  penaliteHivernageReseau,
}: SimulationInputs): ScenarioBase {
  const safeHouseholds = Math.max(0, householdsCount || 0);
  const safeDevis = Math.max(0, devisTotalPlanned || 0);
  const ROLE_CAPACITY = buildRoleCapacities(projectConfig?.config?.productionRates);
  const factor = 1 + (tauxImprevu || 0) / 100 + (isHivernage ? 0.05 : 0);

  const maconCap = ROLE_CAPACITY.macon * (isHivernage ? 1 - penaliteHivernageMacon / 100 : 1);
  const networkCap = ROLE_CAPACITY.network * (isHivernage ? 1 - penaliteHivernageReseau / 100 : 1);
  const interiorCap = ROLE_CAPACITY.interior;
  const controllerCap = ROLE_CAPACITY.controller * (isHivernage ? 0.9 : 1);

  const capacities = {
    macon: teamConfigs.macon.count * maconCap,
    network: teamConfigs.network.count * networkCap,
    interior: teamConfigs.interior.count * interiorCap,
    controller: teamConfigs.controller.count * controllerCap,
  };

  const minDailyCapacity = Math.max(1, Math.min(...Object.values(capacities).filter((c) => c > 0)));
  const goulotDetroits = (Object.entries(capacities) as [RoleKey, number][])
    .filter(([, cap]) => cap > 0)
    .reduce((best, current) => (current[1] < best[1] ? current : best), [
      'macon',
      capacities.macon,
    ] as [RoleKey, number])[0];

  const baseHouseholds = safeHouseholds;
  const menagesRejetes = Math.ceil(baseHouseholds * ((tauxRejet || 0) / 100));
  const totalNetworkHouseholds = baseHouseholds + menagesRejetes;
  const totalInteriorHouseholds = baseHouseholds + menagesRejetes;

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
      role === 'network' || role === 'interior' ? baseHouseholds + menagesRejetes : baseHouseholds;

    if (config.paymentMode === 'task') {
      laborCost += householdsTreated * config.rate;
    } else {
      laborCost += config.count * config.rate * teamDuration;
    }

    const teamCalendarDuration = getCalendarDays(teamDuration, workDaysPerWeek, holidaysCount);
    teamsLogisticsCost += config.count * config.vehiclesPerTeam * 60000 * teamCalendarDuration;
  });

  const baseLogisticsCost = (baseVehicleCount || 0) * 60000 * globalCalendarDuration;
  const logisticsCost = teamsLogisticsCost + baseLogisticsCost;
  const materialsCost = safeDevis * 0.4;
  const totalCost = laborCost + logisticsCost + materialsCost;
  const margin = safeDevis - totalCost;
  const tresorerieInitiale = devisTotalPlanned * (tauxAcompte / 100);
  const depenseMax = laborCost + logisticsCost;
  const aRisqueTresorerie = depenseMax > tresorerieInitiale;

  return {
    duration: globalDuration,
    calendarDuration: globalCalendarDuration,
    schedule,
    goulotDetroits: goulotDetroits,
    capacity: minDailyCapacity,
    cost: totalCost,
    margin,
    laborCost,
    logisticsCost,
  };
}

export type ModeOptimisation =
  | 'duration'
  | 'cost'
  | 'cashflow'
  | 'profit_max'
  | 'risk_averse'
  | 'quick_start'
  | 'low_logistics';

export type OptionsOptimisation = {
  teamConfigs: Record<RoleKey, TeamConfig>;
  ROLE_CAPACITY: Record<RoleKey, number>;
  dureeCible: number;
  limiteBudgetPourcent: number;
  margeMinimalePourcent: number;
  householdsCount: number;
  devisTotalPlanned: number;
  workDaysPerWeek: number;
  holidaysCount: number;
  projectConfig: any;
  baseVehicleCount: number;
  tauxImprevu: number;
  isHivernage: boolean;
  tauxRejet: number;
  tauxAcompte: number;
  penaliteHivernageMacon: number;
  penaliteHivernageReseau: number;
  mode: ModeOptimisation;
  dateDemarrageInitiale?: Date;
};

// V2: Realistic pipeline schedule (parallel flow, not sequential)
// Controller spans entire project to inspect all phases.
function calculerCalendrierPipeline(
  durations: Record<RoleKey, number>,
  tauxImprevu: number
): Record<RoleKey, RoleSchedule> {
  const delayFactor = Math.min(tauxImprevu / 100, 0.25);
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
function calculerTresorerie({
  laborCost,
  logisticsCost,
  devisTotalPlanned,
  tauxAcompte,
  duration,
}: {
  laborCost: number;
  logisticsCost: number;
  devisTotalPlanned: number;
  tauxAcompte: number;
  duration: number;
}): {
  initialCash: number;
  minCash: number;
  hasRisk: boolean;
} {
  const acompte = devisTotalPlanned * (tauxAcompte / 100);
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

function genererPlanningDetaille(
  schedule: Record<RoleKey, RoleSchedule>,
  dateDemarrageInitiale: Date,
  workDaysPerWeek: number,
  holidaysCount: number,
  teamConfigs: Record<RoleKey, TeamConfig>,
  projectConfig: any
): { planningDetaille: Record<RoleKey, PlanningEquipe>; dateFinGlobale: Date } {
  const planningDetaille: Record<RoleKey, PlanningEquipe> = {} as Record<RoleKey, PlanningEquipe>;
  let dateFinGlobale = new Date(dateDemarrageInitiale);

  // Descriptions des tâches par rôle
  const descriptionsTaches: Record<RoleKey, string[]> = {
    macon: [
      'Préparation du terrain et fondations',
      'Construction des murs et structures',
      'Finitions et contrôles qualité',
    ],
    network: [
      'Branchement électrique NF C14-100/Disposition de branchement Senelec',
      'Installation des câbles préassemblés et conduits',
      'Connexion des équipements réseau',
      'Configuration et tests des connexions',
      'Renseignement du travail effectué',
    ],
    interior: [
      'Installation des interrupteurs et prises',
      'Montage des appareils électriques',
      'Câblage intérieur et connexions',
      'Tests fonctionnels et finitions',
    ],
    controller: [
      'Contrôles qualité des installations',
      'Validation des normes de sécurité',
      'Certification et documentation finale',
      'Formation des utilisateurs',
    ],
  };

  Object.entries(schedule).forEach(([roleKey, roleSchedule]) => {
    const role = roleKey as RoleKey;
    const dateDebut = new Date(dateDemarrageInitiale);
    dateDebut.setDate(dateDebut.getDate() + roleSchedule.start);

    const dateFin = new Date(dateDemarrageInitiale);
    dateFin.setDate(dateFin.getDate() + roleSchedule.end);

    // Calcul de la durée calendaire
    const dureeCalendrier = getCalendarDays(roleSchedule.duration, workDaysPerWeek, holidaysCount);

    // Mise à jour de la date de fin globale
    if (dateFin > dateFinGlobale) {
      dateFinGlobale = new Date(dateFin);
    }

    planningDetaille[role] = {
      role,
      dateDebut,
      dateFin,
      dureeJours: roleSchedule.duration,
      dureeCalendrier,
      equipesAllouees: teamConfigs[role].count,
      capaciteJournaliere:
        projectConfig?.config?.productionRates?.[role] || ROLE_CAPACITY_DEFAULTS[role],
      taches: descriptionsTaches[role] || [],
    };
  });

  return { planningDetaille, dateFinGlobale };
}

// V2: Main calculation with pipeline + cashflow
export function calculerScenarioV2(inputs: SimulationInputs): Scenario {
  const base = calculateScenario(inputs);

  // Improved pipeline schedule with unforeseen buffer
  const improvedSchedule = calculerCalendrierPipeline(
    {
      macon: base.schedule.macon.duration,
      network: base.schedule.network.duration,
      interior: base.schedule.interior.duration,
      controller: base.schedule.controller.duration,
    },
    inputs.tauxImprevu
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
  const cashflow = calculerTresorerie({
    laborCost: base.laborCost,
    logisticsCost,
    devisTotalPlanned: inputs.devisTotalPlanned,
    tauxAcompte: inputs.tauxAcompte,
    duration: newDuration,
  });

  // Générer le planning détaillé
  const dateDemarrageInitiale = inputs.dateDemarrageInitiale || new Date();
  const { planningDetaille, dateFinGlobale } = genererPlanningDetaille(
    improvedSchedule,
    dateDemarrageInitiale,
    inputs.workDaysPerWeek,
    inputs.holidaysCount,
    inputs.teamConfigs,
    inputs.projectConfig
  );

  return {
    ...base,
    duration: newDuration,
    calendarDuration: newCalendarDuration,
    schedule: improvedSchedule,
    cost: totalCost,
    margin,
    logisticsCost,
    tresorerieInitiale: cashflow.initialCash,
    depenseMax: Math.max(base.laborCost + logisticsCost, Math.abs(cashflow.minCash)),
    aRisqueTresorerie: cashflow.hasRisk,
    dateDemarrageInitiale,
    planningDetaille,
    dateFinGlobale,
  };
}

function comparerScenarios(
  a: Scenario,
  b: Scenario,
  mode: ModeOptimisation,
  dureeCible: number,
  devisTotalPlanned: number,
  limiteBudgetPourcent: number,
  margeMinimalePourcent: number
) {
  const budgetLimit = devisTotalPlanned * (limiteBudgetPourcent / 100);
  const minMarginThreshold = devisTotalPlanned * (margeMinimalePourcent / 100);

  const penaliteBudget = (scenario: Scenario) =>
    scenario.cost > budgetLimit ? 5000000 + (scenario.cost - budgetLimit) * 0.1 : 0;
  const penaliteMarge = (scenario: Scenario) =>
    scenario.margin < minMarginThreshold
      ? 5000000 + (minMarginThreshold - scenario.margin) * 0.1
      : 0;

  if (mode === 'duration') {
    if (a.calendarDuration !== b.calendarDuration) {
      return a.calendarDuration - b.calendarDuration;
    }
    const penaliteA = penaliteBudget(a) + penaliteMarge(a);
    const penaliteB = penaliteBudget(b) + penaliteMarge(b);
    if (penaliteA !== penaliteB) {
      return penaliteA - penaliteB;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cost') {
    const penaliteA = a.calendarDuration > dureeCible ? 100000000 : a.cost;
    const penaliteB = b.calendarDuration > dureeCible ? 100000000 : b.cost;
    const penaliteBudgetA = penaliteBudget(a);
    const penaliteBudgetB = penaliteBudget(b);
    if (penaliteA + penaliteBudgetA !== penaliteB + penaliteBudgetB) {
      return penaliteA + penaliteBudgetA - (penaliteB + penaliteBudgetB);
    }
    const penaliteMargeA = penaliteMarge(a);
    const penaliteMargeB = penaliteMarge(b);
    if (penaliteMargeA !== penaliteMargeB) {
      return penaliteMargeA - penaliteMargeB;
    }
    return b.margin - a.margin;
  }

  if (mode === 'cashflow') {
    if (a.aRisqueTresorerie !== b.aRisqueTresorerie) {
      return a.aRisqueTresorerie ? 1 : -1;
    }
    const aScore = a.cost + penaliteBudget(a) + penaliteMarge(a);
    const bScore = b.cost + penaliteBudget(b) + penaliteMarge(b);
    if (aScore !== bScore) {
      return aScore - bScore;
    }
    return b.margin - a.margin;
  }

  if (mode === 'profit_max') {
    const penaliteRisqueA = a.aRisqueTresorerie ? 7000000 : 0;
    const penaliteRetardA = a.calendarDuration > dureeCible ? 3000000 : 0;
    const scoreA =
      a.margin - penaliteRisqueA - penaliteRetardA - penaliteBudget(a) - penaliteMarge(a);

    const penaliteRisqueB = b.aRisqueTresorerie ? 7000000 : 0;
    const penaliteRetardB = b.calendarDuration > dureeCible ? 3000000 : 0;
    const scoreB =
      b.margin - penaliteRisqueB - penaliteRetardB - penaliteBudget(b) - penaliteMarge(b);

    return scoreB - scoreA;
  }

  if (mode === 'risk_averse') {
    if (a.aRisqueTresorerie !== b.aRisqueTresorerie) {
      return a.aRisqueTresorerie ? 1 : -1;
    }
    const penaliteA = penaliteBudget(a) + penaliteMarge(a);
    const penaliteB = penaliteBudget(b) + penaliteMarge(b);
    if (penaliteA !== penaliteB) {
      return penaliteA - penaliteB;
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
    const penaliteA = penaliteBudget(a) + penaliteMarge(a);
    const penaliteB = penaliteBudget(b) + penaliteMarge(b);
    if (penaliteA !== penaliteB) {
      return penaliteA - penaliteB;
    }
    if (a.logisticsCost !== b.logisticsCost) {
      return a.logisticsCost - b.logisticsCost;
    }
    return b.margin - a.margin;
  }

  return b.margin - a.margin;
}

export function optimiserConfigurationsEquipes(
  options: OptionsOptimisation
): Record<RoleKey, TeamConfig> {
  const {
    teamConfigs,
    dureeCible,
    limiteBudgetPourcent,
    margeMinimalePourcent,
    householdsCount,
    devisTotalPlanned,
    workDaysPerWeek,
    holidaysCount,
    projectConfig,
    baseVehicleCount,
    tauxImprevu,
    isHivernage,
    tauxRejet,
    tauxAcompte,
    penaliteHivernageMacon,
    penaliteHivernageReseau,
    mode,
    dateDemarrageInitiale,
  } = options;

  let currentConfigs: Record<RoleKey, TeamConfig> = JSON.parse(JSON.stringify(teamConfigs));
  let bestScenario = calculerScenarioV2({
    householdsCount,
    devisTotalPlanned,
    projectConfig,
    teamConfigs: currentConfigs,
    baseVehicleCount,
    tauxImprevu,
    isHivernage,
    tauxRejet,
    tauxAcompte,
    workDaysPerWeek,
    holidaysCount,
    penaliteHivernageMacon,
    penaliteHivernageReseau,
    dateDemarrageInitiale,
  });

  let improved = true;
  let iteration = 0;
  const MAX_ITER = 50;
  const paymentModes: PaymentMode[] = ['task', 'day'];

  // Phase 1: Greedy optimization by bottleneck (30 iterations)
  while (improved && iteration < 30) {
    iteration++;
    improved = false;

    const goulotDetroits = bestScenario.goulotDetroits;
    const testConfigs = JSON.parse(JSON.stringify(currentConfigs));

    // Try increasing bottleneck
    testConfigs[goulotDetroits].count = Math.min(testConfigs[goulotDetroits].count + 1, 8);

    const scenario = calculerScenarioV2({
      householdsCount,
      devisTotalPlanned,
      projectConfig,
      teamConfigs: testConfigs,
      baseVehicleCount,
      tauxImprevu,
      isHivernage,
      tauxRejet,
      tauxAcompte,
      workDaysPerWeek,
      holidaysCount,
      penaliteHivernageMacon,
      penaliteHivernageReseau,
      dateDemarrageInitiale,
    });

    if (
      comparerScenarios(
        scenario,
        bestScenario,
        mode,
        dureeCible,
        devisTotalPlanned,
        limiteBudgetPourcent,
        margeMinimalePourcent
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

      const scenario = calculerScenarioV2({
        householdsCount,
        devisTotalPlanned,
        projectConfig,
        teamConfigs: testConfigs,
        baseVehicleCount,
        tauxImprevu,
        isHivernage,
        tauxRejet,
        tauxAcompte,
        workDaysPerWeek,
        holidaysCount,
        penaliteHivernageMacon,
        penaliteHivernageReseau,
        dateDemarrageInitiale,
      });

      if (
        comparerScenarios(
          scenario,
          bestScenario,
          mode,
          dureeCible,
          devisTotalPlanned,
          limiteBudgetPourcent,
          margeMinimalePourcent
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
