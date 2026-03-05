/**
 * Service de Simulation Énergétique - PROQUELEC
 * Contient la logique de calcul de rentabilité et d'optimisation.
 */

const ROLE_CAPACITY_BASE = {
    macon: 5,
    network: 8,
    interior: 6,
    controller: 15
};

/**
 * Calcule un scénario de simulation complet
 */
export const calculerScenario = (params) => {
    const {
        teamConfigs,
        baseVehicleCount,
        unforeseenRate,
        householdsCount,
        isHivernage,
        hivernagePenaltyMacon,
        hivernagePenaltyNetwork,
        rejectRate,
        acompteRate,
        workDaysPerWeek,
        holidaysCount,
        totalPlannedBudget
    } = params;

    let factor = 1 + unforeseenRate / 100;
    if (isHivernage) factor += 0.05;

    const maconCap = ROLE_CAPACITY_BASE.macon * (isHivernage ? (1 - hivernagePenaltyMacon / 100) : 1);
    const networkCap = ROLE_CAPACITY_BASE.network * (isHivernage ? (1 - hivernagePenaltyNetwork / 100) : 1);
    const interiorCap = ROLE_CAPACITY_BASE.interior;
    const controllerCap = ROLE_CAPACITY_BASE.controller * (isHivernage ? 0.9 : 1);

    const capacities = {
        macon: teamConfigs.macon.count * maconCap,
        network: teamConfigs.network.count * networkCap,
        interior: teamConfigs.interior.count * interiorCap,
        controller: teamConfigs.controller.count * controllerCap
    };

    const minDailyCapacity = Math.min(...Object.values(capacities).filter(c => c > 0));
    const bottleneck = Object.entries(capacities).find(([_, cap]) => cap === minDailyCapacity)?.[0] || 'macon';

    const rejectHouseholds = Math.ceil(householdsCount * (rejectRate / 100));
    const totalNetworkHouseholds = householdsCount + rejectHouseholds;
    const totalInteriorHouseholds = householdsCount + rejectHouseholds;

    const durations = {
        macon: Math.ceil((householdsCount / (capacities.macon || 1)) * factor),
        network: Math.ceil((totalNetworkHouseholds / (capacities.network || 1)) * factor),
        interior: Math.ceil((totalInteriorHouseholds / (capacities.interior || 1)) * factor),
        controller: Math.ceil((householdsCount / (capacities.controller || 1)) * factor)
    };

    const schedule = {};
    schedule.macon = { start: 0, duration: durations.macon, end: durations.macon };

    schedule.network = {
        end: Math.max(schedule.macon.end + 1, schedule.macon.start + 1 + durations.network),
        duration: durations.network,
        start: 0
    };
    schedule.network.start = schedule.network.end - schedule.network.duration;

    schedule.interior = {
        end: Math.max(schedule.network.end + 1, schedule.network.start + 1 + durations.interior),
        duration: durations.interior,
        start: 0
    };
    schedule.interior.start = schedule.interior.end - schedule.interior.duration;

    schedule.controller = {
        end: Math.max(schedule.interior.end + 1, schedule.interior.start + 1 + durations.controller),
        duration: durations.controller,
        start: 0
    };
    schedule.controller.start = schedule.controller.end - schedule.controller.duration;

    const globalDuration = schedule.controller.end;

    const getCalendarDays = (workingDays) =>
        Math.ceil(workingDays * (7 / workDaysPerWeek)) + Math.ceil(workingDays / (globalDuration || 1) * holidaysCount);

    const globalCalendarDuration = getCalendarDays(globalDuration);

    let laborCost = 0;
    let teamsLogisticsCost = 0;

    Object.entries(teamConfigs).forEach(([role, config]) => {
        const teamDuration = schedule[role].duration;
        let householdsTreated = householdsCount;
        if (role === 'network' || role === 'interior') householdsTreated += rejectHouseholds;

        if (config.paymentMode === 'task') {
            laborCost += householdsTreated * config.rate;
        } else {
            laborCost += config.count * config.rate * teamDuration;
        }

        const teamCalendarDuration = getCalendarDays(teamDuration);
        teamsLogisticsCost += (config.count * config.vehiclesPerTeam) * 60000 * teamCalendarDuration;
    });

    const baseLogisticsCost = baseVehicleCount * 60000 * globalCalendarDuration;
    const logisticsCost = teamsLogisticsCost + baseLogisticsCost;
    const materialsCost = totalPlannedBudget * 0.4;
    const totalCost = laborCost + logisticsCost + materialsCost;
    const margin = totalPlannedBudget - totalCost;

    const initialCash = totalPlannedBudget * (acompteRate / 100);
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
        hasCashflowRisk
    };
};
