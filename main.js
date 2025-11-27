// Système de Pilotage Électrification de Masse - JavaScript Principal
// ============================================================================

// Charger les données de démonstration
// Initialisation sûre d'appState : définir d'abord les paramètres, puis le projet
// Charger les données de démonstration
// Initialisation sûre d'appState : définir d'abord les paramètres, puis le projet
window.appState = {
    teams: {},
    households: [],
    terrainData: [],
    performanceData: { dailyProgress: [] },
    bottlenecks: [],
    recommendations: []
};

// Paramètres par défaut
appState.parameters = {
    prepTeams: 3,
    loaderTeams: 2,
    deliveryTeams: 4,
    masonTeams: 6,
    networkElectricianTeams: 8,
    interiorElectricianType1Teams: 6,
    interiorElectricianType2Teams: 4,
    controllerTeams: 2,
    prepRate: 50,
    deliveryRate: 25,
    masonRate: 8,
    networkRate: 17,
    interiorRateType1: 1.5,
    interiorRateType2: 3,
    controlRate: 20,
    dailyTeamCost: 80000,
    truckCapacity: 50,
    deliveryDelay: 3,
    averageDistance: 2.5,
    unforeseenRate: 15,
    resourceAvailability: 85,
    automationLevel: 60,
    // Nouveaux paramètres de rémunération (FCFA)
    masonPayPerWall: 5000,
    interiorElectricianPayType1: 8000,
    interiorElectricianPayType2: 10000,
    networkElectricianPayPerConnection: 7000,
    controllerPayPerDay: 6000,
    supervisorPayPerDay: 9000,
    deliveryAgentPayPerDay: 5000,
    driverPayPerDay: 4500,
    // Véhicules et modes d'acquisition (par acteur)
    pmVehicleCount: 1,
    pmVehicleAcquisition: 'acheter', // 'acheter' or 'louer'
    controllerVehicleCount: 1,
    controllerVehicleAcquisition: 'acheter',
    networkInstallerVehicleCount: 2,
    networkInstallerVehicleAcquisition: 'acheter',
    deliveryTruckCount: 2,
    deliveryTruckAcquisition: 'acheter',
    // Coûts estimés véhicules (par unité) en FCFA
    pmVehiclePurchaseCost: 40000000,
    pmVehicleRentPerDay: 20000,
    controllerVehiclePurchaseCost: 30000000,
    controllerVehicleRentPerDay: 15000,
    networkInstallerVehiclePurchaseCost: 35000000,
    networkInstallerVehicleRentPerDay: 18000,
    deliveryTruckPurchaseCost: 25000000,
    deliveryTruckRentPerDay: 30000
};

// Projet par défaut
appState.project = {
    totalHouses: 1000,
    startDate: new Date('2024-01-15'),
    endDate: null,
    progress: 34.7,
    completedHouses: 347,
    activeTeams: 48
};
function calculateProductivity(params) {
    const dailyProduction = Math.min(
        params.prepTeams * params.prepRate,
        params.deliveryTeams * params.deliveryRate,
        params.masonTeams * params.masonRate,
        params.networkElectricianTeams * params.networkRate,
        // intérieur = type1 + type2
        ((params.interiorElectricianType1Teams || 0) * (params.interiorRateType1 || 0)) + ((params.interiorElectricianType2Teams || 0) * (params.interiorRateType2 || 0)),
        params.controllerTeams * params.controlRate
    );

    return dailyProduction;
}

function calculateRisk(params) {
    // Calculer le risque basé sur plusieurs facteurs
    let riskScore = 0;

    // Impact du taux d'imprévus
    riskScore += params.unforeseenRate * 0.3;

    // Impact de la disponibilité des ressources
    riskScore += (100 - params.resourceAvailability) * 0.2;

    // Impact de la distance moyenne
    riskScore += params.averageDistance * 2 * 0.1;

    // Impact du niveau d'automatisation
    riskScore += (100 - params.automationLevel) * 0.15;

    // Vérifier les déséquilibres entre équipes
    const interiorTotal = (params.interiorElectricianType1Teams || 0) + (params.interiorElectricianType2Teams || 0);
    const maxTeams = Math.max(params.masonTeams, params.networkElectricianTeams, interiorTotal);
    const minTeams = Math.min(params.masonTeams, params.networkElectricianTeams, Math.max(1, interiorTotal));
    const imbalance = (maxTeams - minTeams) / minTeams * 100;
    riskScore += imbalance * 0.25;

    return Math.min(riskScore, 100);
}

// Petit ensemble d'utilitaires manquants (implémentations sûres et conservatrices)
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString();
}

function formatCurrency(n) {
    if (n === null || n === undefined) return '0 €';
    try {
        // Format as FCFA (no decimals) with thousands separator
        return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' FCFA';
    } catch (e) {
        return String(n) + ' FCFA';
    }
}

function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

function calculateDaysBetween(start, end) {
    try {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffMs = e.getTime() - s.getTime();
        const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return days;
    } catch (e) {
        console.warn('calculateDaysBetween error', e);
        return 0;
    }
}

function calculateProjectDuration() {
    // Utilisation du nouveau moteur de simulation
    try {
        if (!window.LegacySimulationEngine) return null;
        const total = Number(appState.project.totalHouses);
        if (!total) return null;

        // On lance une simulation légère si pas de résultat en cache
        if (!appState.simulationResult) {
            appState.simulationResult = window.LegacySimulationEngine.run(appState.parameters, total);
        }
        return appState.simulationResult.duration;
    } catch (e) {
        console.warn('calculateProjectDuration fallback', e);
        return null;
    }
}

function calculateCosts() {
    // Calcul détaillé des coûts basé sur la simulation de flux
    try {
        const p = appState.parameters;
        if (!p || typeof p !== 'object') return { totalCost: null, dailyCost: null, details: {} };

        // S'assurer qu'on a une simulation fraîche
        const totalHouses = Number(appState.project.totalHouses);
        if (!appState.simulationResult) {
            if (window.LegacySimulationEngine) {
                appState.simulationResult = window.LegacySimulationEngine.run(p, totalHouses);
            } else {
                return { totalCost: 0, dailyCost: 0, details: {} };
            }
        }

        const sim = appState.simulationResult;
        const duration = sim.duration;
        const act = sim.activity; // Jours d'activité réelle par équipe

        // Coûts variables basés sur l'activité réelle (Flow Logic)
        // On paie les équipes pour les jours où elles ont travaillé (ou étaient mobilisées)
        // Note: Dans un contrat réel, on peut payer à la tâche ou au jour de présence.
        // Ici on garde la logique "au jour" mais basée sur l'activité simulée pour plus de précision,
        // ou sur la durée totale si c'est du staff permanent.

        // Staff permanent (payé sur la durée totale du projet)
        const supervisorCost = duration * Number(p.supervisorCount || 0) * Number(p.supervisorPayPerDay || 0);
        const deliveryAgentCost = duration * Number(p.deliveryAgentCount || 0) * Number(p.deliveryAgentPayPerDay || 0);
        const driverCost = duration * Number(p.driverCount || 0) * Number(p.driverPayPerDay || 0);
        const controllerDays = duration; // Le contrôleur est là tout le long
        const controllerCost = controllerDays * Number(p.controllerTeams || 0) * Number(p.controllerPayPerDay || 0);

        // Tâches à l'unité (Maçonnerie, Élec)
        // Le coût est `Quantité * Prix Unitaire` (plus précis que Temps * Taux)
        const wallsBuilt = sim.finalStocks.maconnerie + sim.finalStocks.reseau + sim.finalStocks.interieur + sim.finalStocks.fini; // Tout ce qui a passé l'étape maçonnerie
        // En fait, totalHouses est le target.

        const masonUnit = Number(p.masonPayPerWall || 0);
        const masonCost = totalHouses * masonUnit; // On paie pour ce qui est fait (target total)

        const interiorUnitType1 = Number(p.interiorElectricianPayType1 || 0);
        const interiorUnitType2 = Number(p.interiorElectricianPayType2 || 0);
        const shareType1 = (p.interiorType1SharePercent !== undefined) ? (Number(p.interiorType1SharePercent) / 100) : 0.6;
        const housesType1 = Math.round(totalHouses * shareType1);
        const housesType2 = totalHouses - housesType1;

        const interiorType1Cost = housesType1 * interiorUnitType1;
        const interiorType2Cost = housesType2 * interiorUnitType2;
        const interiorElectricianCost = interiorType1Cost + interiorType2Cost;

        const networkUnit = Number(p.networkElectricianPayPerConnection || 0);
        const networkElectricianCost = totalHouses * networkUnit;

        // Vehicles (Durée totale car immobilisés)
        const pmVehicles = Number(p.pmVehicleCount || 0);
        const pmAcq = p.pmVehicleAcquisition || 'acheter';
        const pmPurchaseCost = Number(p.pmVehiclePurchaseCost || 0);
        const pmRentPerDay = Number(p.pmVehicleRentPerDay || 0);
        const pmVehicleCost = pmVehicles * (pmAcq === 'acheter' ? pmPurchaseCost : (pmRentPerDay * duration));

        const controllerVehicles = Number(p.controllerVehicleCount || 0);
        const controllerAcq = p.controllerVehicleAcquisition || 'acheter';
        const controllerPurchaseCost = Number(p.controllerVehiclePurchaseCost || 0);
        const controllerRentPerDay = Number(p.controllerVehicleRentPerDay || 0);
        const controllerVehicleCost = controllerVehicles * (controllerAcq === 'acheter' ? controllerPurchaseCost : (controllerRentPerDay * duration));

        const networkInstallerVehicles = Number(p.networkInstallerVehicleCount || 0);
        const networkInstallerAcq = p.networkInstallerVehicleAcquisition || 'acheter';
        const networkInstallerPurchaseCost = Number(p.networkInstallerVehiclePurchaseCost || 0);
        const networkInstallerRentPerDay = Number(p.networkInstallerVehicleRentPerDay || 0);
        const networkInstallerVehicleCost = networkInstallerVehicles * (networkInstallerAcq === 'acheter' ? networkInstallerPurchaseCost : (networkInstallerRentPerDay * duration));

        const deliveryTrucks = Number(p.deliveryTruckCount || 0);
        const deliveryTruckAcq = p.deliveryTruckAcquisition || 'acheter';
        const deliveryTruckPurchaseCost = Number(p.deliveryTruckPurchaseCost || 0);
        const deliveryTruckRentPerDay = Number(p.deliveryTruckRentPerDay || 0);
        const deliveryTruckCost = deliveryTrucks * (deliveryTruckAcq === 'acheter' ? deliveryTruckPurchaseCost : (deliveryTruckRentPerDay * duration));

        const totalCost = masonCost + interiorElectricianCost + networkElectricianCost + controllerCost + supervisorCost + deliveryAgentCost + driverCost + pmVehicleCost + controllerVehicleCost + networkInstallerVehicleCost + deliveryTruckCost;

        return {
            totalCost,
            dailyCost: totalCost / duration,
            details: {
                duration,
                totalHouses,
                wallsBuilt: totalHouses,
                housesType1,
                housesType2,
                interiorInstallationsType1: housesType1,
                interiorInstallationsType2: housesType2,
                networkConnections: totalHouses,
                masonUnit,
                interiorUnitType1,
                interiorUnitType2,
                networkUnit,
                masonCost,
                interiorType1Cost,
                interiorType2Cost,
                interiorElectricianCost,
                networkElectricianCost,
                controllerDays,
                controllerCost,
                supervisorCost,
                deliveryAgentCost,
                driverCost,
                pmVehicles,
                pmAcq,
                pmPurchaseCost,
                pmRentPerDay,
                pmVehicleCost,
                controllerVehicles,
                controllerAcq,
                controllerPurchaseCost,
                controllerRentPerDay,
                controllerVehicleCost,
                networkInstallerVehicles,
                networkInstallerAcq,
                networkInstallerPurchaseCost,
                networkInstallerRentPerDay,
                networkInstallerVehicleCost,
                deliveryTrucks,
                deliveryTruckAcq,
                deliveryTruckPurchaseCost,
                deliveryTruckRentPerDay,
                deliveryTruckCost
            }
        };
    } catch (e) {
        console.error('calculateCosts error', e);
        return { totalCost: 0, dailyCost: 0, details: {} };
    }
}

function detectBottlenecks() {
    // Utilisation du moteur de simulation pour détecter les goulots
    if (window.LegacySimulationEngine && appState.simulationResult) {
        return window.LegacySimulationEngine.detectBottlenecks(appState.simulationResult);
    }
    return [];
}

// ---------------------------------------------------------------------------
// TERRAIN DATA AGGREGATION UTILITIES
// ---------------------------------------------------------------------------

function parseTeamKey(teamStr) {
    if (!teamStr || typeof teamStr !== 'string') return { type: 'unknown', id: teamStr };
    const parts = teamStr.split('-');
    const prefix = parts[0];
    const id = parts.slice(1).join('-') || null;
    const map = {
        prep: 'preparateurs',
        delivery: 'livraison',
        mason: 'macons',
        network: 'reseau',
        interior: 'interieur',
        control: 'controle'
    };
    return { type: map[prefix] || prefix, id: id ? `${prefix}-${id}` : prefix };
}

function aggregateTerrainData(terrainData) {
    const agg = {};
    if (!Array.isArray(terrainData)) return agg;

    // Helper to ensure structure
    const ensure = (type, subteam) => {
        if (!agg[type]) agg[type] = { total: 0, byDate: {}, subteams: {} };
        if (subteam && !agg[type].subteams[subteam]) agg[type].subteams[subteam] = { total: 0, byDate: {} };
    };

    terrainData.forEach(entry => {
        const date = entry.date ? (new Date(entry.date)).toISOString().slice(0, 10) : (new Date()).toISOString().slice(0, 10);
        const teamStr = entry.team || 'unknown';
        const count = Number(entry.housesCount || entry.count || 0) || 0;
        const { type, id } = parseTeamKey(teamStr);

        ensure(type, id);

        // classify contribution depending on type
        // For masonry entries, housesCount represents walls built
        // For network entries, housesCount represents connections
        // For delivery/prep/interior/control entries, housesCount maps to their completed units
        agg[type].total += count;

        // byDate aggregation
        if (!agg[type].byDate[date]) agg[type].byDate[date] = { total: 0, entries: [] };
        agg[type].byDate[date].total += count;
        agg[type].byDate[date].entries.push(Object.assign({ originalTeam: teamStr }, entry));

        // subteam aggregation
        if (id) {
            agg[type].subteams[id].total += count;
            if (!agg[type].subteams[id].byDate[date]) agg[type].subteams[id].byDate[date] = 0;
            agg[type].subteams[id].byDate[date] += count;
        }
    });

    return agg;
}

function buildTeamsFromData(parameters, terrainData) {
    const agg = aggregateTerrainData(terrainData || []);
    const teams = {};

    const latestDate = (() => {
        const dates = (terrainData || []).map(d => d.date).filter(Boolean).map(d => new Date(d));
        if (dates.length === 0) return null;
        return new Date(Math.max.apply(null, dates));
    })();
    const latestDateStr = latestDate ? latestDate.toISOString().slice(0, 10) : null;

    // Helper to pick parameter key by team type
    const paramKey = {
        preparateurs: 'prepTeams',
        livraison: 'deliveryTeams',
        macons: 'masonTeams',
        reseau: 'networkElectricianTeams',
        interieur: function (p) { return (p.interiorElectricianType1Teams || 0) + (p.interiorElectricianType2Teams || 0); },
        controle: 'controllerTeams'
    };

    ['preparateurs', 'livraison', 'macons', 'reseau', 'interieur', 'controle'].forEach(type => {
        let active = 0;
        const key = paramKey[type];
        if (typeof key === 'function') active = Number(key(parameters) || 0);
        else active = Number(parameters[key] || 0);

        const aggType = agg[type] || { total: 0, byDate: {}, subteams: {} };

        // dailyProduction: value for latest date if present, else 0
        const dailyProduction = latestDateStr && aggType.byDate[latestDateStr] ? aggType.byDate[latestDateStr].total : 0;

        // 7-day average
        let sevenDayAvg = 0;
        if (Object.keys(aggType.byDate).length > 0) {
            const dates = Object.keys(aggType.byDate).sort();
            const last7 = dates.slice(-7);
            const sum = last7.reduce((s, d) => s + (aggType.byDate[d]?.total || 0), 0);
            sevenDayAvg = Math.round(sum / Math.max(1, last7.length));
        }

        // subteams summary array
        const subteams = Object.entries(aggType.subteams || {}).map(([id, s]) => ({ id, total: s.total, byDate: s.byDate }));

        teams[type] = {
            active,
            total: active,
            dailyProduction: dailyProduction || sevenDayAvg || (active * (parameters[type === 'interieur' ? 'interiorRateType1' : (type + 'Rate')] || 0)),
            lastDayProduction: dailyProduction,
            sevenDayAvg,
            progress: 0,
            totalCompleted: aggType.total || 0,
            subteams
        };
    });

    return teams;
}


function generateRecommendations() {
    // Générer des recommandations basiques à partir des goulots
    const recs = [];
    const b = detectBottlenecks();
    b.forEach(item => recs.push({ priority: item.severity, message: item.message, action: item.recommendation }));
    return recs;
}

function simulate(simulationParams) {
    // Retourner des valeurs clés estimées
    const params = simulationParams || appState.parameters || {};
    const productivity = calculateProductivity(params) || 1;
    const duration = Math.max(1, Math.ceil((appState.project.totalHouses || 0) / productivity));
    const costs = calculateCosts();
    const risk = calculateRisk(params || {});
    return {
        duration,
        totalCost: costs.totalCost || 0,
        productivity,
        risk,
        dailyCost: costs.dailyCost || 0
    };
}

// ============================================================================
// GESTION DES DONNÉES ET ÉTAT
// ============================================================================

function updateAppState() {
    // Rebuild teams using parameters + terrain data (gives per-subteam breakdowns)
    const params = appState.parameters || {};
    const terrain = appState.terrainData || [];

    // --- NEW: Run Flow Simulation ONLY if project is configured ---
    const isProjectConfigured = (appState.project.totalHouses > 0 && appState.project.startDate) ||
        (appState.project.zones && appState.project.zones.length > 0);

    if (window.LegacySimulationEngine && isProjectConfigured) {
        const totalHouses = Number(appState.project.totalHouses) || 1000;
        // Pass zones to the simulation engine if available
        const simParams = {
            ...params,
            zones: appState.project.zones || [],
            allocationMode: appState.project.allocationMode || 'auto'
        };
        appState.simulationResult = window.LegacySimulationEngine.run(simParams, totalHouses);
    } else {
        // Clear simulation result if project not configured
        appState.simulationResult = null;
    }

    // Aggregate terrain data and build team summaries
    const agg = aggregateTerrainData(terrain);
    const teamsFromData = buildTeamsFromData(params, terrain);

    // Assign into appState.teams with sensible fallbacks
    appState.teams.preparateurs = teamsFromData.preparateurs || {
        active: params.prepTeams || 0, total: params.prepTeams || 0, dailyProduction: (params.prepTeams || 0) * (params.prepRate || 0), progress: 0, totalCompleted: 0, subteams: []
    };

    appState.teams.livraison = teamsFromData.livraison || {
        active: params.deliveryTeams || 0, total: params.deliveryTeams || 0, dailyProduction: (params.deliveryTeams || 0) * (params.deliveryRate || 0), progress: 0, totalCompleted: 0, subteams: []
    };

    appState.teams.macons = teamsFromData.macons || {
        active: params.masonTeams || 0, total: params.masonTeams || 0, dailyProduction: (params.masonTeams || 0) * (params.masonRate || 0), progress: 0, totalCompleted: 0, subteams: []
    };

    appState.teams.reseau = teamsFromData.reseau || {
        active: params.networkElectricianTeams || 0, total: params.networkElectricianTeams || 0, dailyProduction: (params.networkElectricianTeams || 0) * (params.networkRate || 0), progress: 0, totalCompleted: 0, subteams: []
    };

    appState.teams.interieur = teamsFromData.interieur || {
        active: ((params.interiorElectricianType1Teams || 0) + (params.interiorElectricianType2Teams || 0)),
        total: ((params.interiorElectricianType1Teams || 0) + (params.interiorElectricianType2Teams || 0)),
        dailyProduction: ((params.interiorElectricianType1Teams || 0) * (params.interiorRateType1 || 0)) + ((params.interiorElectricianType2Teams || 0) * (params.interiorRateType2 || 0)),
        progress: 0, totalCompleted: 0, subteams: []
    };

    appState.teams.controle = teamsFromData.controle || {
        active: params.controllerTeams || 0, total: params.controllerTeams || 0, dailyProduction: (params.controllerTeams || 0) * (params.controlRate || 0), progress: 0, totalCompleted: 0, subteams: []
    };

    // If terrain aggregates provide totals, set totalCompleted per team
    ['preparateurs', 'livraison', 'macons', 'reseau', 'interieur', 'controle'].forEach(t => {
        if (agg[t] && typeof agg[t].total === 'number') {
            appState.teams[t].totalCompleted = agg[t].total;
        }
        // compute a simple progress metric per team (completed vs expected workload)
        const totalHouses = appState.project.totalHouses || 0;
        if (totalHouses > 0) {
            appState.teams[t].progress = Math.min(100, Math.round((appState.teams[t].totalCompleted || 0) / totalHouses * 100));
        } else {
            appState.teams[t].progress = 0;
        }
    });

    // Compute completed houses from livraison if available, else keep existing
    const computedCompleted = (agg.livraison && agg.livraison.total) ? agg.livraison.total : (appState.project.completedHouses || 0);
    appState.project.completedHouses = computedCompleted;

    // Calculer l'avancement global comme proportion de ménages traités
    const totalHouses = appState.project.totalHouses || 0;
    appState.project.progress = totalHouses > 0 ? Math.min(100, Math.round((appState.project.completedHouses || 0) / totalHouses * 100)) : appState.project.progress || 0;

    // Calculer la date de fin
    const duration = calculateProjectDuration();
    appState.project.endDate = addDays(appState.project.startDate, duration);

    // Mettre à jour les goulots d'étranglement et recommandations
    appState.bottlenecks = detectBottlenecks();
    appState.recommendations = generateRecommendations();
}

function saveToLocalStorage() {
    localStorage.setItem('electrificationApp', JSON.stringify(appState));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('electrificationApp');
    if (saved) {
        appState = { ...appState, ...JSON.parse(saved) };
        // Ensure newly added vehicle parameters exist when loading legacy states
        try {
            ensureVehicleDefaults(appState.parameters);
        } catch (e) { console.warn('ensureVehicleDefaults failed', e); }
        // Notify UI
        document.dispatchEvent(new CustomEvent('zonesUpdated'));
    }
}

function ensureVehicleDefaults(params) {
    if (!params || typeof params !== 'object') return;
    // counts
    params.pmVehicleCount = Number(params.pmVehicleCount ?? 1);
    params.controllerVehicleCount = Number(params.controllerVehicleCount ?? 1);
    params.networkInstallerVehicleCount = Number(params.networkInstallerVehicleCount ?? 2);
    params.deliveryTruckCount = Number(params.deliveryTruckCount ?? 2);

    // acquisition mode
    params.pmVehicleAcquisition = params.pmVehicleAcquisition || 'acheter';
    params.controllerVehicleAcquisition = params.controllerVehicleAcquisition || 'acheter';
    params.networkInstallerVehicleAcquisition = params.networkInstallerVehicleAcquisition || 'acheter';
    params.deliveryTruckAcquisition = params.deliveryTruckAcquisition || 'acheter';

    // per-unit purchase / rent defaults (FCFA)
    params.pmVehiclePurchaseCost = Number(params.pmVehiclePurchaseCost ?? 40000000);
    params.pmVehicleRentPerDay = Number(params.pmVehicleRentPerDay ?? 20000);
    params.controllerVehiclePurchaseCost = Number(params.controllerVehiclePurchaseCost ?? 30000000);
    params.controllerVehicleRentPerDay = Number(params.controllerVehicleRentPerDay ?? 15000);
    params.networkInstallerVehiclePurchaseCost = Number(params.networkInstallerVehiclePurchaseCost ?? 35000000);
    params.networkInstallerVehicleRentPerDay = Number(params.networkInstallerVehicleRentPerDay ?? 18000);
    params.deliveryTruckPurchaseCost = Number(params.deliveryTruckPurchaseCost ?? 25000000);
    params.deliveryTruckRentPerDay = Number(params.deliveryTruckRentPerDay ?? 30000);
}

// ============================================================================
// FONCTIONS D'INTERFACE UTILISATEUR
// ============================================================================

function updateDashboard() {
    // Check if simulation data exists
    if (!appState.simulationResult) {
        // Show empty state message
        const alertSection = document.getElementById('alertSection');
        if (alertSection) {
            alertSection.innerHTML = `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                    <div class="flex items-start">
                        <i class="fas fa-info-circle text-blue-500 text-xl mr-3 mt-1"></i>
                        <div>
                            <h3 class="text-sm font-medium text-blue-800">Aucune simulation disponible</h3>
                            <p class="mt-1 text-sm text-blue-700">
                                Veuillez configurer votre projet dans la page <a href="parametres.html" class="underline font-semibold">Paramètres</a> :
                            </p>
                            <ul class="mt-2 text-sm text-blue-700 list-disc list-inside">
                                <li>Définir le nombre total de ménages OU créer des zones</li>
                                <li>Configurer les équipes et taux de productivité</li>
                                <li>Définir la date de début du projet</li>
                            </ul>
                            <p class="mt-2 text-sm text-blue-700">
                                Une fois configuré, cliquez sur <strong>"Sauvegarder les paramètres"</strong> puis revenez au dashboard.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Set default values for KPIs
        document.getElementById('globalProgress').textContent = '0%';
        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('completedHouses').textContent = '0';
        document.getElementById('totalHouses').textContent = '0';
        document.getElementById('activeTeams').textContent = '0';
        document.getElementById('totalTeams').textContent = '0';
        document.getElementById('daysRemaining').textContent = '—';
        document.getElementById('endDate').textContent = '—';

        return; // Stop here, don't update charts
    }

    // Mettre à jour les indicateurs clés
    document.getElementById('globalProgress').textContent = Math.round(appState.project.progress) + '%';
    document.getElementById('progressBar').style.width = appState.project.progress + '%';
    document.getElementById('completedHouses').textContent = formatNumber(appState.project.completedHouses);
    document.getElementById('totalHouses').textContent = formatNumber(appState.project.totalHouses);

    const totalTeams = Object.values(appState.teams).reduce((sum, team) => sum + team.active, 0);
    document.getElementById('activeTeams').textContent = totalTeams;
    document.getElementById('totalTeams').textContent = totalTeams;

    if (appState.project.endDate) {
        const daysRemaining = calculateDaysBetween(new Date(), appState.project.endDate);
        document.getElementById('daysRemaining').textContent = daysRemaining;
        document.getElementById('endDate').textContent = formatDate(appState.project.endDate);
    }

    // Mettre à jour le tableau des ressources
    updateResourceTable();

    // Mettre à jour les graphiques
    updateCharts();
    renderStocksChart(); // Render the new chart on dashboard update

    // Mettre à jour les alertes
    updateAlerts();

    // Mettre à jour les recommandations
    updateRecommendations();

    // Mettre à jour le panneau de détails des équipes (sous‑équipes)
    try { updateTeamDetails(); } catch (e) { console.warn('updateTeamDetails failed', e); }
}

function updateTeamDetails() {
    const container = document.getElementById('teamDetailsContainer');
    if (!container) return;
    container.innerHTML = '';

    const types = ['preparateurs', 'livraison', 'macons', 'reseau', 'interieur', 'controle'];
    types.forEach(type => {
        const team = appState.teams[type] || { totalCompleted: 0, subteams: [] };
        const title = ({ preparateurs: 'Préparateurs', livraison: 'Livraison', macons: 'Maçons', reseau: 'Réseau', interieur: 'Intérieur', controle: 'Contrôle' })[type] || type;

        const card = document.createElement('div');
        card.className = 'p-4 border rounded-lg';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-3';
        header.innerHTML = `<div><h4 class="font-semibold text-gray-800">${title}</h4><div class="text-xs text-gray-500">Total complété: <strong>${formatNumber(team.totalCompleted || 0)}</strong></div></div>`;
        card.appendChild(header);

        const subteams = team.subteams || [];
        if (subteams.length === 0) {
            const note = document.createElement('p');
            note.className = 'text-sm text-gray-500';
            note.textContent = 'Aucune donnée de sous‑équipe disponible.';
            card.appendChild(note);
        } else {
            const table = document.createElement('table');
            table.className = 'min-w-full text-sm';
            table.innerHTML = `
                <thead class="text-xs text-gray-500 uppercase">
                    <tr>
                        <th class="px-2 py-1 text-left">Sous‑équipe</th>
                        <th class="px-2 py-1 text-right">Total</th>
                        <th class="px-2 py-1 text-right">Dernier jour</th>
                        <th class="px-2 py-1 text-right">Moyenne 7j</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100"></tbody>
            `;

            const tbody = table.querySelector('tbody');
            subteams.forEach(st => {
                // compute last day and 7-day avg from byDate
                const dates = st.byDate ? Object.keys(st.byDate).sort() : [];
                const lastDate = dates.length ? dates[dates.length - 1] : null;
                const lastValue = lastDate ? (st.byDate[lastDate] || 0) : 0;
                const last7 = dates.slice(-7);
                const sum7 = last7.reduce((s, d) => s + (st.byDate[d] || 0), 0);
                const avg7 = Math.round(sum7 / Math.max(1, last7.length));

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-2 py-1 text-left">${escapeHTML(st.id)}</td>
                    <td class="px-2 py-1 text-right">${formatNumber(st.total || 0)}</td>
                    <td class="px-2 py-1 text-right">${formatNumber(lastValue)}</td>
                    <td class="px-2 py-1 text-right">${formatNumber(avg7)}</td>
                `;
                tbody.appendChild(tr);
            });

            card.appendChild(table);
        }

        container.appendChild(card);
    });
}

function updateResourceTable() {
    const tbody = document.getElementById('resourceTable');
    if (!tbody) return;

    const teams = appState.teams;
    const rows = [
        { name: 'Préparateurs', data: teams.preparateurs },
        { name: 'Livraison', data: teams.livraison },
        { name: 'Maçons', data: teams.macons },
        { name: 'Électriciens Réseau', data: teams.reseau },
        { name: 'Électriciens Intérieur', data: teams.interieur },
        { name: 'Contrôleurs', data: teams.controle }
    ];

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(row.name)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(row.data.active)}/${formatNumber(row.data.total)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(row.data.dailyProduction)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${row.data.progress}%"></div>
                </div>
                <span class="text-xs text-gray-500">${Math.round(row.data.progress)}%</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${row.data.progress >= 80 ? 'status-completed' : row.data.progress >= 40 ? 'status-in-progress' : 'status-pending'}">
                    ${row.data.progress >= 80 ? 'Terminé' : row.data.progress >= 40 ? 'En cours' : 'En attente'}
                </span>
            </td>
        </tr>
    `).join('');
}

function updateCharts() {
    // Graphique d'avancement par corps de métier avec données réalistes
    const tradeProgressChart = document.getElementById('tradeProgressChart');
    if (tradeProgressChart) {
        const teams = appState.teams;
        const data = [{
            x: ['Préparateurs', 'Livraison', 'Maçons', 'Réseau', 'Intérieur', 'Contrôle'],
            y: [teams.preparateurs.progress, teams.livraison.progress, teams.macons.progress,
            teams.reseau.progress, teams.interieur.progress, teams.controle.progress],
            type: 'bar',
            marker: {
                color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'],
                line: { color: '#374151', width: 1 }
            },
            text: [teams.preparateurs.progress + '%', teams.livraison.progress + '%', teams.macons.progress + '%',
            teams.reseau.progress + '%', teams.interieur.progress + '%', teams.controle.progress + '%'],
            textposition: 'outside'
        }];

        const layout = {
            title: {
                text: 'Avancement par Corps de Métier',
                font: { size: 16, color: '#374151' }
            },
            xaxis: {
                title: 'Corps de métier',
                tickangle: -45
            },
            yaxis: {
                title: 'Progression (%)',
                range: [0, 100]
            },
            margin: { t: 60, r: 20, b: 100, l: 60 },
            plot_bgcolor: '#f9fafb',
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot(tradeProgressChart, data, layout, { responsive: true });
    }

    // Graphique de productivité quotidienne avec tendance réelle
    const productivityChart = document.getElementById('productivityChart');
    if (productivityChart) {
        const performanceData = appState.performanceData.dailyProgress;
        const dates = performanceData.map(d => d.date);
        const dailyProduction = performanceData.map(d => d.houses);
        const cumulativeProduction = performanceData.map(d => d.cumulative);

        const trace1 = {
            x: dates,
            y: dailyProduction,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Production Journalière',
            line: { color: '#10b981', width: 3 },
            marker: { color: '#10b981', size: 8 },
            yaxis: 'y'
        };

        const trace2 = {
            x: dates,
            y: cumulativeProduction,
            type: 'scatter',
            mode: 'lines',
            name: 'Production Cumulative',
            line: { color: '#3b82f6', width: 2, dash: 'dot' },
            yaxis: 'y2'
        };

        const layout = {
            title: {
                text: 'Évolution de la Productivité',
                font: { size: 16, color: '#374151' }
            },
            xaxis: {
                title: 'Date',
                type: 'date'
            },
            yaxis: {
                title: 'Ménages/Jour',
                side: 'left',
                color: '#10b981'
            },
            yaxis2: {
                title: 'Ménages Cumulés',
                side: 'right',
                overlaying: 'y',
                color: '#3b82f6'
            },
            margin: { t: 60, r: 80, b: 60, l: 60 },
            plot_bgcolor: '#f9fafb',
            paper_bgcolor: '#ffffff',
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.8)'
            }
        };

        Plotly.newPlot(productivityChart, [trace1, trace2], layout, { responsive: true });
    }

    // Graphique de comparaison des scénarios
    const scenarioChart = document.getElementById('scenarioChart');
    if (scenarioChart) {
        updateScenarioChart();
    }

    // Timeline du projet avec détails
    const timelineChart = document.getElementById('timelineChart');
    if (timelineChart) {
        updateTimelineChart();
    }
}

// Ajouter la fonction pour le graphique de comparaison des scénarios
function updateScenarioChart() {
    const scenarioChart = document.getElementById('scenarioChart');
    if (!scenarioChart) return;

    // Données de comparaison des scénarios
    const scenarios = [
        { name: 'Configuration Actuelle', duration: 190, cost: 4250000, risk: 25 },
        { name: 'Configuration Optimisée', duration: 152, cost: 3980000, risk: 18 },
        { name: 'Déploiement Rapide', duration: 134, cost: 4850000, risk: 35 },
        { name: 'Version Économique', duration: 227, cost: 3650000, risk: 22 }
    ];

    const trace1 = {
        x: scenarios.map(s => s.name),
        y: scenarios.map(s => s.duration),
        type: 'bar',
        name: 'Durée (jours)',
        marker: { color: '#3b82f6' },
        yaxis: 'y'
    };

    const trace2 = {
        x: scenarios.map(s => s.name),
        y: scenarios.map(s => s.cost / 1000000), // En millions
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Coût (M€)',
        line: { color: '#10b981', width: 3 },
        marker: { color: '#10b981', size: 10 },
        yaxis: 'y2'
    };

    const trace3 = {
        x: scenarios.map(s => s.name),
        y: scenarios.map(s => s.risk),
        type: 'scatter',
        mode: 'markers',
        name: 'Risque (%)',
        marker: {
            color: scenarios.map(s => s.risk > 30 ? '#ef4444' : s.risk > 20 ? '#f59e0b' : '#10b981'),
            size: scenarios.map(s => s.risk * 2),
            sizemode: 'diameter'
        },
        yaxis: 'y3'
    };

    const layout = {
        title: {
            text: 'Comparaison des Scénarios',
            font: { size: 16, color: '#374151' }
        },
        xaxis: {
            title: 'Scénarios',
            tickangle: -45
        },
        yaxis: {
            title: 'Durée (jours)',
            side: 'left',
            color: '#3b82f6'
        },
        yaxis2: {
            title: 'Coût (M€)',
            side: 'right',
            overlaying: 'y',
            color: '#10b981'
        },
        yaxis3: {
            title: 'Risque (%)',
            side: 'right',
            overlaying: 'y',
            position: 0.95,
            color: '#f59e0b'
        },
        margin: { t: 60, r: 80, b: 100, l: 60 },
        plot_bgcolor: '#f9fafb',
        paper_bgcolor: '#ffffff',
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255,255,255,0.8)'
        }
    };

    Plotly.newPlot(scenarioChart, [trace1, trace2, trace3], layout, { responsive: true });
}

function updateTimelineChart() {
    const timelineChart = document.getElementById('timelineChart');
    if (!timelineChart) return;

    const startDate = new Date(appState.project.startDate);
    const currentDate = new Date(appState.project.currentDate);
    const daysElapsed = calculateDaysBetween(startDate, currentDate);

    // Tâches avec dates réalistes basées sur les données actuelles
    const tasks = [
        {
            name: 'Préparation des kits',
            start: 0,
            duration: 25,
            color: '#3b82f6',
            progress: 100,
            actualEnd: 22
        },
        {
            name: 'Livraison',
            start: 3,
            duration: 35,
            color: '#10b981',
            progress: 85,
            actualEnd: daysElapsed
        },
        {
            name: 'Construction murs',
            start: 8,
            duration: 45,
            color: '#f59e0b',
            progress: 65,
            actualEnd: daysElapsed
        },
        {
            name: 'Installation réseau',
            start: 18,
            duration: 50,
            color: '#8b5cf6',
            progress: 45,
            actualEnd: daysElapsed
        },
        {
            name: 'Installation intérieure',
            start: 28,
            duration: 60,
            color: '#ef4444',
            progress: 32,
            actualEnd: daysElapsed
        },
        {
            name: 'Contrôle qualité',
            start: 38,
            duration: 30,
            color: '#6b7280',
            progress: 28,
            actualEnd: daysElapsed
        }
    ];

    const traces = tasks.map((task, index) => {
        // Barre planifiée
        const plannedBar = {
            x: [task.start, task.start + task.duration],
            y: [index, index],
            type: 'scatter',
            mode: 'lines',
            line: { color: task.color, width: 20 },
            name: `${task.name} (planifié)`,
            showlegend: false,
            hovertemplate: `<b>${task.name}</b><br>Planifié: Jour ${task.start} - ${task.start + task.duration}<extra></extra>`
        };

        // Barre de progression actuelle
        const actualEnd = Math.min(task.actualEnd, task.start + task.duration);
        const progressBar = {
            x: [task.start, actualEnd],
            y: [index + 0.2, index + 0.2],
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ffffff', width: 12 },
            name: `${task.name} (réel)`,
            showlegend: false,
            hovertemplate: `<b>${task.name}</b><br>Réel: Jour ${task.start} - ${actualEnd}<br>Progression: ${task.progress}%<extra></extra>`
        };

        return [plannedBar, progressBar];
    }).flat();

    // Ajouter la ligne d'aujourd'hui
    const todayLine = {
        x: [daysElapsed, daysElapsed],
        y: [-0.5, tasks.length - 0.5],
        type: 'scatter',
        mode: 'lines',
        line: { color: '#dc2626', width: 3, dash: 'dash' },
        name: 'Aujourd\'hui',
        showlegend: true
    };

    const layout = {
        title: {
            text: 'Planning du Projet - Vue d\'Ensemble',
            font: { size: 16, color: '#374151' }
        },
        xaxis: {
            title: 'Jours du projet',
            range: [0, 70],
            tickvals: [0, 10, 20, 30, 40, 50, 60, 70],
            ticktext: ['J0', 'J10', 'J20', 'J30', 'J40', 'J50', 'J60', 'J70']
        },
        yaxis: {
            title: '',
            tickvals: tasks.map((_, i) => i),
            ticktext: tasks.map(t => t.name),
            range: [-0.5, tasks.length - 0.5]
        },
        margin: { t: 60, r: 20, b: 60, l: 150 },
        plot_bgcolor: '#f9fafb',
        paper_bgcolor: '#ffffff',
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255,255,255,0.8)'
        },
        annotations: [{
            x: daysElapsed,
            y: tasks.length - 0.3,
            text: `Aujourd'hui<br>Jour ${daysElapsed}`,
            showarrow: true,
            arrowhead: 2,
            arrowcolor: '#dc2626',
            font: { color: '#dc2626', size: 10 }
        }]
    };

    Plotly.newPlot(timelineChart, [...traces, todayLine], layout, { responsive: true });
}

function updateAlerts() {
    const alertSection = document.getElementById('alertSection');
    if (!alertSection) return;

    const criticalBottlenecks = appState.bottlenecks.filter(b => b.severity === 'critical');

    if (criticalBottlenecks.length > 0) {
        alertSection.innerHTML = `
            <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <div class="flex">
                    <div class="py-1">
                        <i class="fas fa-exclamation-triangle text-red-500 mr-3"></i>
                    </div>
                    <div>
                        <p class="font-bold">Alerte Critique</p>
                        <p>${escapeHTML(criticalBottlenecks[0].message)}</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        alertSection.innerHTML = '';
    }
}

function updateRecommendations() {
    const recommendationsList = document.getElementById('recommendationsList');
    if (!recommendationsList) return;

    const highPriorityRecs = appState.recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');

    recommendationsList.innerHTML = highPriorityRecs.length > 0 ?
        highPriorityRecs.map(rec => `
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <i class="fas fa-lightbulb text-yellow-400"></i>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-yellow-700">${escapeHTML(rec.message)}</p>
                    </div>
                </div>
            </div>
        `).join('') :
        '<p class="text-gray-500 text-center">Aucune recommandation pour le moment</p>';
}

// ============================================================================
// GESTION DES PARAMÈTRES
// ============================================================================

// `loadMaterialRequests` original implementation removed — consolidated
// to a single implementation later in the file to avoid duplicates.

// Global event delegation for data-* actions (covers static and dynamic elements)
document.addEventListener('click', function (e) {
    try {
        const target = e.target.closest && e.target.closest('[data-action],[data-edit-timestamp],[data-delete-timestamp],[data-cancel-request],[data-sim],[data-scenario],[data-export],[data-report-type]');
        if (!target) return;

        // Generic data-action handlers
        const action = target.dataset && target.dataset.action;
        if (action) {
            if (action === 'save-parameters') return typeof saveParameters === 'function' ? saveParameters() : null;
            if (action === 'reset-defaults') return typeof resetToDefaults === 'function' ? resetToDefaults() : null;
            if (action === 'load-optimized') return typeof loadOptimizedConfig === 'function' ? loadOptimizedConfig() : null;
            if (action === 'export-parameters') return typeof exportParameters === 'function' ? exportParameters() : null;
            if (action === 'import-appstate') return typeof importAppState === 'function' ? importAppState() : null;
            if (action === 'manual-sync') return typeof manualSync === 'function' ? manualSync() : null;
            if (action === 'add-material-request') return typeof addMaterialRequest === 'function' ? addMaterialRequest() : null;
            if (action === 'sync-data') return typeof syncData === 'function' ? syncData() : null;
        }

        // Edit / Delete terrain entries
        if (target.dataset.editTimestamp) {
            return typeof editTerrainEntry === 'function' ? editTerrainEntry(target.dataset.editTimestamp) : null;
        }
        if (target.dataset.deleteTimestamp) {
            return typeof deleteTerrainEntry === 'function' ? deleteTerrainEntry(target.dataset.deleteTimestamp) : null;
        }

        // Cancel material request
        if (target.dataset.cancelRequest) {
            return typeof cancelMaterialRequest === 'function' ? cancelMaterialRequest(target.dataset.cancelRequest) : null;
        }

        // Simulation controls
        if (target.dataset.sim) {
            const cmd = target.dataset.sim;
            if (cmd === 'run') return typeof runSimulation === 'function' ? runSimulation() : null;
            if (cmd === 'compare') return typeof compareScenarios === 'function' ? compareScenarios() : null;
            if (cmd === 'reset') return typeof resetSimulation === 'function' ? resetSimulation() : null;
        }

        // Preset scenarios
        if (target.dataset.scenario) {
            return typeof loadScenario === 'function' ? loadScenario(target.dataset.scenario) : null;
        }

        // Exports
        if (target.dataset.export === 'pdf') return typeof exportToPDF === 'function' ? exportToPDF() : null;
        if (target.dataset.export === 'excel') return typeof exportToExcel === 'function' ? exportToExcel() : null;

        // Reports fallback
        if (target.dataset.reportType) return typeof generateReport === 'function' ? generateReport(target.dataset.reportType) : null;
    } catch (err) {
        console.error('Delegation handler error', err);
    }
});

async function saveParameters() {
    // Sauvegarder les paramètres du projet (lecture des champs de la page `parametres.html`)
    const totalHousesElement = document.getElementById('totalHouses');
    if (totalHousesElement) {
        appState.project.totalHouses = parseInt(totalHousesElement.value) || 1000;
    }

    const startDateElement = document.getElementById('projectStartDate');
    if (startDateElement && startDateElement.value) {
        appState.project.startDate = new Date(startDateElement.value);
    }

    // Lister et sauvegarder les paramètres numériques courants s'ils existent
    const mapField = (id, targetKey) => {
        const el = document.getElementById(id);
        if (!el) return;
        const val = el.type === 'number' ? (el.value === '' ? null : parseFloat(el.value)) : el.value;
        if (val !== null && val !== undefined && val !== '') appState.parameters[targetKey] = val;
    };

    mapField('averageDistance', 'averageDistance');
    mapField('unforeseenRate', 'unforeseenRate');

    // Teams
    mapField('prepTeams', 'prepTeams');
    mapField('loaderTeams', 'loaderTeams');
    mapField('deliveryTeams', 'deliveryTeams');
    mapField('masonTeams', 'masonTeams');
    mapField('networkElectricianTeams', 'networkElectricianTeams');
    mapField('interiorElectricianType1Teams', 'interiorElectricianType1Teams');
    mapField('interiorElectricianType2Teams', 'interiorElectricianType2Teams');
    mapField('controllerTeams', 'controllerTeams');

    // Rates
    mapField('prepRate', 'prepRate');
    mapField('deliveryRate', 'deliveryRate');
    mapField('masonRate', 'masonRate');
    mapField('networkRate', 'networkRate');
    mapField('interiorRateType1', 'interiorRateType1');
    mapField('interiorRateType2', 'interiorRateType2');
    mapField('controlRate', 'controlRate');

    // Répartition & effectifs
    mapField('interiorType1SharePercent', 'interiorType1SharePercent');
    mapField('supervisorCount', 'supervisorCount');
    mapField('deliveryAgentCount', 'deliveryAgentCount');
    mapField('driverCount', 'driverCount');

    // Véhicules et acquisition
    mapField('pmVehicleCount', 'pmVehicleCount');
    const pmAcqEl = document.getElementById('pmVehicleAcquisition'); if (pmAcqEl) appState.parameters.pmVehicleAcquisition = pmAcqEl.value;
    mapField('controllerVehicleCount', 'controllerVehicleCount');
    const ctrlAcqEl = document.getElementById('controllerVehicleAcquisition'); if (ctrlAcqEl) appState.parameters.controllerVehicleAcquisition = ctrlAcqEl.value;
    mapField('networkInstallerVehicleCount', 'networkInstallerVehicleCount');
    const netInstAcqEl = document.getElementById('networkInstallerVehicleAcquisition'); if (netInstAcqEl) appState.parameters.networkInstallerVehicleAcquisition = netInstAcqEl.value;
    mapField('deliveryTruckCount', 'deliveryTruckCount');
    const truckAcqEl = document.getElementById('deliveryTruckAcquisition'); if (truckAcqEl) appState.parameters.deliveryTruckAcquisition = truckAcqEl.value;

    // Costs / logistic
    mapField('dailyTeamCost', 'dailyTeamCost');
    mapField('truckCapacity', 'truckCapacity');
    mapField('deliveryDelay', 'deliveryDelay');
    mapField('resourceAvailability', 'resourceAvailability');
    mapField('automationLevel', 'automationLevel');

    // Mettre à jour l'état et sauvegarder localement et dans IndexedDB
    updateAppState();
    saveToLocalStorage();
    try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (saveParameters)', e); }

    // Afficher un message de confirmation
    showNotification('Paramètres enregistrés avec succès', 'success');
}

function loadParameters() {
    try {
        // Project
        const totalHousesElement = document.getElementById('totalHouses');
        if (totalHousesElement) totalHousesElement.value = appState.project.totalHouses || '';

        const startDateElement = document.getElementById('projectStartDate');
        if (startDateElement && appState.project.startDate) {
            startDateElement.value = new Date(appState.project.startDate).toISOString().slice(0, 10);
        }

        // Generic mapping helper
        const mapFieldSet = (id, sourceKey) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = appState.parameters && appState.parameters[sourceKey] !== undefined ? appState.parameters[sourceKey] : '';
            el.value = val;
        };

        // Numeric / parameter fields
        ['averageDistance', 'unforeseenRate', 'prepTeams', 'loaderTeams', 'deliveryTeams', 'masonTeams',
            'networkElectricianTeams', 'interiorElectricianType1Teams', 'interiorElectricianType2Teams', 'controllerTeams', 'prepRate', 'deliveryRate',
            'masonRate', 'networkRate', 'interiorRateType1', 'interiorRateType2', 'controlRate', 'dailyTeamCost', 'truckCapacity', 'deliveryDelay',
            'resourceAvailability', 'automationLevel', 'interiorType1SharePercent', 'supervisorCount', 'deliveryAgentCount', 'driverCount']
            .forEach(k => mapFieldSet(k, k));

        // Vehicle fields
        ['pmVehicleCount', 'pmVehicleAcquisition', 'controllerVehicleCount', 'controllerVehicleAcquisition', 'networkInstallerVehicleCount', 'networkInstallerVehicleAcquisition', 'deliveryTruckCount', 'deliveryTruckAcquisition', 'pmVehiclePurchaseCost', 'pmVehicleRentPerDay', 'controllerVehiclePurchaseCost', 'controllerVehicleRentPerDay', 'networkInstallerVehiclePurchaseCost', 'networkInstallerVehicleRentPerDay', 'deliveryTruckPurchaseCost', 'deliveryTruckRentPerDay']
            .forEach(k => mapFieldSet(k, k));

        // After loading parameters into the form, rebuild app state and refresh dashboard
        try {
            updateAppState();
            updateDashboard();
        } catch (e) { console.warn('Error updating dashboard after loadParameters', e); }

        // Initialize Zone Management UI
        try { setupZoneManagement(); } catch (e) { console.warn('Error setting up zone management', e); }

        showNotification('Paramètres chargés', 'info');
    } catch (e) {
        console.warn('Erreur loadParameters', e);
    }
}

async function resetToDefaults() {
    // Réinitialiser aux valeurs par défaut
    appState.parameters = {
        prepTeams: 2,
        loaderTeams: 2,
        deliveryTeams: 4,
        masonTeams: 6,
        networkElectricianTeams: 8,
        interiorElectricianType1Teams: 6,
        interiorElectricianType2Teams: 4,
        controllerTeams: 2,
        prepRate: 50,
        deliveryRate: 25,
        masonRate: 8,
        networkRate: 17,
        interiorRateType1: 1.5,
        interiorRateType2: 3,
        controlRate: 20,
        dailyTeamCost: 80000,
        truckCapacity: 50,
        deliveryDelay: 3,
        averageDistance: 2.5,
        unforeseenRate: 15,
        resourceAvailability: 85,
        automationLevel: 60,
        // répartition par défaut (percent pour type1)
        interiorType1SharePercent: 60,
        // effectifs (personnes)
        supervisorCount: 1,
        deliveryAgentCount: 2,
        driverCount: 2
        ,
        // véhicules et coûts par défaut
        pmVehicleCount: 1,
        pmVehicleAcquisition: 'acheter',
        controllerVehicleCount: 1,
        controllerVehicleAcquisition: 'acheter',
        networkInstallerVehicleCount: 2,
        networkInstallerVehicleAcquisition: 'acheter',
        deliveryTruckCount: 2,
        deliveryTruckAcquisition: 'acheter',
        pmVehiclePurchaseCost: 40000000,
        pmVehicleRentPerDay: 20000,
        controllerVehiclePurchaseCost: 30000000,
        controllerVehicleRentPerDay: 15000,
        networkInstallerVehiclePurchaseCost: 35000000,
        networkInstallerVehicleRentPerDay: 18000,
        deliveryTruckPurchaseCost: 25000000,
        deliveryTruckRentPerDay: 30000
    };

    appState.project.totalHouses = 1000;
    appState.project.startDate = new Date();

    loadParameters();
    // Persist defaults to both localStorage and IndexedDB
    try {
        await updateAndPersistAppState();
    } catch (e) {
        console.warn('Persist defaults failed', e);
    }
    showNotification('Paramètres réinitialisés', 'info');
}

async function loadOptimizedConfig() {
    // Configuration optimisée basée sur l'analyse
    appState.parameters = {
        prepTeams: 3,
        loaderTeams: 2,
        deliveryTeams: 5,
        masonTeams: 8,
        networkElectricianTeams: 12,
        interiorElectricianType1Teams: 9,
        interiorElectricianType2Teams: 6,
        controllerTeams: 3,
        prepRate: 55,
        deliveryRate: 30,
        masonRate: 10,
        networkRate: 20,
        interiorRateType1: 1.8,
        interiorRateType2: 3.2,
        controlRate: 25,
        dailyTeamCost: 80000,
        truckCapacity: 60,
        deliveryDelay: 2,
        averageDistance: 2.5,
        unforeseenRate: 10,
        resourceAvailability: 90,
        automationLevel: 75,
        interiorType1SharePercent: 60,
        supervisorCount: 1,
        deliveryAgentCount: 2,
        driverCount: 2
        ,
        pmVehicleCount: 1,
        pmVehicleAcquisition: 'acheter',
        controllerVehicleCount: 1,
        controllerVehicleAcquisition: 'acheter',
        networkInstallerVehicleCount: 2,
        networkInstallerVehicleAcquisition: 'acheter',
        deliveryTruckCount: 2,
        deliveryTruckAcquisition: 'acheter',
        pmVehiclePurchaseCost: 40000000,
        pmVehicleRentPerDay: 20000,
        controllerVehiclePurchaseCost: 30000000,
        controllerVehicleRentPerDay: 15000,
        networkInstallerVehiclePurchaseCost: 35000000,
        networkInstallerVehicleRentPerDay: 18000,
        deliveryTruckPurchaseCost: 25000000,
        deliveryTruckRentPerDay: 30000
    };

    loadParameters();
    updateAppState();
    try { await updateAndPersistAppState(); } catch (e) { console.warn('Persist optimized config failed', e); }
    showNotification('Configuration optimisée chargée', 'success');
}

function exportParameters() {
    try {
        const dataStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `electrification-appstate-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showNotification('Export terminé', 'success');
    } catch (e) {
        console.error('exportParameters failed', e);
        showNotification('Erreur export', 'error');
    }
}

function importAppState() {
    const input = document.getElementById('backupFileInput');
    if (!input) {
        showNotification('Champ d\'import introuvable', 'error');
        return;
    }
    input.click();
}

async function importAppStateFile(file) {
    try {
        const text = await readFileAsText(file);
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object') throw new Error('Fichier JSON invalide');

        // Basic schema validation
        if (!obj.parameters || typeof obj.parameters !== 'object') throw new Error('Structure invalide: paramètres manquants');
        if (!obj.project || typeof obj.project !== 'object') throw new Error('Structure invalide: projet manquant');

        // Merge cautiously
        appState = { ...appState, ...obj };
        try { ensureVehicleDefaults(appState.parameters); } catch (e) { /* ignore */ }
        await updateAndPersistAppState();
        try { loadParameters(); } catch (e) { /* ignore */ }
        try { updateAppState(); updateDashboard(); } catch (e) { /* ignore */ }
        try { loadTodayProgress(); } catch (e) { /* ignore */ }
        try { if (typeof renderHouseholdsOnMap === 'function') renderHouseholdsOnMap(); } catch (e) { /* ignore */ }
        document.dispatchEvent(new CustomEvent('zonesUpdated'));
        showNotification('Import de sauvegarde réussi', 'success');
    } catch (e) {
        console.error('importAppStateFile failed', e);
        showNotification('Erreur lors de l\'import de la sauvegarde', 'error');
    }
}

// ============================================================================
// GESTION DES ZONES (NOUVEAU)
// ============================================================================

function setupZoneManagement() {
    const container = document.getElementById('zonesContainer');
    const addBtn = document.getElementById('addZoneBtn');
    const totalHousesInput = document.getElementById('totalHouses');
    const allocationToggle = document.getElementById('allocationModeToggle');
    const allocationLabel = document.getElementById('allocationModeLabel');

    if (!container || !addBtn) return;

    // Ensure zones array exists
    if (!Array.isArray(appState.project.zones)) {
        appState.project.zones = [];
    }

    // Initialize allocation mode
    if (!appState.project.allocationMode) {
        appState.project.allocationMode = 'auto';
    }

    // Set toggle state
    if (allocationToggle) {
        allocationToggle.checked = appState.project.allocationMode === 'manual';
        if (allocationLabel) {
            allocationLabel.textContent = appState.project.allocationMode === 'manual' ? 'Manuel' : 'Automatique';
        }

        // Wire toggle change
        allocationToggle.onchange = function () {
            appState.project.allocationMode = this.checked ? 'manual' : 'auto';
            if (allocationLabel) {
                allocationLabel.textContent = this.checked ? 'Manuel' : 'Automatique';
            }
            renderZones(); // Re-render to show/hide team inputs
        };
    }

    // Render existing zones
    renderZones();

    // Initial notification
    document.dispatchEvent(new CustomEvent('zonesUpdated'));

    // Wire Add Button
    addBtn.onclick = () => {
        addZone();
    };

    // Make totalHouses read-only if zones exist
    if (appState.project.zones.length > 0) {
        if (totalHousesInput) {
            totalHousesInput.readOnly = true;
            totalHousesInput.classList.add('bg-gray-100');
        }
    }
}

function renderZones() {
    const container = document.getElementById('zonesContainer');
    const totalHousesInput = document.getElementById('totalHouses');
    if (!container) return;

    container.innerHTML = '';
    const zones = appState.project.zones || [];
    const isManual = appState.project.allocationMode === 'manual';

    if (zones.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 italic">Aucune zone définie. Le nombre total de ménages est géré manuellement.</p>';
        if (totalHousesInput) {
            totalHousesInput.readOnly = false;
            totalHousesInput.classList.remove('bg-gray-100');
        }
        return;
    }

    // Calculate total from zones
    let calculatedTotal = 0;

    zones.forEach((zone, index) => {
        calculatedTotal += (parseInt(zone.houses) || 0);

        // Ensure teams object exists
        if (!zone.teams) {
            zone.teams = {
                preparateurs: 0, livraison: 0, macons: 0, reseau: 0,
                interiorType1: 0, interiorType2: 0, controle: 0
            };
        }

        const div = document.createElement('div');
        div.className = 'border rounded-lg p-4 bg-white shadow-sm';

        let html = `
            <div class="flex items-center gap-2 mb-3">
                <div class="flex-1">
                    <input type="text" value="${escapeHTML(zone.name)}" placeholder="Nom de la région"
                        class="w-full px-3 py-2 text-sm font-medium border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        onchange="updateZone(${index}, 'name', this.value)">
                </div>
                <div class="w-32">
                    <input type="number" value="${zone.houses}" placeholder="Ménages" min="0"
                        class="w-full px-3 py-2 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500"
                        onchange="updateZone(${index}, 'houses', this.value)">
                </div>
                <button onclick="removeZone(${index})" class="text-red-500 hover:text-red-700 p-2" title="Supprimer la zone">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        // Add team inputs if manual mode
        if (isManual) {
            html += `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t">
                    <div>
                        <label class="text-xs text-gray-600">Préparateurs</label>
                        <input type="number" value="${zone.teams.preparateurs || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'preparateurs', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Livraison</label>
                        <input type="number" value="${zone.teams.livraison || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'livraison', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Maçons</label>
                        <input type="number" value="${zone.teams.macons || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'macons', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Réseau</label>
                        <input type="number" value="${zone.teams.reseau || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'reseau', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Int. Type 1</label>
                        <input type="number" value="${zone.teams.interiorType1 || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'interiorType1', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Int. Type 2</label>
                        <input type="number" value="${zone.teams.interiorType2 || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'interiorType2', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-600">Contrôle</label>
                        <input type="number" value="${zone.teams.controle || 0}" min="0"
                            class="w-full px-2 py-1 text-sm border rounded"
                            onchange="updateZoneTeam(${index}, 'controle', this.value)">
                    </div>
                </div>
            `;
        }

        div.innerHTML = html;
        container.appendChild(div);
    });

    // Update total houses input
    if (totalHousesInput) {
        totalHousesInput.value = calculatedTotal;
        totalHousesInput.readOnly = true;
        totalHousesInput.classList.add('bg-gray-100');
        // Update appState as well
        appState.project.totalHouses = calculatedTotal;
    }

    // Update teams summary display
    updateTeamsSummary();
}

function addZone() {
    const zones = appState.project.zones || [];
    const newId = zones.length + 1;
    const zone = {
        id: Date.now().toString(), // Unique ID
        name: `Zone ${newId}`,
        houses: 100
    };
    zones.push(zone);
    appState.project.zones = zones;
    renderZones();
    // Trigger save to persist immediately? Or wait for global save?
    // Let's wait for global save, but update UI state.
    emitZoneChange('zoneAdded', { zone });
}

function removeZone(index) {
    if (!appState.project.zones) return;
    const removed = appState.project.zones[index];
    appState.project.zones.splice(index, 1);
    renderZones();
    emitZoneChange('zoneRemoved', { zone: removed });
}

// Global scope for inline onclick handlers
window.updateZone = function (index, field, value) {
    if (!appState.project.zones || !appState.project.zones[index]) return;
    if (field === 'houses') {
        appState.project.zones[index][field] = parseInt(value) || 0;
        renderZones(); // Re-render to update total
    } else {
        appState.project.zones[index][field] = value;
    }
    emitZoneChange('zonesUpdated');
};

window.updateZoneTeam = function (index, teamType, value) {
    if (!appState.project.zones || !appState.project.zones[index]) return;
    if (!appState.project.zones[index].teams) {
        appState.project.zones[index].teams = {};
    }
    appState.project.zones[index].teams[teamType] = parseInt(value) || 0;
    // Update teams summary when zone teams change
    updateTeamsSummary();
    emitZoneChange('zonesUpdated');
};

// Calculate and display total teams from all zones
function updateTeamsSummary() {
    const zones = appState.project.zones || [];
    const totals = {
        preparateurs: 0,
        livraison: 0,
        macons: 0,
        reseau: 0,
        interiorType1: 0,
        interiorType2: 0,
        controle: 0
    };

    // Sum teams from all zones
    zones.forEach(zone => {
        if (zone.teams) {
            totals.preparateurs += zone.teams.preparateurs || 0;
            totals.livraison += zone.teams.livraison || 0;
            totals.macons += zone.teams.macons || 0;
            totals.reseau += zone.teams.reseau || 0;
            totals.interiorType1 += zone.teams.interiorType1 || 0;
            totals.interiorType2 += zone.teams.interiorType2 || 0;
            totals.controle += zone.teams.controle || 0;
        }
    });

    // Update appState.parameters with totals
    appState.parameters.prepTeams = totals.preparateurs;
    appState.parameters.deliveryTeams = totals.livraison;
    appState.parameters.masonTeams = totals.macons;
    appState.parameters.networkElectricianTeams = totals.reseau;
    appState.parameters.interiorElectricianType1Teams = totals.interiorType1;
    appState.parameters.interiorElectricianType2Teams = totals.interiorType2;
    appState.parameters.controllerTeams = totals.controle;

    // Update UI display
    const totalPrepEl = document.getElementById('totalPrepTeams');
    const totalDeliveryEl = document.getElementById('totalDeliveryTeams');
    const totalMasonEl = document.getElementById('totalMasonTeams');
    const totalNetworkEl = document.getElementById('totalNetworkTeams');
    const totalInteriorType1El = document.getElementById('totalInteriorType1Teams');
    const totalInteriorType2El = document.getElementById('totalInteriorType2Teams');
    const totalControllerEl = document.getElementById('totalControllerTeams');
    const totalAllEl = document.getElementById('totalAllTeams');

    if (totalPrepEl) totalPrepEl.textContent = totals.preparateurs;
    if (totalDeliveryEl) totalDeliveryEl.textContent = totals.livraison;
    if (totalMasonEl) totalMasonEl.textContent = totals.macons;
    if (totalNetworkEl) totalNetworkEl.textContent = totals.reseau;
    if (totalInteriorType1El) totalInteriorType1El.textContent = totals.interiorType1;
    if (totalInteriorType2El) totalInteriorType2El.textContent = totals.interiorType2;
    if (totalControllerEl) totalControllerEl.textContent = totals.controle;

    const grandTotal = totals.preparateurs + totals.livraison + totals.macons +
        totals.reseau + totals.interiorType1 + totals.interiorType2 + totals.controle;
    if (totalAllEl) totalAllEl.textContent = grandTotal;

    // Also update staff summary in Rémunération panel
    updateStaffSummary(totals, grandTotal);
}

// Update staff summary in Rémunération & Effectifs panel
function updateStaffSummary(totals, grandTotal) {
    if (!totals) {
        // Recalculate if not provided
        const zones = appState.project.zones || [];
        totals = {
            preparateurs: 0,
            livraison: 0,
            macons: 0,
            reseau: 0,
            interiorType1: 0,
            interiorType2: 0,
            controle: 0
        };
        zones.forEach(zone => {
            if (zone.teams) {
                totals.preparateurs += zone.teams.preparateurs || 0;
                totals.livraison += zone.teams.livraison || 0;
                totals.macons += zone.teams.macons || 0;
                totals.reseau += zone.teams.reseau || 0;
                totals.interiorType1 += zone.teams.interiorType1 || 0;
                totals.interiorType2 += zone.teams.interiorType2 || 0;
                totals.controle += zone.teams.controle || 0;
            }
        });
        grandTotal = totals.preparateurs + totals.livraison + totals.macons +
            totals.reseau + totals.interiorType1 + totals.interiorType2 + totals.controle;
    }

    // Update operational teams display
    const staffPrepEl = document.getElementById('staffPrepTeams');
    const staffDeliveryEl = document.getElementById('staffDeliveryTeams');
    const staffMasonEl = document.getElementById('staffMasonTeams');
    const staffNetworkEl = document.getElementById('staffNetworkTeams');
    const staffInteriorType1El = document.getElementById('staffInteriorType1Teams');
    const staffInteriorType2El = document.getElementById('staffInteriorType2Teams');
    const staffControllerEl = document.getElementById('staffControllerTeams');

    if (staffPrepEl) staffPrepEl.textContent = totals.preparateurs;
    if (staffDeliveryEl) staffDeliveryEl.textContent = totals.livraison;
    if (staffMasonEl) staffMasonEl.textContent = totals.macons;
    if (staffNetworkEl) staffNetworkEl.textContent = totals.reseau;
    if (staffInteriorType1El) staffInteriorType1El.textContent = totals.interiorType1;
    if (staffInteriorType2El) staffInteriorType2El.textContent = totals.interiorType2;
    if (staffControllerEl) staffControllerEl.textContent = totals.controle;

    // Calculate support staff
    const totalHouses = appState.project.totalHouses || 0;
    const supervisorCount = Math.ceil(grandTotal / 10); // 1 for 10 teams
    const deliveryAgentCount = Math.ceil(totalHouses / 500); // 1 for 500 houses
    const driverCount = totals.livraison; // 1 per delivery team

    // Update support staff display
    const staffSupervisorEl = document.getElementById('staffSupervisorCount');
    const staffDeliveryAgentEl = document.getElementById('staffDeliveryAgentCount');
    const staffDriverEl = document.getElementById('staffDriverCount');

    if (staffSupervisorEl) staffSupervisorEl.textContent = supervisorCount;
    if (staffDeliveryAgentEl) staffDeliveryAgentEl.textContent = deliveryAgentCount;
    if (staffDriverEl) staffDriverEl.textContent = driverCount;

    // Update hidden fields for backward compatibility
    const supervisorCountInput = document.getElementById('supervisorCount');
    const deliveryAgentCountInput = document.getElementById('deliveryAgentCount');
    const driverCountInput = document.getElementById('driverCount');

    if (supervisorCountInput) supervisorCountInput.value = supervisorCount;
    if (deliveryAgentCountInput) deliveryAgentCountInput.value = deliveryAgentCount;
    if (driverCountInput) driverCountInput.value = driverCount;

    // Update appState
    appState.parameters.supervisorCount = supervisorCount;
    appState.parameters.deliveryAgentCount = deliveryAgentCount;
    appState.parameters.driverCount = driverCount;

    // Calculate and update costs
    calculateAndUpdateLaborCosts(totals, supervisorCount, deliveryAgentCount, driverCount);

    // Calculate and update logistics
    calculateLogistics();
}

// Calculate and update labor costs
function calculateAndUpdateLaborCosts(totals, supervisorCount, deliveryAgentCount, driverCount) {
    const duration = appState.project.duration || 180; // days
    const totalHouses = appState.project.totalHouses || 0;

    // Get payment modes
    const paymentModes = {
        prep: document.getElementById('paymentPrep')?.value || 'daily',
        delivery: document.getElementById('paymentLiv')?.value || 'daily',
        macons: document.getElementById('paymentMacons')?.value || 'daily',
        reseau: document.getElementById('paymentReseau')?.value || 'daily',
        int1: document.getElementById('paymentInt1')?.value || 'daily',
        int2: document.getElementById('paymentInt2')?.value || 'daily',
        ctrl: document.getElementById('paymentCtrl')?.value || 'daily'
    };

    // Get daily rates
    const dailyRates = {
        prep: parseInt(document.getElementById('prepDailyRate')?.value) || 5000,
        delivery: parseInt(document.getElementById('deliveryDailyRate')?.value) || 6000,
        mason: parseInt(document.getElementById('masonDailyRate')?.value) || 8000,
        network: parseInt(document.getElementById('networkDailyRate')?.value) || 10000,
        int1: parseInt(document.getElementById('interiorType1DailyRate')?.value) || 9000,
        int2: parseInt(document.getElementById('interiorType2DailyRate')?.value) || 11000,
        controller: parseInt(document.getElementById('controllerDailyRate')?.value) || 7000,
        supervisor: parseInt(document.getElementById('supervisorDailyRate')?.value) || 15000,
        driver: parseInt(document.getElementById('driverDailyRate')?.value) || 6000,
        deliveryAgent: parseInt(document.getElementById('deliveryAgentDailyRate')?.value) || 5500
    };

    // Get task rates
    const taskRates = {
        prep: parseInt(document.getElementById('prepTaskRate')?.value) || 600,
        delivery: parseInt(document.getElementById('deliveryTaskRate')?.value) || 800,
        mason: parseInt(document.getElementById('masonTaskRate')?.value) || 2500,
        network: parseInt(document.getElementById('networkTaskRate')?.value) || 2000,
        int1: parseInt(document.getElementById('interiorType1TaskRate')?.value) || 1500,
        int2: parseInt(document.getElementById('interiorType2TaskRate')?.value) || 2200,
        controller: parseInt(document.getElementById('controllerTaskRate')?.value) || 800
    };

    let dailyCost = 0;

    // Calculate costs based on payment modes
    // Preparateurs
    if (paymentModes.prep === 'daily') {
        dailyCost += totals.preparateurs * dailyRates.prep;
    } else {
        // Per-task: total cost / duration
        const totalCost = totalHouses * taskRates.prep;
        dailyCost += totalCost / duration;
    }

    // Delivery
    if (paymentModes.delivery === 'daily') {
        dailyCost += totals.livraison * dailyRates.delivery;
    } else {
        const totalCost = totalHouses * taskRates.delivery;
        dailyCost += totalCost / duration;
    }

    // Macons
    if (paymentModes.macons === 'daily') {
        dailyCost += totals.macons * dailyRates.mason;
    } else if (paymentModes.macons === 'per-task') {
        const totalCost = totalHouses * taskRates.mason;
        dailyCost += totalCost / duration;
    } else if (paymentModes.macons === 'subcontract') {
        // Subcontracting: 45,000 or 48,000 per house
        const model = document.getElementById('masonryModel')?.value || 'model1_standard';
        const subcontractPrice = model === 'model1_standard' ? 45000 : 48000;
        const totalCost = totalHouses * subcontractPrice;
        dailyCost += totalCost / duration;
    }

    // Network
    if (paymentModes.reseau === 'daily') {
        dailyCost += totals.reseau * dailyRates.network;
    } else {
        const totalCost = totalHouses * taskRates.network;
        dailyCost += totalCost / duration;
    }

    // Interior Type 1
    const type1Houses = Math.round(totalHouses * 0.7); // 70% Type 1
    if (paymentModes.int1 === 'daily') {
        dailyCost += totals.interiorType1 * dailyRates.int1;
    } else {
        const totalCost = type1Houses * taskRates.int1;
        dailyCost += totalCost / duration;
    }

    // Interior Type 2
    const type2Houses = totalHouses - type1Houses;
    if (paymentModes.int2 === 'daily') {
        dailyCost += totals.interiorType2 * dailyRates.int2;
    } else {
        const totalCost = type2Houses * taskRates.int2;
        dailyCost += totalCost / duration;
    }

    // Controller
    if (paymentModes.ctrl === 'daily') {
        dailyCost += totals.controle * dailyRates.controller;
    } else {
        const totalCost = totalHouses * taskRates.controller;
        dailyCost += totalCost / duration;
    }

    // Support staff (always daily)
    dailyCost += supervisorCount * dailyRates.supervisor;
    dailyCost += deliveryAgentCount * dailyRates.deliveryAgent;
    dailyCost += driverCount * dailyRates.driver;

    // Chef de Projet (always 1)
    const pmDailyRate = parseInt(document.getElementById('pmDailyRate')?.value) || 50000;
    dailyCost += 1 * pmDailyRate;

    // Autre Personnel (optional)
    const logisticianCount = parseInt(document.getElementById('logisticianCount')?.value) || 0;
    const accountantCount = parseInt(document.getElementById('accountantCount')?.value) || 0;
    const secretaryCount = parseInt(document.getElementById('secretaryCount')?.value) || 0;
    const guardCount = parseInt(document.getElementById('guardCount')?.value) || 0;

    const logisticianRate = parseInt(document.getElementById('logisticianDailyRate')?.value) || 12000;
    const accountantRate = parseInt(document.getElementById('accountantDailyRate')?.value) || 15000;
    const secretaryRate = parseInt(document.getElementById('secretaryDailyRate')?.value) || 8000;
    const guardRate = parseInt(document.getElementById('guardDailyRate')?.value) || 4000;

    dailyCost += logisticianCount * logisticianRate;
    dailyCost += accountantCount * accountantRate;
    dailyCost += secretaryCount * secretaryRate;
    dailyCost += guardCount * guardRate;

    // Calculate monthly and project costs
    const monthlyCost = dailyCost * 30;
    const projectCost = dailyCost * duration;

    // Update UI
    const costDailyEl = document.getElementById('costDaily');
    const costMonthlyEl = document.getElementById('costMonthly');
    const costProjectEl = document.getElementById('costProject');

    if (costDailyEl) costDailyEl.textContent = Math.round(dailyCost).toLocaleString('fr-FR');
    if (costMonthlyEl) costMonthlyEl.textContent = Math.round(monthlyCost).toLocaleString('fr-FR');
    if (costProjectEl) costProjectEl.textContent = Math.round(projectCost).toLocaleString('fr-FR');
}

// Calculate logistics (vehicles, equipment, office supplies) based on staff and dotations
function calculateLogistics() {
    const duration = appState.project.duration || 180;

    // Get staff counts
    const staff = {
        pm: 1, // Always 1
        supervisors: parseInt(document.getElementById('staffSupervisorCount')?.textContent) || 0,
        controllers: parseInt(document.getElementById('staffControllerTeams')?.textContent) || 0,
        networkTeams: parseInt(document.getElementById('staffNetworkTeams')?.textContent) || 0,
        deliveryTeams: parseInt(document.getElementById('staffDeliveryTeams')?.textContent) || 0,
        masonTeams: parseInt(document.getElementById('staffMasonTeams')?.textContent) || 0,
        interiorType1Teams: parseInt(document.getElementById('staffInteriorType1Teams')?.textContent) || 0,
        interiorType2Teams: parseInt(document.getElementById('staffInteriorType2Teams')?.textContent) || 0,
        prepTeams: parseInt(document.getElementById('staffPrepTeams')?.textContent) || 0,
        logistician: parseInt(document.getElementById('logisticianCount')?.value) || 0,
        accountant: parseInt(document.getElementById('accountantCount')?.value) || 0,
        secretary: parseInt(document.getElementById('secretaryCount')?.value) || 0
    };

    // Get dotations ratios
    const dotations = {
        vehicles: {
            pm: {
                type: document.getElementById('dotVehiclePM')?.value || 'vehicule_leger',
                ratio: parseFloat(document.getElementById('dotVehiclePMRatio')?.value) || 1
            },
            supervisor: {
                type: document.getElementById('dotVehicleSupervisor')?.value || 'vehicule_leger',
                ratio: parseFloat(document.getElementById('dotVehicleSupervisorRatio')?.value) || 1
            },
            controller: {
                type: document.getElementById('dotVehicleController')?.value || 'vehicule_leger',
                ratio: parseFloat(document.getElementById('dotVehicleControllerRatio')?.value) || 0.5
            },
            network: {
                type: document.getElementById('dotVehicleNetwork')?.value || 'moto',
                ratio: parseFloat(document.getElementById('dotVehicleNetworkRatio')?.value) || 1
            },
            delivery: {
                type: document.getElementById('dotVehicleDelivery')?.value || 'camion',
                ratio: parseFloat(document.getElementById('dotVehicleDeliveryRatio')?.value) || 1
            }
        },
        kits: {
            controller: parseFloat(document.getElementById('dotKitController')?.value) || 1,
            network: parseFloat(document.getElementById('dotKitNetwork')?.value) || 1,
            interior: parseFloat(document.getElementById('dotKitInterior')?.value) || 1,
            mason: parseFloat(document.getElementById('dotKitMason')?.value) || 1,
            prep: parseFloat(document.getElementById('dotKitPrep')?.value) || 1,
            delivery: parseFloat(document.getElementById('dotKitDelivery')?.value) || 1
        },
        office: {
            pmComputer: document.getElementById('dotOfficePMComputer')?.checked || false,
            pmPhone: document.getElementById('dotOfficePMPhone')?.checked || false,
            pmPrinter: document.getElementById('dotOfficePMPrinter')?.checked || false,
            supervisorPhone: document.getElementById('dotOfficeSupervisorPhone')?.checked || false,
            supervisorTablet: document.getElementById('dotOfficeSupervisorTablet')?.checked || false,
            accountantComputer: document.getElementById('dotOfficeAccountantComputer')?.checked || false,
            accountantPrinter: document.getElementById('dotOfficeAccountantPrinter')?.checked || false,
            secretaryComputer: document.getElementById('dotOfficeSecretaryComputer')?.checked || false,
            secretaryPhone: document.getElementById('dotOfficeSecretaryPhone')?.checked || false
        }
    };

    // Calculate vehicle quantities
    const quantities = {
        vehiculeLeger: 0,
        camion: 0,
        moto: 0,
        kitController: 0,
        kitNetwork: 0,
        kitInterior: 0,
        kitMason: 0,
        kitPrep: 0,
        kitDelivery: 0,
        computer: 0,
        phone: 0,
        tablet: 0,
        printer: 0
    };

    // Vehicles
    if (dotations.vehicles.pm.type === 'vehicule_leger') quantities.vehiculeLeger += staff.pm * dotations.vehicles.pm.ratio;
    else if (dotations.vehicles.pm.type === 'moto') quantities.moto += staff.pm * dotations.vehicles.pm.ratio;
    else if (dotations.vehicles.pm.type === 'camion') quantities.camion += staff.pm * dotations.vehicles.pm.ratio;

    if (dotations.vehicles.supervisor.type === 'vehicule_leger') quantities.vehiculeLeger += staff.supervisors * dotations.vehicles.supervisor.ratio;
    else if (dotations.vehicles.supervisor.type === 'moto') quantities.moto += staff.supervisors * dotations.vehicles.supervisor.ratio;

    if (dotations.vehicles.controller.type === 'vehicule_leger') quantities.vehiculeLeger += staff.controllers * dotations.vehicles.controller.ratio;
    else if (dotations.vehicles.controller.type === 'moto') quantities.moto += staff.controllers * dotations.vehicles.controller.ratio;

    if (dotations.vehicles.network.type === 'vehicule_leger') quantities.vehiculeLeger += staff.networkTeams * dotations.vehicles.network.ratio;
    else if (dotations.vehicles.network.type === 'moto') quantities.moto += staff.networkTeams * dotations.vehicles.network.ratio;

    if (dotations.vehicles.delivery.type === 'vehicule_leger') quantities.vehiculeLeger += staff.deliveryTeams * dotations.vehicles.delivery.ratio;
    else if (dotations.vehicles.delivery.type === 'camion') quantities.camion += staff.deliveryTeams * dotations.vehicles.delivery.ratio;

    // Round up vehicles
    quantities.vehiculeLeger = Math.ceil(quantities.vehiculeLeger);
    quantities.camion = Math.ceil(quantities.camion);
    quantities.moto = Math.ceil(quantities.moto);

    // Equipment kits
    quantities.kitController = Math.ceil(staff.controllers * dotations.kits.controller);
    quantities.kitNetwork = Math.ceil(staff.networkTeams * dotations.kits.network);
    quantities.kitInterior = Math.ceil((staff.interiorType1Teams + staff.interiorType2Teams) * dotations.kits.interior);
    quantities.kitMason = Math.ceil(staff.masonTeams * dotations.kits.mason);
    quantities.kitPrep = Math.ceil(staff.prepTeams * dotations.kits.prep);
    quantities.kitDelivery = Math.ceil(staff.deliveryTeams * dotations.kits.delivery);

    // Office supplies
    if (dotations.office.pmComputer) quantities.computer += staff.pm;
    if (dotations.office.pmPhone) quantities.phone += staff.pm;
    if (dotations.office.pmPrinter) quantities.printer += staff.pm;
    if (dotations.office.supervisorPhone) quantities.phone += staff.supervisors;
    if (dotations.office.supervisorTablet) quantities.tablet += staff.supervisors;
    if (dotations.office.accountantComputer) quantities.computer += staff.accountant;
    if (dotations.office.accountantPrinter) quantities.printer += staff.accountant;
    if (dotations.office.secretaryComputer) quantities.computer += staff.secretary;
    if (dotations.office.secretaryPhone) quantities.phone += staff.secretary;

    // Update quantities display
    document.getElementById('qtyVehiculeLeger').textContent = quantities.vehiculeLeger;
    document.getElementById('qtyCamion').textContent = quantities.camion;
    document.getElementById('qtyMoto').textContent = quantities.moto;
    document.getElementById('qtyKitController').textContent = quantities.kitController;
    document.getElementById('qtyKitNetwork').textContent = quantities.kitNetwork;
    document.getElementById('qtyKitInterior').textContent = quantities.kitInterior;
    document.getElementById('qtyKitMason').textContent = quantities.kitMason;
    document.getElementById('qtyKitPrep').textContent = quantities.kitPrep;
    document.getElementById('qtyKitDelivery').textContent = quantities.kitDelivery;
    document.getElementById('qtyComputer').textContent = quantities.computer;
    document.getElementById('qtyPhone').textContent = quantities.phone;
    document.getElementById('qtyTablet').textContent = quantities.tablet;
    document.getElementById('qtyPrinter').textContent = quantities.printer;

    // Get prices
    const prices = {
        vehiculeLegerAchat: parseInt(document.getElementById('priceVehicleLegerAchat')?.value) || 8000000,
        vehiculeLegerLocation: parseInt(document.getElementById('priceVehicleLegerLocation')?.value) || 25000,
        camionAchat: parseInt(document.getElementById('priceCamionAchat')?.value) || 15000000,
        camionLocation: parseInt(document.getElementById('priceCamionLocation')?.value) || 40000,
        motoAchat: parseInt(document.getElementById('priceMotoAchat')?.value) || 800000,
        motoLocation: parseInt(document.getElementById('priceMotoLocation')?.value) || 5000,
        fuel: parseInt(document.getElementById('priceFuel')?.value) || 650,
        kitController: parseInt(document.getElementById('priceKitController')?.value) || 250000,
        kitNetwork: parseInt(document.getElementById('priceKitNetwork')?.value) || 200000,
        kitInterior: parseInt(document.getElementById('priceKitInterior')?.value) || 180000,
        kitMason: parseInt(document.getElementById('priceKitMason')?.value) || 150000,
        kitPrep: parseInt(document.getElementById('priceKitPrep')?.value) || 300000,
        kitDelivery: parseInt(document.getElementById('priceKitDelivery')?.value) || 100000,
        computer: parseInt(document.getElementById('priceComputer')?.value) || 500000,
        phone: parseInt(document.getElementById('pricePhone')?.value) || 100000,
        tablet: parseInt(document.getElementById('priceTablet')?.value) || 200000,
        printer: parseInt(document.getElementById('pricePrinter')?.value) || 150000
    };

    // Calculate costs - by role with their specific acquisition mode
    const acquisitionModes = {
        pm: document.getElementById('acquisitionModePM')?.value || 'achat',
        supervisor: document.getElementById('acquisitionModeSupervisor')?.value || 'achat',
        controller: document.getElementById('acquisitionModeController')?.value || 'achat',
        network: document.getElementById('acquisitionModeNetwork')?.value || 'achat',
        delivery: document.getElementById('acquisitionModeDelivery')?.value || 'achat'
    };

    let costVehiclesAcquisition = 0;

    // Chef de Projet
    const pmVehicleQty = staff.pm * dotations.vehicles.pm.ratio;
    if (dotations.vehicles.pm.type === 'vehicule_leger') {
        if (acquisitionModes.pm === 'achat') {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.vehiculeLegerAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.vehiculeLegerLocation * duration;
        }
    } else if (dotations.vehicles.pm.type === 'moto') {
        if (acquisitionModes.pm === 'achat') {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.motoAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.motoLocation * duration;
        }
    } else if (dotations.vehicles.pm.type === 'camion') {
        if (acquisitionModes.pm === 'achat') {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.camionAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(pmVehicleQty) * prices.camionLocation * duration;
        }
    }

    // Superviseur
    const supervisorVehicleQty = staff.supervisors * dotations.vehicles.supervisor.ratio;
    if (dotations.vehicles.supervisor.type === 'vehicule_leger') {
        if (acquisitionModes.supervisor === 'achat') {
            costVehiclesAcquisition += Math.ceil(supervisorVehicleQty) * prices.vehiculeLegerAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(supervisorVehicleQty) * prices.vehiculeLegerLocation * duration;
        }
    } else if (dotations.vehicles.supervisor.type === 'moto') {
        if (acquisitionModes.supervisor === 'achat') {
            costVehiclesAcquisition += Math.ceil(supervisorVehicleQty) * prices.motoAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(supervisorVehicleQty) * prices.motoLocation * duration;
        }
    }

    // Contrôleur
    const controllerVehicleQty = staff.controllers * dotations.vehicles.controller.ratio;
    if (dotations.vehicles.controller.type === 'vehicule_leger') {
        if (acquisitionModes.controller === 'achat') {
            costVehiclesAcquisition += Math.ceil(controllerVehicleQty) * prices.vehiculeLegerAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(controllerVehicleQty) * prices.vehiculeLegerLocation * duration;
        }
    } else if (dotations.vehicles.controller.type === 'moto') {
        if (acquisitionModes.controller === 'achat') {
            costVehiclesAcquisition += Math.ceil(controllerVehicleQty) * prices.motoAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(controllerVehicleQty) * prices.motoLocation * duration;
        }
    }

    // Réseau
    const networkVehicleQty = staff.networkTeams * dotations.vehicles.network.ratio;
    if (dotations.vehicles.network.type === 'vehicule_leger') {
        if (acquisitionModes.network === 'achat') {
            costVehiclesAcquisition += Math.ceil(networkVehicleQty) * prices.vehiculeLegerAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(networkVehicleQty) * prices.vehiculeLegerLocation * duration;
        }
    } else if (dotations.vehicles.network.type === 'moto') {
        if (acquisitionModes.network === 'achat') {
            costVehiclesAcquisition += Math.ceil(networkVehicleQty) * prices.motoAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(networkVehicleQty) * prices.motoLocation * duration;
        }
    }

    // Livraison
    const deliveryVehicleQty = staff.deliveryTeams * dotations.vehicles.delivery.ratio;
    if (dotations.vehicles.delivery.type === 'vehicule_leger') {
        if (acquisitionModes.delivery === 'achat') {
            costVehiclesAcquisition += Math.ceil(deliveryVehicleQty) * prices.vehiculeLegerAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(deliveryVehicleQty) * prices.vehiculeLegerLocation * duration;
        }
    } else if (dotations.vehicles.delivery.type === 'camion') {
        if (acquisitionModes.delivery === 'achat') {
            costVehiclesAcquisition += Math.ceil(deliveryVehicleQty) * prices.camionAchat;
        } else {
            costVehiclesAcquisition += Math.ceil(deliveryVehicleQty) * prices.camionLocation * duration;
        }
    }

    // Fuel costs (15L/day for light vehicles, 25L/day for trucks, 5L/day for motos)
    const costFuel =
        (quantities.vehiculeLeger * 15 * prices.fuel * duration) +
        (quantities.camion * 25 * prices.fuel * duration) +
        (quantities.moto * 5 * prices.fuel * duration);

    const costVehiclesTotal = costVehiclesAcquisition + costFuel;

    // Equipment costs
    const costEquipmentsPro =
        (quantities.kitController * prices.kitController) +
        (quantities.kitNetwork * prices.kitNetwork) +
        (quantities.kitInterior * prices.kitInterior) +
        (quantities.kitMason * prices.kitMason) +
        (quantities.kitPrep * prices.kitPrep) +
        (quantities.kitDelivery * prices.kitDelivery);

    const costEquipmentsOffice =
        (quantities.computer * prices.computer) +
        (quantities.phone * prices.phone) +
        (quantities.tablet * prices.tablet) +
        (quantities.printer * prices.printer);

    const costEquipmentsTotal = costEquipmentsPro + costEquipmentsOffice;

    const costLogisticsTotal = costVehiclesTotal + costEquipmentsTotal;

    // Update costs display
    document.getElementById('costVehiclesAcquisition').textContent = Math.round(costVehiclesAcquisition).toLocaleString('fr-FR');
    document.getElementById('costFuel').textContent = Math.round(costFuel).toLocaleString('fr-FR');
    document.getElementById('costVehiclesTotal').textContent = Math.round(costVehiclesTotal).toLocaleString('fr-FR');
    document.getElementById('costEquipmentsPro').textContent = Math.round(costEquipmentsPro).toLocaleString('fr-FR');
    document.getElementById('costEquipmentsOffice').textContent = Math.round(costEquipmentsOffice).toLocaleString('fr-FR');
    document.getElementById('costEquipmentsTotal').textContent = Math.round(costEquipmentsTotal).toLocaleString('fr-FR');
    document.getElementById('costLogisticsTotal').textContent = Math.round(costLogisticsTotal).toLocaleString('fr-FR');
}

// Setup realtime updates for all parameter fields
function setupRealtimeUpdates() {
    // Function to trigger all calculations
    const updateAllCalculations = () => {
        // Only update if we have staff data
        const hasStaff = document.getElementById('staffPrepTeams')?.textContent;
        if (hasStaff) {
            updateStaffSummary();
        }
    };

    // Attach to all payment mode selects (Rémunération panel)
    const paymentModeIds = [
        'paymentPrep', 'paymentLiv', 'paymentMacons', 'paymentReseau',
        'paymentInt1', 'paymentInt2', 'paymentCtrl', 'masonryModel'
    ];
    paymentModeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAllCalculations);
    });

    // Attach to all daily rate inputs (Rémunération panel)
    const dailyRateIds = [
        'prepDailyRate', 'deliveryDailyRate', 'masonDailyRate', 'networkDailyRate',
        'interiorType1DailyRate', 'interiorType2DailyRate', 'controllerDailyRate',
        'supervisorDailyRate', 'driverDailyRate', 'deliveryAgentDailyRate', 'pmDailyRate',
        'logisticianDailyRate', 'accountantDailyRate', 'secretaryDailyRate', 'guardDailyRate'
    ];
    dailyRateIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to all task rate inputs (Rémunération panel)
    const taskRateIds = [
        'prepTaskRate', 'deliveryTaskRate', 'masonTaskRate', 'networkTaskRate',
        'interiorType1TaskRate', 'interiorType2TaskRate', 'controllerTaskRate'
    ];
    taskRateIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to other personnel counts (Rémunération panel)
    const otherPersonnelIds = [
        'logisticianCount', 'accountantCount', 'secretaryCount', 'guardCount'
    ];
    otherPersonnelIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to all dotation vehicle selects (Logistique panel - Section 1)
    const dotVehicleIds = [
        'dotVehiclePM', 'dotVehicleSupervisor', 'dotVehicleController',
        'dotVehicleNetwork', 'dotVehicleDelivery'
    ];
    dotVehicleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAllCalculations);
    });

    // Attach to all dotation vehicle ratio inputs (Logistique panel - Section 1)
    const dotVehicleRatioIds = [
        'dotVehiclePMRatio', 'dotVehicleSupervisorRatio', 'dotVehicleControllerRatio',
        'dotVehicleNetworkRatio', 'dotVehicleDeliveryRatio'
    ];
    dotVehicleRatioIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to all dotation kit inputs (Logistique panel - Section 1)
    const dotKitIds = [
        'dotKitController', 'dotKitNetwork', 'dotKitInterior',
        'dotKitMason', 'dotKitPrep', 'dotKitDelivery'
    ];
    dotKitIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to all dotation office checkboxes (Logistique panel - Section 1)
    const dotOfficeIds = [
        'dotOfficePMComputer', 'dotOfficePMPhone', 'dotOfficePMPrinter',
        'dotOfficeSupervisorPhone', 'dotOfficeSupervisorTablet',
        'dotOfficeAccountantComputer', 'dotOfficeAccountantPrinter',
        'dotOfficeSecretaryComputer', 'dotOfficeSecretaryPhone'
    ];
    dotOfficeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAllCalculations);
    });

    // Attach to all price inputs (Logistique panel - Section 2)
    const priceIds = [
        'priceVehicleLegerAchat', 'priceVehicleLegerLocation',
        'priceCamionAchat', 'priceCamionLocation',
        'priceMotoAchat', 'priceMotoLocation', 'priceFuel',
        'priceKitController', 'priceKitNetwork', 'priceKitInterior',
        'priceKitMason', 'priceKitPrep', 'priceKitDelivery',
        'priceComputer', 'pricePhone', 'priceTablet', 'pricePrinter'
    ];
    priceIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAllCalculations);
    });

    // Attach to all acquisition mode selects (Logistique panel - Section 2)
    const acquisitionModeIds = [
        'acquisitionModePM', 'acquisitionModeSupervisor', 'acquisitionModeController',
        'acquisitionModeNetwork', 'acquisitionModeDelivery'
    ];
    acquisitionModeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAllCalculations);
    });

    console.log('✅ Realtime updates configured for all parameter fields');
}

// Initialize realtime updates when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRealtimeUpdates);
} else {
    setupRealtimeUpdates();
}


window.removeZone = removeZone;
window.addZone = addZone;

// Helper to notify UI components (like calculator_ui.js) of changes
function emitZoneChange(type, detail = {}) {
    try {
        const event = new CustomEvent(type, { detail });
        document.dispatchEvent(event);
        // Always dispatch generic update for broad listeners
        document.dispatchEvent(new CustomEvent('zonesUpdated'));
    } catch (e) {
        console.warn('Event dispatch failed', e);
    }
}

// ============================================================================
// FONCTIONS DE SIMULATION
// ============================================================================

function runSimulation() {
    // Récupérer les paramètres de simulation
    const simParams = {
        ...appState.parameters,
        masonTeams: parseInt(document.getElementById('simMasonTeams')?.value) || appState.parameters.masonTeams,
        networkElectricianTeams: parseInt(document.getElementById('simNetworkTeams')?.value) || appState.parameters.networkElectricianTeams,
        interiorElectricianType1Teams: parseInt(document.getElementById('simInteriorType1Teams')?.value) || appState.parameters.interiorElectricianType1Teams,
        interiorElectricianType2Teams: parseInt(document.getElementById('simInteriorType2Teams')?.value) || appState.parameters.interiorElectricianType2Teams,
        unforeseenRate: parseInt(document.getElementById('simUnforeseenRate')?.value) || appState.parameters.unforeseenRate
    };

    // Lancer la simulation (utilise le moteur `simulate`)
    const results = simulate(simParams);
    const currentResults = simulate(appState.parameters);

    // Afficher les résultats
    document.getElementById('simulationResults').style.display = 'grid';
    document.getElementById('simDuration').textContent = `${results.duration} jours`;
    document.getElementById('simCost').textContent = formatCurrency(results.totalCost);
    document.getElementById('simProductivity').textContent = `${results.productivity} ménages/j`;
    document.getElementById('simRisk').textContent = `${Math.round(results.risk)}%`;

    // Calculer les économies/gains
    const durationSaving = currentResults.duration - results.duration;
    const costSaving = currentResults.totalCost - results.totalCost;
    const productivityGain = ((results.productivity - currentResults.productivity) / currentResults.productivity * 100);
    const riskReduction = currentResults.risk - results.risk;

    document.getElementById('durationSaving').textContent = durationSaving > 0 ? `${durationSaving} jours` : `${Math.abs(durationSaving)} jours`;
    document.getElementById('costSaving').textContent = formatCurrency(Math.abs(costSaving));
    document.getElementById('productivityGain').textContent = `${Math.round(productivityGain)}%`;
    document.getElementById('riskReduction').textContent = `${Math.round(riskReduction)}%`;

    // Color coding
    document.getElementById('durationSaving').className = durationSaving > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600';
    document.getElementById('costSaving').className = costSaving > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600';
    document.getElementById('productivityGain').className = productivityGain > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600';
    document.getElementById('riskReduction').className = riskReduction > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600';

    showNotification('Simulation terminée', 'success');
}

function compareScenarios() {
    // Fonction de comparaison détaillée
    runSimulation();

    const comparisonSection = document.getElementById('comparisonSection');
    if (comparisonSection) {
        comparisonSection.style.display = 'block';
        updateComparisonTable();
    }
}

function updateComparisonTable() {
    const tbody = document.getElementById('comparisonTable');
    if (!tbody) return;

    const currentResults = simulate(appState.parameters);
    const simParams = {
        ...appState.parameters,
        masonTeams: parseInt(document.getElementById('simMasonTeams')?.value) || appState.parameters.masonTeams,
        networkElectricianTeams: parseInt(document.getElementById('simNetworkTeams')?.value) || appState.parameters.networkElectricianTeams,
        interiorElectricianType1Teams: parseInt(document.getElementById('simInteriorType1Teams')?.value) || appState.parameters.interiorElectricianType1Teams,
        interiorElectricianType2Teams: parseInt(document.getElementById('simInteriorType2Teams')?.value) || appState.parameters.interiorElectricianType2Teams,
        unforeseenRate: parseInt(document.getElementById('simUnforeseenRate')?.value) || appState.parameters.unforeseenRate
    };
    const newResults = simulate(simParams);

    const comparisons = [
        { parameter: 'Durée du projet (jours)', current: currentResults.duration, new: newResults.duration },
        { parameter: 'Coût total', current: formatCurrency(currentResults.totalCost), new: formatCurrency(newResults.totalCost) },
        { parameter: 'Productivité (ménages/jour)', current: currentResults.productivity, new: newResults.productivity },
        { parameter: 'Risque (%)', current: Math.round(currentResults.risk), new: Math.round(newResults.risk) },
        { parameter: 'Équipes Maçons', current: appState.parameters.masonTeams, new: simParams.masonTeams },
        { parameter: 'Équipes Réseau', current: appState.parameters.networkElectricianTeams, new: simParams.networkElectricianTeams },
        { parameter: 'Équipes Intérieur Type 1', current: appState.parameters.interiorElectricianType1Teams, new: simParams.interiorElectricianType1Teams },
        { parameter: 'Équipes Intérieur Type 2', current: appState.parameters.interiorElectricianType2Teams, new: simParams.interiorElectricianType2Teams }
    ];

    tbody.innerHTML = comparisons.map(comp => {
        const impact = comp.current < comp.new ? 'Négatif' : comp.current > comp.new ? 'Positif' : 'Neutre';
        const impactClass = comp.current < comp.new ? 'text-red-600' : comp.current > comp.new ? 'text-green-600' : 'text-gray-600';

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(comp.parameter)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHTML(String(comp.current))}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHTML(String(comp.new))}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${impactClass} font-medium">${escapeHTML(impact)}</td>
            </tr>
        `;
    }).join('');
}

function resetSimulation() {
    // Réinitialiser les champs de simulation
    document.getElementById('simMasonTeams').value = appState.parameters.masonTeams;
    document.getElementById('simNetworkTeams').value = appState.parameters.networkElectricianTeams;
    if (document.getElementById('simInteriorType1Teams')) document.getElementById('simInteriorType1Teams').value = appState.parameters.interiorElectricianType1Teams;
    if (document.getElementById('simInteriorType2Teams')) document.getElementById('simInteriorType2Teams').value = appState.parameters.interiorElectricianType2Teams;
    document.getElementById('simUnforeseenRate').value = appState.parameters.unforeseenRate;

    // Cacher les résultats
    document.getElementById('simulationResults').style.display = 'none';
    document.getElementById('comparisonSection').style.display = 'none';

    showNotification('Simulation réinitialisée', 'info');
}

function loadScenario(type) {
    let scenarioParams = {};

    switch (type) {
        case 'rapide':
            scenarioParams = {
                masonTeams: 10,
                networkElectricianTeams: 15,
                // répartir intérieur 60% type1 / 40% type2
                interiorElectricianType1Teams: 11,
                interiorElectricianType2Teams: 7,
                unforeseenRate: 5,
                resourceAvailability: 95
            };
            break;
        case 'economique':
            scenarioParams = {
                masonTeams: 4,
                networkElectricianTeams: 6,
                interiorElectricianType1Teams: 5,
                interiorElectricianType2Teams: 3,
                dailyTeamCost: 700,
                unforeseenRate: 20
            };
            break;
        case 'securise':
            scenarioParams = {
                masonTeams: 8,
                networkElectricianTeams: 10,
                interiorElectricianType1Teams: 8,
                interiorElectricianType2Teams: 4,
                unforeseenRate: 5,
                resourceAvailability: 95,
                automationLevel: 85
            };
            break;
    }

    // Mettre à jour les champs de simulation
    Object.keys(scenarioParams).forEach(key => {
        const element = document.getElementById('sim' + key.charAt(0).toUpperCase() + key.slice(1));
        if (element) {
            element.value = scenarioParams[key];
        }
    });

    showNotification(`Scénario ${type} chargé`, 'success');
}

// ============================================================================
// GESTION DES RAPPORTS
// ============================================================================

function generateReport(type) {
    const period = document.getElementById('reportPeriod')?.value || 'current';
    const format = document.getElementById('exportFormat')?.value || 'pdf';

    // Générer le contenu du rapport avec données réalistes
    const reportContent = generateReportContent(type, period);

    // Afficher l'aperçu
    const preview = document.getElementById('reportPreview');
    if (preview) {
        preview.innerHTML = reportContent;
    }

    // Ajouter les graphiques au rapport
    setTimeout(() => {
        initializeReportCharts();
    }, 100);

    showNotification(`Rapport ${type} généré avec succès`, 'success');
}

function generateReportContent(type, period) {
    const now = new Date();
    const reportDate = formatDate(now);
    const startDate = formatDate(appState.project.startDate);
    const currentDate = formatDate(appState.project.currentDate);
    const endDate = appState.project.endDate ? formatDate(appState.project.endDate) : 'En cours de calcul';

    // Calculer les métriques clés
    const totalTeams = Object.values(appState.teams).reduce((sum, team) => sum + team.active, 0);
    const totalCost = calculateCosts().totalCost;
    const consumedBudget = totalCost * (appState.project.progress / 100);
    const remainingBudget = totalCost - consumedBudget;
    const productivity = calculateProductivity(appState.parameters);
    const projectDuration = calculateProjectDuration();
    const remainingDays = Math.max(0, projectDuration - calculateDaysBetween(appState.project.startDate, appState.project.currentDate));

    let content = `
        <div class="bg-white p-6 rounded-lg">
            <!-- En-tête du rapport -->
            <div class="text-center mb-8 border-b border-gray-200 pb-6">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">Rapport ${type.charAt(0).toUpperCase() + type.slice(1)}</h1>
                <h2 class="text-xl text-gray-600 mb-4">Projet d'Électrification de Masse</h2>
                <div class="flex justify-center space-x-8 text-sm text-gray-500">
                    <span><strong>Généré le:</strong> ${escapeHTML(reportDate)}</span>
                    <span><strong>Période:</strong> ${escapeHTML(startDate)} - ${escapeHTML(currentDate)}</span>
                    <span><strong>Type:</strong> ${escapeHTML(type.charAt(0).toUpperCase() + type.slice(1))}</span>
                </div>
            </div>
            
            <!-- Résumé exécutif -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-8">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Résumé Exécutif</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${Math.round(appState.project.progress)}%</div>
                        <div class="text-sm text-gray-600">Avancement Global</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">${formatNumber(appState.project.completedHouses)}</div>
                        <div class="text-sm text-gray-600">Ménages Traités</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-purple-600">${productivity}</div>
                        <div class="text-sm text-gray-600">Ménages/Jour</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-orange-600">${remainingDays}</div>
                        <div class="text-sm text-gray-600">Jours Restants</div>
                    </div>
                </div>
            </div>
            
            <!-- Informations générales du projet -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div class="bg-gray-50 p-6 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Informations du Projet</h3>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Date de début:</span>
                            <span class="font-medium">${startDate}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Date actuelle:</span>
                            <span class="font-medium">${currentDate}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Date de fin prévue:</span>
                            <span class="font-medium">${endDate}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Durée totale:</span>
                            <span class="font-medium">${projectDuration} jours</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Ménages total:</span>
                            <span class="font-medium">${formatNumber(appState.project.totalHouses)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 p-6 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Performance Actuelle</h3>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Équipes actives:</span>
                            <span class="font-medium">${totalTeams} équipes</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Productivité moyenne:</span>
                            <span class="font-medium">${productivity} ménages/jour</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Budget consommé:</span>
                            <span class="font-medium">${formatCurrency(consumedBudget)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Budget restant:</span>
                            <span class="font-medium">${formatCurrency(remainingBudget)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Coût total estimé:</span>
                            <span class="font-medium">${formatCurrency(totalCost)}</span>
                        </div>
                    </div>
                </div>
            </div>
    `;

    // Analyse par corps de métier
    content += `
        <div class="mb-8">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">Analyse par Corps de Métier</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
    `;

    Object.entries(appState.teams).forEach(([key, team]) => {
        const teamName = {
            preparateurs: 'Préparateurs',
            livraison: 'Livraison',
            macons: 'Maçons',
            reseau: 'Électriciens Réseau',
            interieur: 'Électriciens Intérieur',
            controle: 'Contrôleurs'
        }[key];

        content += `
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-2">${escapeHTML(teamName)}</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span>Équipes:</span>
                        <span class="font-medium">${team.active}/${team.total}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Production:</span>
                        <span class="font-medium">${team.dailyProduction}/jour</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Progression:</span>
                        <span class="font-medium">${Math.round(team.progress)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${team.progress}%"></div>
                    </div>
                </div>
            </div>
        `;
    });

    content += '</div></div>';

    // Graphiques et visualisations
    content += `
        <div class="mb-8">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">Visualisations</h3>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-medium text-gray-800 mb-3">Avancement par Corps de Métier</h4>
                    <div id="reportProgressChart" style="height: 300px;"></div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-medium text-gray-800 mb-3">Évolution de la Productivité</h4>
                    <div id="reportProductivityChart" style="height: 300px;"></div>
                </div>
            </div>
        </div>
    `;

    // Analyse des risques
    if (type === 'complet' || type === 'risques') {
        content += `
            <div class="mb-8">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Analyse des Risques et Anomalies</h3>
                <div class="space-y-4">
        `;

        // Ensure arrays are present and well-formed to avoid runtime errors
        appState.bottlenecks = Array.isArray(appState.bottlenecks) ? appState.bottlenecks : [];
        appState.recommendations = Array.isArray(appState.recommendations) ? appState.recommendations : [];

        if (appState.bottlenecks.length > 0) {
            appState.bottlenecks.forEach((bottleneck, index) => {
                // Defensive defaults
                const severityRaw = bottleneck && (bottleneck.severity !== undefined) ? String(bottleneck.severity) : 'unknown';
                const severity = severityRaw ? severityRaw.toLowerCase() : 'unknown';
                const severityLabel = (severity || 'unknown').toUpperCase();
                const message = (bottleneck && bottleneck.message) ? bottleneck.message : 'Détails indisponibles';
                const recommendationText = (bottleneck && bottleneck.recommendation) ? bottleneck.recommendation : 'Aucune recommandation fournie';
                const severityColor = {
                    'critical': 'border-red-500 bg-red-50 text-red-800',
                    'high': 'border-orange-500 bg-orange-50 text-orange-800',
                    'medium': 'border-yellow-500 bg-yellow-50 text-yellow-800',
                    'low': 'border-blue-500 bg-blue-50 text-blue-800'
                }[severity] || 'border-gray-500 bg-gray-50 text-gray-800';

                content += `
                    <div class="border-l-4 ${severityColor} p-4 rounded-r-lg">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <i class="fas fa-exclamation-triangle text-${bottleneck.severity === 'critical' ? 'red' : bottleneck.severity === 'high' ? 'orange' : 'yellow'}-500"></i>
                            </div>
                            <div class="ml-3">
                                <h4 class="font-medium">Anomalie #${index + 1} - Niveau ${severityLabel}</h4>
                                <p class="text-sm mt-1">${escapeHTML(message)}</p>
                                <p class="text-sm mt-2 font-medium">Recommandation: ${escapeHTML(recommendationText)}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            content += `
                <div class="bg-green-50 border-l-4 border-green-400 p-4">
                    <div class="flex items-center">
                        <i class="fas fa-check-circle text-green-500 mr-3"></i>
                        <p class="text-green-800">Aucun risque ou anomalie détectée. Le projet progresse normalement.</p>
                    </div>
                </div>
            `;
        }

        content += '</div></div>';
    }

    // Recommandations
    if (type === 'complet' || type === 'executif') {
        content += `
            <div class="mb-8">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Recommandations et Actions</h3>
                <div class="space-y-4">
        `;

        if (appState.recommendations.length > 0) {
            appState.recommendations.forEach((rec, index) => {
                const priorityRaw = rec && (rec.priority !== undefined) ? String(rec.priority) : 'low';
                const priority = priorityRaw ? priorityRaw.toLowerCase() : 'low';
                const priorityLabel = (priority || 'low').toUpperCase();
                const recMessage = rec && rec.message ? rec.message : 'Détail indisponible';
                const recAction = rec && rec.action ? rec.action : 'Aucune action spécifiée';

                const priorityColor = {
                    'critical': 'border-red-500 bg-red-50',
                    'high': 'border-orange-500 bg-orange-50',
                    'medium': 'border-yellow-500 bg-yellow-50',
                    'low': 'border-blue-500 bg-blue-50'
                }[priority] || 'border-gray-500 bg-gray-50';

                content += `
                    <div class="border-l-4 ${priorityColor} p-4 rounded-r-lg">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <i class="fas fa-lightbulb text-${rec.priority === 'critical' ? 'red' : rec.priority === 'high' ? 'orange' : rec.priority === 'medium' ? 'yellow' : 'blue'}-500"></i>
                            </div>
                            <div class="ml-3">
                                <h4 class="font-medium">Recommandation #${index + 1} - Priorité ${priorityLabel}</h4>
                                <p class="text-sm mt-1">${escapeHTML(recMessage)}</p>
                                <p class="text-sm mt-2">Action: ${escapeHTML(recAction)}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            content += `
                <div class="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div class="flex items-center">
                        <i class="fas fa-info-circle text-blue-500 mr-3"></i>
                        <p class="text-blue-800">Aucune recommandation spécifique. Le projet suit son cours normal.</p>
                    </div>
                </div>
            `;
        }

        content += '</div></div>';
    }

    // Conclusion
    content += `
        <div class="mt-8 pt-6 border-t border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 mb-3">Conclusion</h3>
            <p class="text-gray-600 leading-relaxed">
                Le projet d'électrification de masse progresse de manière satisfaisante avec un avancement global de ${Math.round(appState.project.progress)}%. 
                Les principaux défis identifiés concernent l'équilibrage des ressources entre les différents corps de métier. 
                Les recommandations fournies permettront d'optimiser la productivité et de respecter les délais tout en maîtrisant les coûts.
            </p>
        </div>
        
        <div class="mt-6 text-center text-sm text-gray-500">
            <p>Rapport généré automatiquement par le système de pilotage d'électrification de masse</p>
            <p>Pour toute question, contactez l'équipe de gestion de projet</p>
        </div>
    </div>
    `;

    return content;
}

function loadReportData() {
    // Charger les données pour les rapports
    const elReportProgress = document.getElementById('reportProgress');
    if (elReportProgress) elReportProgress.textContent = Math.round(appState.project.progress) + '%';

    const costs = calculateCosts();
    const elReportBudget = document.getElementById('reportBudget');
    if (elReportBudget) elReportBudget.textContent = formatCurrency(costs.totalCost * (appState.project.progress / 100));
    const elTotalBudget = document.getElementById('totalBudget');
    if (elTotalBudget) elTotalBudget.textContent = formatCurrency(costs.totalCost);

    const elReportProductivity = document.getElementById('reportProductivity');
    if (elReportProductivity) elReportProductivity.textContent = calculateProductivity(appState.parameters);
    const elReportRisks = document.getElementById('reportRisks');
    if (elReportRisks) elReportRisks.textContent = appState.bottlenecks.length;

    // Initialiser les graphiques des rapports uniquement si des conteneurs existent
    if (document.getElementById('reportProgressChart') || document.getElementById('reportProductivityChart') || document.getElementById('budgetChart')) {
        initializeReportCharts();
    }
}

function initializeReportCharts() {
    // Graphique d'avancement pour le rapport
    const reportProgressChart = document.getElementById('reportProgressChart');
    if (reportProgressChart) {
        const teams = appState.teams;
        const data = [{
            x: ['Préparateurs', 'Livraison', 'Maçons', 'Réseau', 'Intérieur', 'Contrôle'],
            y: [teams.preparateurs.progress, teams.livraison.progress, teams.macons.progress,
            teams.reseau.progress, teams.interieur.progress, teams.controle.progress],
            type: 'bar',
            marker: {
                color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280']
            },
            text: [teams.preparateurs.progress + '%', teams.livraison.progress + '%', teams.macons.progress + '%',
            teams.reseau.progress + '%', teams.interieur.progress + '%', teams.controle.progress + '%'],
            textposition: 'outside'
        }];

        const layout = {
            title: '',
            xaxis: {
                title: 'Corps de métier',
                tickangle: -45
            },
            yaxis: {
                title: 'Progression (%)',
                range: [0, 100]
            },
            margin: { t: 20, r: 20, b: 100, l: 60 },
            plot_bgcolor: '#f9fafb',
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot(reportProgressChart, data, layout, { responsive: true });
    }

    // Graphique de productivité pour le rapport
    const reportProductivityChart = document.getElementById('reportProductivityChart');
    if (reportProductivityChart) {
        const performanceData = appState.performanceData.dailyProgress;
        const dates = performanceData.map(d => d.date);
        const dailyProduction = performanceData.map(d => d.houses);

        const data = [{
            x: dates,
            y: dailyProduction,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Production Journalière',
            line: { color: '#10b981', width: 3 },
            marker: { color: '#10b981', size: 8 }
        }];

        const layout = {
            title: '',
            xaxis: {
                title: 'Date',
                type: 'date'
            },
            yaxis: {
                title: 'Ménages/Jour'
            },
            margin: { t: 20, r: 20, b: 60, l: 60 },
            plot_bgcolor: '#f9fafb',
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot(reportProductivityChart, data, layout, { responsive: true });
    }

    // Graphique de répartition du budget
    const budgetChart = document.getElementById('budgetChart');
    if (budgetChart) {
        const costs = calculateCosts();
        const totalCost = costs.totalCost;

        const data = [{
            values: [
                totalCost * 0.35, // Équipes terrain
                totalCost * 0.25, // Matériel
                totalCost * 0.20, // Logistique
                totalCost * 0.12, // Contrôle qualité
                totalCost * 0.08  // Imprévus
            ],
            labels: ['Équipes terrain', 'Matériel', 'Logistique', 'Contrôle qualité', 'Imprévus'],
            type: 'pie',
            marker: {
                colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                line: { color: '#ffffff', width: 2 }
            },
            textinfo: 'label+percent',
            textposition: 'outside',
            hovertemplate: '<b>%{label}</b><br>Montant: %{value:,.0f} FCFA<br>Pourcentage: %{percent}<extra></extra>'
        }];

        const layout = {
            title: {
                text: 'Répartition du Budget Total',
                font: { size: 16, color: '#374151' }
            },
            margin: { t: 60, r: 20, b: 20, l: 20 },
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot(budgetChart, data, layout, { responsive: true });
    }
}

// ============================================================================
// INITIALISATION ET ÉVÉNEMENTS
// ============================================================================

// ---------------------------------------------------------------------------
// IMPORT / PARSING FICHIERS (CSV / GeoJSON) et déclenchement automatique
// ---------------------------------------------------------------------------

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h] = cols[i] !== undefined ? cols[i].trim() : '');
        return obj;
    });
    return rows;
}

function parseGeoJSON(obj) {
    const data = [];
    if (!obj) return data;
    const features = obj.features || [];
    features.forEach(f => {
        const coords = (f.geometry && f.geometry.coordinates) || [];
        const props = f.properties || {};
        data.push({
            type: 'feature',
            lon: coords[0],
            lat: coords[1],
            properties: props
        });
    });
    return data;
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => resolve(fr.result);
        fr.readAsText(file);
    });
}

async function importHouseholdFile(file) {
    try {
        const text = await readFileAsText(file);
        // essayer JSON / GeoJSON
        try {
            const obj = JSON.parse(text);
            const geo = parseGeoJSON(obj);
            appState.households = geo;
            showNotification('Cartographie ménages importée (GeoJSON)', 'success');
            return;
        } catch (e) {
            // pas JSON → CSV
        }

        const rows = parseCSV(text);
        // tenter d'extraire lat/lon
        const households = rows.map(r => {
            const lat = parseFloat(r.lat || r.latitude || r.Lat || r.Latitude || r.Latitude_deg) || null;
            const lon = parseFloat(r.lon || r.longitude || r.Lon || r.Longitude || r.Longitude_deg) || null;
            return {
                id: r.id || r.household_id || r.household || null,
                lat, lon,
                properties: r
            };
        }).filter(h => h.lat !== null && h.lon !== null);

        appState.households = households;
        // Persist and render
        try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed', e); }
        if (typeof renderHouseholdsOnMap === 'function') renderHouseholdsOnMap();
        showNotification(`Cartographie ménages importée (${households.length} points)`, 'success');
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de l\'import cartographie ménages', 'error');
    }
}

async function importTerrainFile(file) {
    try {
        const text = await readFileAsText(file);
        let rows = [];
        try {
            const obj = JSON.parse(text);
            if (Array.isArray(obj)) rows = obj;
            else if (obj.records) rows = obj.records;
            else if (obj.data) rows = obj.data;
        } catch (e) {
            rows = parseCSV(text);
        }

        // Normaliser et convertir types
        const entries = rows.map(r => {
            const date = r.date || r.Date || r.jour || new Date().toISOString().split('T')[0];
            const team = r.team || r.equipe || r.Team || 'Inconnu';
            const housesCount = parseInt(r.housesCount || r.houses || r.houses_count || r.nb || r.nbMaisons) || 0;
            const hoursWorked = parseFloat(r.hoursWorked || r.hours || r.heures) || 0;
            const status = r.status || r.statut || 'completed';
            const remarkDescription = r.remarkDescription || r.remarque || r.remark || '';
            return {
                date: date,
                team,
                housesCount,
                hoursWorked,
                status,
                remarkDescription,
                timestamp: new Date().toISOString()
            };
        });

        // Fusionner avec les données terrain existantes
        appState.terrainData = appState.terrainData.concat(entries);
        // Mettre à jour le nombre de maisons complétées
        const totalAdded = entries.reduce((s, e) => s + (e.housesCount || 0), 0);
        appState.project.completedHouses = (appState.project.completedHouses || 0) + totalAdded;

        saveToLocalStorage();
        updateAppState();
        try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed', e); }
        showNotification(`Données terrain importées (${entries.length} lignes, ${totalAdded} ménages)`, 'success');
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de l\'import des données terrain', 'error');
    }
}

async function handleImportFiles() {
    const householdInput = document.getElementById('householdFileInput');
    const terrainInput = document.getElementById('terrainFileInput');
    const autoRun = document.getElementById('autoRunImport')?.checked;

    if (householdInput && householdInput.files && householdInput.files.length > 0) {
        await importHouseholdFile(householdInput.files[0]);
    }

    if (terrainInput && terrainInput.files && terrainInput.files.length > 0) {
        await importTerrainFile(terrainInput.files[0]);
    }

    // Après import, sauvegarder et mettre à jour l'affichage
    saveToLocalStorage();
    updateAppState();
    if (typeof updateDashboard === 'function') updateDashboard();

    try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (handleImportFiles)', e); }

    if (autoRun) {
        try {
            runSimulation();
        } catch (e) {
            console.error('Erreur auto-run simulation', e);
        }
    }
}

// ---------------------------------------------------------------------------

// IndexedDB + Sync Queue utilities
let __idb = null;
function initIDB() {
    return new Promise((resolve, reject) => {
        if (__idb) return resolve(__idb);
        const req = indexedDB.open('electrification-db', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
            if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' });
        };
        req.onsuccess = (e) => { __idb = e.target.result; resolve(__idb); };
        req.onerror = (e) => { reject(req.error || e); };
    });
}

function saveAppStateToIDB() {
    return new Promise((resolve, reject) => {
        if (!__idb) return initIDB().then(() => saveAppStateToIDB().then(resolve).catch(reject));
        const tx = __idb.transaction('state', 'readwrite');
        const store = tx.objectStore('state');
        const req = store.put(appState, 'appState');
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

function loadAppStateFromIDB() {
    return new Promise((resolve, reject) => {
        if (!__idb) return initIDB().then(() => loadAppStateFromIDB().then(resolve).catch(reject));
        const tx = __idb.transaction('state', 'readonly');
        const store = tx.objectStore('state');
        const req = store.get('appState');
        req.onsuccess = () => {
            if (req.result) {
                appState = { ...appState, ...req.result };
                // migrate vehicle fields if missing (backwards compatibility)
                try { ensureVehicleDefaults(appState.parameters); } catch (e) { console.warn('ensureVehicleDefaults error', e); }
                // Notify UI
                document.dispatchEvent(new CustomEvent('zonesUpdated'));
            }
            resolve(req.result);
        };
        req.onerror = () => reject(req.error);
    });
}

function enqueueSyncAction(action) {
    return new Promise((resolve, reject) => {
        initIDB().then(db => {
            const tx = db.transaction('syncQueue', 'readwrite');
            const store = tx.objectStore('syncQueue');
            const item = { id: Date.now().toString(), action, createdAt: new Date().toISOString() };
            const req = store.add(item);
            req.onsuccess = () => resolve(item);
            req.onerror = () => reject(req.error);
        }).catch(reject);
    });
}

// -----------------------------
// IndexedDB helper API
// -----------------------------

function setStateKey(key, value) {
    return new Promise((resolve, reject) => {
        initIDB().then(db => {
            try {
                const tx = db.transaction('state', 'readwrite');
                const store = tx.objectStore('state');
                const req = store.put(value, key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            } catch (e) {
                reject(e);
            }
        }).catch(reject);
    });
}

function getStateKey(key) {
    return new Promise((resolve, reject) => {
        initIDB().then(db => {
            try {
                const tx = db.transaction('state', 'readonly');
                const store = tx.objectStore('state');
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) {
                reject(e);
            }
        }).catch(reject);
    });
}

function clearDatabase() {
    return new Promise((resolve, reject) => {
        try {
            // Close existing reference if any
            try { if (__idb && typeof __idb.close === 'function') __idb.close(); } catch (e) { /* ignore */ }
            __idb = null;
            const delReq = indexedDB.deleteDatabase('electrification-db');
            delReq.onsuccess = function () { resolve(true); };
            delReq.onerror = function (e) { reject(e || delReq.error); };
            delReq.onblocked = function () { reject(new Error('Delete blocked')); };
        } catch (e) {
            reject(e);
        }
    });
}

async function updateAndPersistAppState() {
    try {
        updateAppState();
        // Update lastSaved metadata so both localStorage and IDB snapshots contain it
        try {
            appState.meta = appState.meta || {};
            appState.meta.lastSaved = new Date().toISOString();
        } catch (e) { /* ignore */ }

        saveToLocalStorage();
        try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (updateAndPersistAppState)', e); }

        // Update UI indicator if present
        try {
            const el = document.getElementById('lastSaved');
            if (el && appState.meta && appState.meta.lastSaved) {
                el.textContent = new Date(appState.meta.lastSaved).toLocaleString();
            }
        } catch (e) { /* ignore */ }

        return true;
    } catch (e) {
        console.warn('updateAndPersistAppState failed', e);
        return false;
    }
}

async function manualSync() {
    try {
        const ok = await updateAndPersistAppState();
        if (ok) {
            showNotification('Synchronisation locale terminée', 'success');
            return true;
        } else {
            showNotification('Échec de la synchronisation locale', 'error');
            return false;
        }
    } catch (e) {
        console.error('manualSync failed', e);
        showNotification('Erreur lors de la synchronisation', 'error');
        return false;
    }
}

// Expose a small API for other pages / dev tools
window.localDB = {
    initIDB,
    setStateKey,
    getStateKey,
    clearDatabase,
    saveAppStateToIDB,
    loadAppStateFromIDB,
    updateAndPersistAppState
};

function processSyncQueue() {
    // Attempt to send queued actions to server (here we simulate success and clear queue)
    initIDB().then(db => {
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        const req = store.getAll();
        req.onsuccess = () => {
            const items = req.result || [];
            if (items.length === 0) return;
            showNotification(`Traitement de ${items.length} action(s) en attente...`, 'info');
            // Simuler envoi réseau
            setTimeout(() => {
                items.forEach(it => {
                    try { store.delete(it.id); } catch (e) { /* ignore */ }
                });
                showNotification('File de synchronisation traitée (simulée)', 'success');
            }, 800);
        };
        req.onerror = () => { console.warn('Erreur lecture queue sync', req.error); };
    }).catch(err => console.warn('IDB non initialisé', err));
}

// Map rendering (Leaflet)
let __map = null;
let __householdLayer = null;
let __markerClusterOptions = { chunkedLoading: true, maxClusterRadius: 60, spiderfyOnMaxZoom: true, showCoverageOnHover: false };
let __markerClusterGroup = null;
let __heatLayer = null;
function initializeMap() {
    // Legacy mode: call legacy implementation (if loaded)
    try {
        if (window.APP_CONFIG && window.APP_CONFIG.mapImplementation === 'legacy') {
            if (typeof initializeMapLegacy === 'function') return initializeMapLegacy();
            console.warn('Legacy map selected but legacy_map was not loaded');
        }
    } catch (e) { /* ignore */ }

    // Default: MapManager is the canonical implementation — initialization happens in MapManager constructor
    if (window.mapManager && typeof window.mapManager.loadData === 'function') {
        try { window.mapManager.loadData(); } catch (e) { /* ignore */ }
        return;
    }

    // If no map is available, warn (no-op)
    if (typeof L === 'undefined') {
        console.warn('Leaflet (L) is not loaded yet — skipping map initialization');
        return;
    }
    // Prevent double initialization
    if (__map) return;
    // If the container has a leftover leaflet id from a previous init, try to clean it
    try {
        if (container._leaflet_id) {
            // remove previous contents and delete internal marker so Leaflet can re-init
            container.innerHTML = '';
            try { delete container._leaflet_id; } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore cleanup errors */ }
    try {
        __map = L.map('householdMap').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(__map);
        // Prepare layers: marker cluster and heat
        try {
            __markerClusterGroup = L.markerClusterGroup(__markerClusterOptions);
        } catch (e) {
            console.warn('leaflet.markercluster unavailable, creating fallback layerGroup', e);
            __markerClusterGroup = L.layerGroup();
        }
        __markerClusterGroup.addTo(__map);

        try {
            __heatLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 17 });
        } catch (e) {
            console.warn('leaflet.heat unavailable', e);
            __heatLayer = null;
        }

        // render existing households if any (legacy behavior)
        if (appState.households && appState.households.length > 0) renderHouseholdsOnMap();

        // Wire controls
        const heatToggle = document.getElementById('heatmapToggle');
        const clusterRadiusInput = document.getElementById('clusterRadiusInput');
        const clusterRadiusValue = document.getElementById('clusterRadiusValue');
        if (heatToggle) heatToggle.addEventListener('change', () => updateMapRendering());
        if (clusterRadiusInput) {
            clusterRadiusInput.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10) || 60;
                if (clusterRadiusValue) clusterRadiusValue.textContent = v;
                __markerClusterOptions.maxClusterRadius = v;
                recreateClusterGroup();
            });
        }
    } catch (e) { console.error('Erreur initializeMap', e); }
}

function renderHouseholdsOnMap() {
    // If legacy mode explicitly requested, delegate to legacy implementation
    try {
        if (window.APP_CONFIG && window.APP_CONFIG.mapImplementation === 'legacy') {
            if (typeof renderHouseholdsOnMapLegacy === 'function') return renderHouseholdsOnMapLegacy();
        }
    } catch (e) { /* ignore */ }

    // Prefer MapManager
    if (window.mapManager && typeof window.mapManager.loadData === 'function') {
        try { window.mapManager.loadData(); } catch (e) { /* ignore */ }
        return;
    }

    if (!__map) return;
    const points = appState.households || [];
    if (points.length === 0) {
        __markerClusterGroup && __markerClusterGroup.clearLayers();
        if (__heatLayer) try { __map.removeLayer(__heatLayer); } catch (e) { }
        return;
    }

    const useHeat = document.getElementById('heatmapToggle')?.checked;
    const latLngs = [];
    const heatPoints = [];

    points.forEach(p => {
        const lat = parseFloat(p.lat || p.properties?.lat || p.properties?.latitude || p.lat);
        const lon = parseFloat(p.lon || p.properties?.lon || p.properties?.longitude || p.lon);
        if (isFinite(lat) && isFinite(lon)) {
            latLngs.push([lat, lon]);
            heatPoints.push([lat, lon, 1]);
        }
    });

    if (useHeat && __heatLayer) {
        try { __map.removeLayer(__markerClusterGroup); } catch (e) { }
        __heatLayer.setLatLngs(heatPoints.map(h => [h[0], h[1], h[2]]));
        try { __heatLayer.addTo(__map); } catch (e) { }
        if (latLngs.length > 0) try { __map.fitBounds(latLngs, { maxZoom: 16, padding: [20, 20] }); } catch (e) { }
        return;
    }

    if (__heatLayer) try { __map.removeLayer(__heatLayer); } catch (e) { }
    __markerClusterGroup && __markerClusterGroup.clearLayers();
    points.forEach(p => {
        const lat = parseFloat(p.lat || p.properties?.lat || p.properties?.latitude || p.lat);
        const lon = parseFloat(p.lon || p.properties?.lon || p.properties?.longitude || p.lon);
        if (isFinite(lat) && isFinite(lon)) {
            const marker = L.marker([lat, lon]);
            const popup = `<div><strong>${p.id || p.properties?.id || 'Ménage'}</strong><br>${Object.entries(p.properties || {}).map(([k, v]) => `${k}: ${v}`).join('<br>')}</div>`;
            marker.bindPopup(popup);
            try { __markerClusterGroup.addLayer(marker); } catch (e) { /* ignore */ }
        }
    });
    if (latLngs.length > 0) try { __map.fitBounds(latLngs, { maxZoom: 16, padding: [20, 20] }); } catch (e) { }
}

function recreateClusterGroup() {
    // If legacy mode requested, call legacy recreate
    try {
        if (window.APP_CONFIG && window.APP_CONFIG.mapImplementation === 'legacy') {
            if (typeof recreateClusterGroupLegacy === 'function') return recreateClusterGroupLegacy();
        }
    } catch (e) {}

    // Prefer MapManager
    if (window.mapManager && typeof window.mapManager.recreateClusterGroup === 'function') {
        try { window.mapManager.recreateClusterGroup(); } catch (e) { /* ignore */ }
        return;
    }

    if (!__map) return;
    try { __map.removeLayer(__markerClusterGroup); } catch (e) { }
    try {
        __markerClusterGroup = L.markerClusterGroup(__markerClusterOptions);
    } catch (e) {
        console.warn('marker cluster recreate failed', e);
        __markerClusterGroup = L.layerGroup();
    }
    __markerClusterGroup.addTo(__map);
    renderHouseholdsOnMap();
}

function updateMapRendering() {
    // Delegate to legacy when explicitly requested
    try {
        if (window.APP_CONFIG && window.APP_CONFIG.mapImplementation === 'legacy') {
            if (typeof updateMapRenderingLegacy === 'function') return updateMapRenderingLegacy();
        }
    } catch (e) {}

    if (window.mapManager && typeof window.mapManager.loadData === 'function') {
        try { window.mapManager.loadData(); } catch (e) { /* ignore */ }
        return;
    }

    renderHouseholdsOnMap();
}

// Network handlers
window.addEventListener('online', () => { processSyncQueue(); showNotification('Connexion rétablie — synchronisation', 'info'); });
window.addEventListener('offline', () => { showNotification('Hors ligne — les actions seront mises en file', 'info'); });

document.addEventListener('DOMContentLoaded', function () {
    // Initialize IndexedDB and restore state if present
    initIDB().then(() => loadAppStateFromIDB()).catch(() => { }).finally(() => {
        // Fallback to localStorage
        loadFromLocalStorage();
        // Mettre à jour l'état de l'application
        updateAppState();

        // Mettre à jour le dashboard si on est sur la page principale
        if (document.getElementById('globalProgress')) {
            updateDashboard();
        }

        // Configurer les gestionnaires d'événements
        const terrainForm = document.getElementById('terrainForm');
        if (terrainForm) {
            terrainForm.addEventListener('submit', handleTerrainSubmit);
        }

        // Configurer les boutons d'export
        setupExportButtons();

        // Configurer les boutons de simulation
        setupSimulationButtons();

        // Configurer les boutons de rapport
        setupReportButtons();

        // Charger les données initiales selon la page
        initializePageSpecificData();
        // Traiter la file de synchronisation au démarrage
        processSyncQueue();
    });
});

// Configuration des boutons d'export
function setupExportButtons() {
    // Boutons d'export PDF
    const exportPDFButtons = document.querySelectorAll('[onclick*="exportToPDF"]');
    exportPDFButtons.forEach(button => {
        button.onclick = exportToPDF;
    });

    // Boutons d'export Excel
    const exportExcelButtons = document.querySelectorAll('[onclick*="exportToExcel"]');
    exportExcelButtons.forEach(button => {
        button.onclick = exportToExcel;
    });

    // Boutons d'envoi par email
    const emailButtons = document.querySelectorAll('[onclick*="sendReportByEmail"]');
    emailButtons.forEach(button => {
        button.onclick = sendReportByEmail;
    });
}

// Configuration des boutons de simulation
function setupSimulationButtons() {
    // Bouton lancer simulation
    const runSimButton = document.querySelector('[onclick*="runSimulation"]');
    if (runSimButton) {
        runSimButton.onclick = runSimulation;
    }

    // Bouton comparer scénarios
    const compareButton = document.querySelector('[onclick*="compareScenarios"]');
    if (compareButton) {
        compareButton.onclick = compareScenarios;
    }

    // Bouton réinitialiser simulation
    const resetSimButton = document.querySelector('[onclick*="resetSimulation"]');
    if (resetSimButton) {
        resetSimButton.onclick = resetSimulation;
    }
}

// Configuration des boutons de rapport
function setupReportButtons() {
    // Boutons de génération de rapport — version robuste
    // Priorité: éléments avec `data-report-type`. Si absent, fallback vers parsing de l'attribut onclick.
    const dataButtons = document.querySelectorAll('[data-report-type]');
    if (dataButtons && dataButtons.length > 0) {
        dataButtons.forEach(btn => {
            const t = btn.dataset && btn.dataset.reportType;
            if (t) btn.addEventListener('click', () => generateReport(t));
        });
        return;
    }

    // Fallback (ancien comportement) : rechercher l'attribut onclick contenant generateReport
    const reportButtons = document.querySelectorAll('[onclick*="generateReport"]');
    reportButtons.forEach(button => {
        const match = button.getAttribute('onclick').match(/generateReport\('(.+?)'\)/);
        if (match) {
            button.onclick = () => generateReport(match[1]);
        }
    });
}

// Initialisation des données spécifiques à la page
function initializePageSpecificData() {
    // Page principale - Dashboard
    if (document.getElementById('globalProgress')) {
        updateDashboard();
    }

    // Page paramètres
    if (document.getElementById('totalHouses')) {
        loadParameters();
    }

    // Attacher le handler d'import si présent
    if (document.getElementById('importButton')) {
        document.getElementById('importButton').onclick = handleImportFiles;
    }

    // Page terrain
    if (document.getElementById('todayHouses')) {
        loadTodayProgress();
        loadMaterialRequests();
    }

    // Page rapports
    if (document.getElementById('reportProgress')) {
        loadReportData();
    }

    // Page simulation
    if (document.getElementById('simMasonTeams')) {
        // Charger les paramètres actuels dans le simulateur
        document.getElementById('simMasonTeams').value = appState.parameters.masonTeams;
        document.getElementById('simNetworkTeams').value = appState.parameters.networkElectricianTeams;
        if (document.getElementById('simInteriorType1Teams')) document.getElementById('simInteriorType1Teams').value = appState.parameters.interiorElectricianType1Teams;
        if (document.getElementById('simInteriorType2Teams')) document.getElementById('simInteriorType2Teams').value = appState.parameters.interiorElectricianType2Teams;
        document.getElementById('simUnforeseenRate').value = appState.parameters.unforeseenRate;
    }

    // If on terrain page, initialize map rendering of households
    if (document.getElementById('householdMap')) {
        try {
            initializeMap();
        } catch (e) { console.error('Erreur init map page specific', e); }
    }
}

// Ajouter des fonctions d'export avancées
function exportToPDF() {
    showNotification('Préparation de l\'export PDF...', 'info');

    // Simuler le processus d'export PDF
    setTimeout(() => {
        const link = document.createElement('a');
        link.href = 'data:text/plain;charset=utf-8,Rapport PDF généré avec succès';
        link.download = 'rapport_electrification.pdf';
        link.click();
        showNotification('Export PDF terminé', 'success');
    }, 2000);
}

function exportToExcel() {
    showNotification('Préparation de l\'export Excel...', 'info');

    // Simuler le processus d'export Excel
    setTimeout(() => {
        const csvContent = generateCSVData();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'donnees_electrification.csv';
        link.click();
        showNotification('Export Excel terminé', 'success');
    }, 1500);
}

// Exporter les paramètres du projet (JSON) - utilisé depuis la page `parametres.html`
function exportParameters() {
    try {
        const data = {
            project: appState.project,
            parameters: appState.parameters
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const filename = `projet_parametres_${new Date().toISOString().slice(0, 10)}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showNotification('Paramètres exportés en JSON', 'success');
    } catch (e) {
        console.error('Erreur exportParameters', e);
        showNotification('Erreur lors de l\'export des paramètres', 'error');
    }
}

function generateCSVData() {
    const headers = ['Date', 'Équipe', 'Ménages Traités', 'Heures Travaillées', 'Statut', 'Remarques'];
    const rows = appState.terrainData.map(entry => [
        entry.date,
        entry.team,
        entry.housesCount,
        entry.hoursWorked,
        entry.status,
        entry.remarkDescription || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function sendReportByEmail() {
    const subject = encodeURIComponent('Rapport Électrification de Masse');
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint le rapport d'électrification de masse.\n\nCordialement,\nL'équipe de pilotage`);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    showNotification('Email préparé pour envoi', 'success');
}

// Fonctions utilitaires manquantes (stubs légers pour rendre l'app exploitable)
function showNotification(message, type = 'info') {
    // Implémentation simple : console + ajout d'une alerte visuelle si possible
    console.log(`[${type.toUpperCase()}] ${message}`);
    try {
        // créer un petit toast si le DOM est disponible
        const containerId = 'appNotificationContainer';
        let container = document.getElementById(containerId);
        if (!container && document.body) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.position = 'fixed';
            container.style.right = '16px';
            container.style.top = '16px';
            container.style.zIndex = 9999;
            document.body.appendChild(container);
        }

        if (container) {
            const el = document.createElement('div');
            el.textContent = message;
            el.style.marginTop = '6px';
            el.style.padding = '8px 12px';
            el.style.borderRadius = '6px';
            el.style.background = type === 'success' ? '#ecfccb' : type === 'error' ? '#fee2e2' : '#e0f2fe';
            el.style.color = '#0f172a';
            el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.08)';
            container.appendChild(el);
            setTimeout(() => el.remove(), 4000);
        }
    } catch (e) {
        // ignore
    }
}

// Simple undo stack helpers for recent deletes (short window)
function _ensureUndoStack() {
    if (!Array.isArray(appState._undoStack)) appState._undoStack = [];
}

function pushUndoDeletedEntry(entry, ttlMs = 30000) {
    _ensureUndoStack();
    const payload = { entry: JSON.parse(JSON.stringify(entry)), expiresAt: Date.now() + ttlMs };
    appState._undoStack.push(payload);
    // cleanup after ttl
    setTimeout(() => {
        try {
            appState._undoStack = (appState._undoStack || []).filter(p => p.expiresAt > Date.now());
        } catch (e) { /* ignore */ }
    }, ttlMs + 500);
}

async function undoRestoreTerrainEntryByTimestamp(ts) {
    try {
        _ensureUndoStack();
        const idx = appState._undoStack.findIndex(p => p.entry && p.entry.timestamp === ts);
        if (idx === -1) { showNotification('Aucune entrée à restaurer', 'error'); return; }
        const payload = appState._undoStack.splice(idx, 1)[0];
        if (!payload || !payload.entry) { showNotification('Restauration impossible', 'error'); return; }
        // restore entry (append) - keep original timestamp
        appState.terrainData.push(payload.entry);
        // adjust project completed houses
        appState.project.completedHouses = (Number(appState.project.completedHouses) || 0) + (Number(payload.entry.housesCount) || 0);
        saveToLocalStorage();
        try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (undoRestoreTerrainEntryByTimestamp)', e); }
        updateAppState();
        loadTodayProgress();
        showNotification('Entrée restaurée', 'success');
    } catch (e) {
        console.error('undoRestoreTerrainEntryByTimestamp error', e);
        showNotification('Erreur lors de la restauration', 'error');
    }
}

function showUndoToastForEntry(entry, ttlMs = 30000) {
    try {
        const containerId = 'appNotificationContainer';
        let container = document.getElementById(containerId);
        if (!container && document.body) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.position = 'fixed';
            container.style.right = '16px';
            container.style.top = '16px';
            container.style.zIndex = 9999;
            document.body.appendChild(container);
        }
        if (!container) return;
        const el = document.createElement('div');
        el.style.marginTop = '6px';
        el.style.padding = '8px 12px';
        el.style.borderRadius = '6px';
        el.style.background = '#fee2e2';
        el.style.color = '#0f172a';
        el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.08)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.gap = '8px';
        const txt = document.createElement('span');
        txt.textContent = 'Entrée supprimée';
        const btn = document.createElement('button');
        btn.textContent = 'Annuler';
        btn.style.background = '#fff';
        btn.style.border = '1px solid #ddd';
        btn.style.padding = '6px 8px';
        btn.style.borderRadius = '4px';
        btn.onclick = () => {
            // perform restore
            undoRestoreTerrainEntryByTimestamp(entry.timestamp);
            el.remove();
        };
        el.appendChild(txt);
        el.appendChild(btn);
        container.appendChild(el);
        // auto remove after ttl
        setTimeout(() => { try { el.remove(); } catch (e) { /* ignore */ } }, ttlMs);
    } catch (e) { console.warn('showUndoToastForEntry failed', e); }
}

function syncData() {
    showNotification('Synchronisation des données en cours...', 'info');
    // Stub: simuler une synchronisation
    setTimeout(() => {
        showNotification('Synchronisation terminée', 'success');
    }, 1000);
}

// Clear all persisted data (localStorage + IndexedDB) and reset in-memory state
function clearAllData() {
    try {
        if (!confirm('Supprimer toutes les données locales (localStorage et IndexedDB) ? Cette action est irréversible. Continuer ?')) return;

        showNotification('Nettoyage complet en cours...', 'info');

        // 1. Close Dexie connection if open
        if (window.db && typeof window.db.close === 'function') {
            try {
                window.db.close();
                console.log('🔒 Connexion Dexie fermée');
            } catch (e) {
                console.warn('Erreur fermeture Dexie', e);
            }
        }

        // 2. Close native connection if open
        if (typeof __idb !== 'undefined' && __idb && typeof __idb.close === 'function') {
            try {
                __idb.close();
                console.log('🔒 Connexion native fermée');
            } catch (e) { /* ignore */ }
        }
        __idb = null;

        // 3. Remove localStorage
        try {
            localStorage.removeItem('electrificationApp');
        } catch (e) {
            console.warn('localStorage remove failed', e);
        }

        // 4. Delete BOTH databases with delay
        setTimeout(async () => {
            let errors = 0;

            // Helper to delete a DB
            const deleteDB = (name) => {
                return new Promise((resolve) => {
                    console.log(`🗑️ Tentative suppression ${name}...`);
                    const req = indexedDB.deleteDatabase(name);
                    req.onsuccess = () => { console.log(`✅ ${name} supprimée`); resolve(true); };
                    req.onerror = (e) => { console.error(`❌ Erreur suppression ${name}`, e); errors++; resolve(false); };
                    req.onblocked = () => { console.warn(`⚠️ Suppression ${name} bloquée`); errors++; resolve(false); };
                });
            };

            try {
                // Delete main Dexie DB
                await deleteDB('ElectrificationDB');
                // Delete secondary native DB
                await deleteDB('electrification-db');

                if (errors === 0) {
                    showNotification('Toutes les données supprimées. Rechargement...', 'success');
                } else {
                    showNotification('Nettoyage terminé avec avertissements. Rechargement...', 'warning');
                }

                // Always reload to ensure clean state
                setTimeout(() => location.reload(), 1000);

            } catch (e) {
                console.error('Exception during DB deletion', e);
                location.reload();
            }
        }, 500);

    } catch (err) {
        console.error('clearAllData error', err);
        showNotification('Erreur critique lors de la réinitialisation', 'error');
    }
}

async function editTerrainEntry(timestamp) {
    // Open inline modal to edit the selected terrain entry
    const idx = appState.terrainData.findIndex(e => e.timestamp === timestamp);
    if (idx === -1) { showNotification('Entrée introuvable', 'error'); return; }
    const entry = appState.terrainData[idx];

    // Ensure modal elements exist (modal markup is in terrain.html after main.js)
    const modal = document.getElementById('editEntryModal');
    if (!modal) {
        showNotification('Modal d\'édition introuvable', 'error');
        return;
    }

    // Populate fields
    document.getElementById('edit_entryTimestamp').value = entry.timestamp || '';
    document.getElementById('edit_inputDate').value = entry.date ? (new Date(entry.date)).toISOString().slice(0, 10) : '';
    const teamEl = document.getElementById('edit_teamSelect'); if (teamEl) teamEl.value = entry.team || '';
    const unitsEl = document.getElementById('edit_unitsCompleted'); if (unitsEl) unitsEl.value = entry.housesCount || 0;
    const hoursEl = document.getElementById('edit_hoursWorked'); if (hoursEl) hoursEl.value = entry.hoursWorked || 0;
    const statusEl = document.getElementById('edit_workStatus'); if (statusEl) statusEl.value = entry.status || 'completed';
    const remarkEl = document.getElementById('edit_remarkDescription'); if (remarkEl) remarkEl.value = entry.remarkDescription || '';

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Wire buttons (use onclick to avoid needing listeners attached at load time)
    const saveBtn = document.getElementById('editModalSave');
    const cancelBtn = document.getElementById('editModalCancel');
    const closeBtn = document.getElementById('editModalClose');

    if (saveBtn) {
        saveBtn.onclick = async function () {
            try {
                const ts = document.getElementById('edit_entryTimestamp').value;
                const i = appState.terrainData.findIndex(e => e.timestamp === ts);
                if (i === -1) { showNotification('Entrée introuvable (save)', 'error'); closeTerrainEditModal(); return; }

                // Read updated values
                const newDate = document.getElementById('edit_inputDate').value;
                const newTeam = document.getElementById('edit_teamSelect').value;
                const newUnits = parseInt(document.getElementById('edit_unitsCompleted').value) || 0;
                const newHours = parseFloat(document.getElementById('edit_hoursWorked').value) || 0;
                const newStatus = document.getElementById('edit_workStatus').value;
                const newRemark = document.getElementById('edit_remarkDescription').value;

                // Update entry
                const prevUnits = Number(appState.terrainData[i].housesCount || 0);
                appState.terrainData[i].date = newDate;
                appState.terrainData[i].team = newTeam;
                appState.terrainData[i].housesCount = newUnits;
                appState.terrainData[i].hoursWorked = newHours;
                appState.terrainData[i].status = newStatus;
                appState.terrainData[i].remarkDescription = newRemark;

                // Adjust project.completedHouses if units changed
                const diff = newUnits - prevUnits;
                if (!isNaN(diff) && diff !== 0) {
                    appState.project.completedHouses = (Number(appState.project.completedHouses) || 0) + diff;
                }

                // Persist
                saveToLocalStorage();
                try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (edit modal save)', e); }
                updateAppState();
                loadTodayProgress();
                showNotification('Entrée modifiée', 'success');
            } catch (err) {
                console.error('Saving edited entry failed', err);
                showNotification('Erreur lors de la sauvegarde', 'error');
            } finally {
                closeTerrainEditModal();
            }
        };
    }

    if (cancelBtn) cancelBtn.onclick = closeTerrainEditModal;
    if (closeBtn) closeBtn.onclick = closeTerrainEditModal;
}

function closeTerrainEditModal() {
    const modal = document.getElementById('editEntryModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    // clear onclick handlers to avoid stale closures
    const saveBtn = document.getElementById('editModalSave'); if (saveBtn) saveBtn.onclick = null;
    const cancelBtn = document.getElementById('editModalCancel'); if (cancelBtn) cancelBtn.onclick = null;
    const closeBtn = document.getElementById('editModalClose'); if (closeBtn) closeBtn.onclick = null;
}

// Instead of deleting immediately, open a confirmation modal and perform delete on confirm
async function deleteTerrainEntry(timestamp) {
    try {
        // show delete confirmation modal (markup added in terrain.html)
        const modal = document.getElementById('deleteConfirmModal');
        if (!modal) {
            // fallback to immediate delete if modal missing
            await performDeleteTerrainEntry(timestamp);
            return;
        }

        // store timestamp to delete in modal dataset
        modal.dataset.deleteTimestamp = timestamp;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const confirmBtn = document.getElementById('deleteModalConfirm');
        const cancelBtn = document.getElementById('deleteModalCancel');
        const closeBtn = document.getElementById('deleteModalClose');

        const cleanup = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (confirmBtn) confirmBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
            if (closeBtn) closeBtn.onclick = null;
            delete modal.dataset.deleteTimestamp;
        };

        if (confirmBtn) confirmBtn.onclick = async function () {
            try {
                const ts = modal.dataset.deleteTimestamp;
                await performDeleteTerrainEntry(ts);
            } finally {
                cleanup();
            }
        };
        if (cancelBtn) cancelBtn.onclick = cleanup;
        if (closeBtn) closeBtn.onclick = cleanup;
    } catch (err) {
        console.error('deleteTerrainEntry error', err);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function performDeleteTerrainEntry(timestamp) {
    // find and remove the entry, but keep a copy for undo
    const idx = (appState.terrainData || []).findIndex(e => e.timestamp === timestamp);
    if (idx === -1) { showNotification('Entrée introuvable', 'error'); return; }
    const [removed] = appState.terrainData.splice(idx, 1);

    // push to undo stack (short TTL)
    try { pushUndoDeletedEntry(removed, 30000); } catch (e) { /* ignore */ }

    // adjust project completed houses
    try {
        appState.project.completedHouses = (Number(appState.project.completedHouses) || 0) - (Number(removed.housesCount) || 0);
        if (appState.project.completedHouses < 0) appState.project.completedHouses = 0;
    } catch (e) { /* ignore */ }

    saveToLocalStorage();
    try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (performDeleteTerrainEntry)', e); }
    updateAppState();
    // re-render today's summary and history
    loadTodayProgress();
    // show undo toast
    try { showUndoToastForEntry(removed, 30000); } catch (e) { /* ignore */ }
    showNotification('Entrée supprimée (vous pouvez annuler)', 'info');
}

async function cancelMaterialRequest(id) {
    appState.materialRequests = appState.materialRequests.filter(r => r.id !== id);
    saveToLocalStorage();
    try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (cancelMaterialRequest)', e); }
    loadMaterialRequests();
    showNotification('Demande annulée', 'info');
}

function initializeCharts() {
    // Alias simple pour initialiser les graphiques disponibles
    try {
        initializeReportCharts();
    } catch (e) { /* ignore */ }
    try { updateScenarioChart(); } catch (e) { /* ignore */ }
    try { updateCharts(); } catch (e) { /* ignore */ }
}

// ============================================================================
// GESTION DU TERRAIN
// ============================================================================

async function handleTerrainSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    // Read generic unitsCompleted and map to housesCount depending on team prefix
    const selectedTeam = formData.get('team') || document.getElementById('teamSelect').value;
    const unitsRaw = formData.get('unitsCompleted') || document.getElementById('unitsCompleted')?.value || formData.get('housesCount') || document.getElementById('housesCount')?.value || 0;
    const units = parseInt(unitsRaw) || 0;

    const terrainEntry = {
        date: formData.get('date') || document.getElementById('inputDate').value,
        team: selectedTeam,
        // For aggregation functions we keep a normalized field `housesCount` which represents the primary unit for that actor
        housesCount: units,
        hoursWorked: parseFloat(formData.get('hoursWorked') || document.getElementById('hoursWorked').value) || 0,
        status: formData.get('status') || document.getElementById('workStatus').value,
        remarkType: document.getElementById('remarkType').value,
        severityLevel: document.getElementById('severityLevel').value,
        remarkDescription: document.getElementById('remarkDescription').value,
        timestamp: new Date().toISOString()
    };

    // Ajouter à la liste des données terrain
    appState.terrainData.push(terrainEntry);

    // Mettre à jour l'avancement du projet
    appState.project.completedHouses += terrainEntry.housesCount;

    // Sauvegarder et mettre à jour l'affichage
    saveToLocalStorage();
    try {
        await saveAppStateToIDB();
    } catch (e) {
        console.warn('saveAppStateToIDB failed (terrain submit)', e);
    }
    updateAppState();
    if (typeof updateDashboard === 'function') updateDashboard();

    // Recharger l'avancement du jour
    loadTodayProgress();

    // Réinitialiser le formulaire
    event.target.reset();
    document.getElementById('inputDate').valueAsDate = new Date();

    showNotification('Données terrain enregistrées', 'success');
}

function loadTodayProgress() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = Array.isArray(appState.terrainData) ? appState.terrainData.filter(entry => entry.date === today) : [];

    const totalHouses = todayData.reduce((sum, entry) => sum + (Number(entry.housesCount) || 0), 0);
    const totalHours = todayData.reduce((sum, entry) => sum + (Number(entry.hoursWorked) || 0), 0);
    const activeTeams = new Set(todayData.map(entry => entry.team)).size;
    const issuesCount = todayData.filter(entry => entry.remarkType).length;

    const elTodayHouses = document.getElementById('todayHouses'); if (elTodayHouses) elTodayHouses.textContent = totalHouses;
    const elTodayHours = document.getElementById('todayHours'); if (elTodayHours) elTodayHours.textContent = totalHours.toFixed(1);
    const elActiveTeams = document.getElementById('activeTeamsToday'); if (elActiveTeams) elActiveTeams.textContent = activeTeams;
    const elTodayIssues = document.getElementById('todayIssues'); if (elTodayIssues) elTodayIssues.textContent = issuesCount;

    // Mettre à jour le tableau du jour
    const tbody = document.getElementById('todayProgressTable');
    if (tbody) {
        tbody.innerHTML = todayData.map(entry => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(entry.team || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(entry.housesCount || 0)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(entry.hoursWorked || 0)}h</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${entry.status === 'completed' ? 'status-completed' : entry.status === 'in-progress' ? 'status-in-progress' : entry.status === 'pending' ? 'status-pending' : 'status-blocked'}">
                        ${entry.status === 'completed' ? 'Terminé' : entry.status === 'in-progress' ? 'En cours' : entry.status === 'pending' ? 'En attente' : 'Bloqué'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">${escapeHTML(entry.remarkDescription || 'Aucune')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button data-edit-timestamp="${escapeHTML(entry.timestamp)}" aria-label="Modifier" class="text-indigo-600 hover:text-indigo-900 mr-2 edit-terrain-btn">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </button>
                    <button data-delete-timestamp="${escapeHTML(entry.timestamp)}" aria-label="Supprimer" class="text-red-600 hover:text-red-900 delete-terrain-btn">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Render the paginated & filterable history table
    try { renderHistoryTable(); } catch (e) { console.warn('renderHistoryTable failed', e); }
}

// History filters & pagination state
const historyState = {
    filters: { team: '', dateFrom: '', dateTo: '' },
    page: 1,
    pageSize: 10
};

function applyHistoryFilters(data) {
    let filtered = Array.isArray(data) ? data.slice() : [];
    const f = historyState.filters;
    if (f.team) filtered = filtered.filter(d => d.team === f.team);
    if (f.dateFrom) filtered = filtered.filter(d => new Date(d.date) >= new Date(f.dateFrom));
    if (f.dateTo) filtered = filtered.filter(d => new Date(d.date) <= new Date(f.dateTo));
    // sort by timestamp desc
    filtered.sort((a, b) => (b.timestamp || 0) > (a.timestamp || 0) ? 1 : -1);
    return filtered;
}

function renderHistoryTable(page = historyState.page) {
    historyState.page = page;
    const tbody = document.getElementById('terrainEntriesTable');
    if (!tbody) return;

    // Ensure terrainData exists
    const raw = Array.isArray(appState.terrainData) ? appState.terrainData : [];
    const filtered = applyHistoryFilters(raw);

    const total = filtered.length;
    const pageSize = Number(document.getElementById('historyPageSize')?.value || historyState.pageSize) || 10;
    historyState.pageSize = pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const start = (currentPage - 1) * pageSize;
    const pageData = filtered.slice(start, start + pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td class="px-6 py-4 text-center text-gray-500" colspan="7">Aucune saisie enregistrée</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(entry => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHTML(entry.date || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(entry.team || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(entry.housesCount || 0)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatNumber(entry.hoursWorked || 0)}h</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="status-badge ${entry.status === 'completed' ? 'status-completed' : entry.status === 'in-progress' ? 'status-in-progress' : entry.status === 'pending' ? 'status-pending' : 'status-blocked'}">${escapeHTML(entry.status || '')}</span></td>
                <td class="px-6 py-4 text-sm text-gray-500">${escapeHTML(entry.remarkDescription || 'Aucune')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button data-edit-timestamp="${escapeHTML(entry.timestamp)}" aria-label="Modifier" class="text-indigo-600 hover:text-indigo-900 mr-2 edit-terrain-btn">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </button>
                    <button data-delete-timestamp="${escapeHTML(entry.timestamp)}" aria-label="Supprimer" class="text-red-600 hover:text-red-900 delete-terrain-btn">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Update pagination UI
    const indicator = document.getElementById('historyPageIndicator');
    if (indicator) indicator.textContent = `Page ${currentPage} / ${totalPages}`;
    const prevBtn = document.getElementById('historyPrevPage');
    const nextBtn = document.getElementById('historyNextPage');
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function setupHistoryControls() {
    // Wire filter controls and pagination
    const team = document.getElementById('historyTeamFilter');
    const dateFrom = document.getElementById('historyDateFrom');
    const dateTo = document.getElementById('historyDateTo');
    const pageSize = document.getElementById('historyPageSize');
    const prevBtn = document.getElementById('historyPrevPage');
    const nextBtn = document.getElementById('historyNextPage');

    const refresh = () => { historyState.page = 1; historyState.filters.team = team?.value || ''; historyState.filters.dateFrom = dateFrom?.value || ''; historyState.filters.dateTo = dateTo?.value || ''; renderHistoryTable(1); };

    if (team) team.onchange = refresh;
    if (dateFrom) dateFrom.onchange = refresh;
    if (dateTo) dateTo.onchange = refresh;
    if (pageSize) pageSize.onchange = () => { historyState.page = 1; renderHistoryTable(1); };
    if (prevBtn) prevBtn.onclick = () => { renderHistoryTable(Math.max(1, historyState.page - 1)); };
    if (nextBtn) nextBtn.onclick = () => { renderHistoryTable(historyState.page + 1); };

    // Initialize values from DOM if present
    historyState.filters.team = team?.value || '';
    historyState.filters.dateFrom = dateFrom?.value || '';
    historyState.filters.dateTo = dateTo?.value || '';
    historyState.pageSize = Number(pageSize?.value || historyState.pageSize);
}

// Ensure controls are set up after DOM ready
try { document.addEventListener('DOMContentLoaded', setupHistoryControls); } catch (e) { /* ignore */ }

// ------------------
// Team management
// ------------------

const defaultTeams = [
    { value: 'prep-1', label: 'Préparateurs - Équipe 1', count: 1 },
    { value: 'prep-2', label: 'Préparateurs - Équipe 2', count: 1 },
    { value: 'delivery-1', label: 'Livraison - Équipe 1', count: 1 },
    { value: 'delivery-2', label: 'Livraison - Équipe 2', count: 1 },
    { value: 'mason-1', label: 'Maçons - Équipe 1', count: 1 },
    { value: 'mason-2', label: 'Maçons - Équipe 2', count: 1 },
    { value: 'network-1', label: 'Électriciens Réseau - Équipe 1', count: 1 },
    { value: 'network-2', label: 'Électriciens Réseau - Équipe 2', count: 1 },
    { value: 'interior-1', label: 'Électriciens Intérieur - Équipe 1', count: 1 },
    { value: 'interior-2', label: 'Électriciens Intérieur - Équipe 2', count: 1 },
    { value: 'control-1', label: 'Contrôleurs - Équipe 1', count: 1 }
];

function getTeamsConfig() {
    // Ensure appState.teamsConfig exists
    if (!Array.isArray(appState.teamsConfig)) appState.teamsConfig = [];
    // Merge defaults and custom: custom entries can override labels/counts by value
    const map = {};
    defaultTeams.forEach(t => map[t.value] = { ...t });
    appState.teamsConfig.forEach(t => map[t.value] = { ...(map[t.value] || { value: t.value }), ...t });
    return Object.values(map);
}

function renderTeamOptions() {
    const select = document.getElementById('teamSelect');
    if (!select) return;
    const teams = getTeamsConfig();
    // clear and add default empty
    select.innerHTML = '<option value="">Sélectionner une équipe</option>' + teams.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
}

function openManageTeamsModal() {
    const modal = document.getElementById('manageTeamsModal');
    if (!modal) return;
    modal.classList.remove('hidden'); modal.classList.add('flex');
    // populate list
    const container = document.getElementById('teamsListContainer');
    container.innerHTML = '';
    const teams = getTeamsConfig();
    teams.forEach(t => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.dataset.value = t.value;
        row.innerHTML = `
            <input data-role="team-original" class="hidden" value="${t.value}">
            <input data-role="team-key" class="w-40 px-2 py-2 border rounded" value="${t.value}">
            <input data-role="team-label" class="flex-1 px-3 py-2 border rounded" value="${t.label}">
            <input data-role="team-count" type="number" min="1" class="w-24 px-2 py-2 border rounded" value="${t.count || 1}">
            <button data-role="delete-team" class="px-3 py-2 text-sm text-red-600">Suppr</button>
        `;
        container.appendChild(row);
        row.querySelector('[data-role="delete-team"]').onclick = () => { container.removeChild(row); };
    });

    // wire buttons
    document.getElementById('manageTeamsClose').onclick = closeManageTeamsModal;
    document.getElementById('manageTeamsModal').onclick = (e) => { if (e.target.id === 'manageTeamsModal') closeManageTeamsModal(); };
    document.getElementById('addTeamBtn').onclick = () => {
        const label = document.getElementById('newTeamLabel').value.trim();
        const count = Math.max(1, parseInt(document.getElementById('newTeamCount').value) || 1);
        if (!label) { showNotification('Indiquez un nom pour l\'équipe', 'error'); return; }
        const value = 'custom-' + Date.now();
        const container = document.getElementById('teamsListContainer');
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.dataset.value = value;
        row.innerHTML = `
            <input data-role="team-original" class="hidden" value="${value}">
            <input data-role="team-key" class="w-40 px-2 py-2 border rounded" value="${value}">
            <input data-role="team-label" class="flex-1 px-3 py-2 border rounded" value="${label}">
            <input data-role="team-count" type="number" min="1" class="w-24 px-2 py-2 border rounded" value="${count}">
            <button data-role="delete-team" class="px-3 py-2 text-sm text-red-600">Suppr</button>
        `;
        container.appendChild(row);
        row.querySelector('[data-role="delete-team"]').onclick = () => { container.removeChild(row); };
        // clear inputs
        document.getElementById('newTeamLabel').value = '';
        document.getElementById('newTeamCount').value = '';
    };

    document.getElementById('saveTeamsBtn').onclick = async () => {
        const rows = Array.from(document.querySelectorAll('#teamsListContainer > div'));
        // build config and detect key renames
        const config = [];
        const renames = [];
        const seenKeys = new Set();
        for (const r of rows) {
            const original = r.querySelector('[data-role="team-original"]')?.value || r.dataset.value || '';
            const key = (r.querySelector('[data-role="team-key"]')?.value || '').trim();
            const label = (r.querySelector('[data-role="team-label"]')?.value || '').trim();
            const count = Math.max(1, parseInt(r.querySelector('[data-role="team-count"]')?.value) || 1);
            if (!key) { showNotification('Chaque équipe doit avoir un identifiant (clé).', 'error'); return; }
            if (seenKeys.has(key)) { showNotification('Identifiants d\'équipe dupliqués: ' + key, 'error'); return; }
            seenKeys.add(key);
            config.push({ value: key, label, count });
            if (original && original !== key) renames.push({ from: original, to: key });
        }

        // If there are renames, ask whether to propagate to historical entries
        let propagate = false;
        if (renames.length > 0) {
            const msg = 'Vous avez renommé des identifiants d\'équipe. Voulez-vous remplacer les références dans les saisies historiques (les entrées terrain) ?\n\n' + renames.map(r => `${r.from} → ${r.to}`).join('\n');
            propagate = confirm(msg);
        }

        // Save to appState
        appState.teamsConfig = config;
        if (propagate && Array.isArray(appState.terrainData)) {
            renames.forEach(r => {
                appState.terrainData.forEach(entry => { if (entry.team === r.from) entry.team = r.to; });
            });
        }

        saveToLocalStorage();
        try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (saveTeamsConfig)', e); }
        renderTeamOptions();
        // Re-render history and today's progress to reflect possible propagation
        try { updateAppState(); } catch (e) { /* ignore */ }
        try { loadTodayProgress(); } catch (e) { /* ignore */ }
        closeManageTeamsModal();
        showNotification('Configuration des équipes enregistrée', 'success');
    };
}

function closeManageTeamsModal() {
    const modal = document.getElementById('manageTeamsModal');
    if (!modal) return;
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

// Ensure team options are rendered on load and wire the Manage button
document.addEventListener('DOMContentLoaded', function () {
    try { renderTeamOptions(); } catch (e) { /* ignore */ }
    const manageBtn = document.getElementById('manageTeamsBtn');
    if (manageBtn) manageBtn.onclick = openManageTeamsModal;
});

async function addMaterialRequest() {
    const type = document.getElementById('materialType').value;
    const quantity = parseInt(document.getElementById('materialQuantity').value);

    if (!type || !quantity) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }

    const request = {
        id: Date.now().toString(),
        type,
        quantity,
        status: 'pending',
        date: new Date().toISOString(),
        priority: 'medium'
    };

    appState.materialRequests.push(request);
    saveToLocalStorage();
    try { await saveAppStateToIDB(); } catch (e) { console.warn('IDB save failed (addMaterialRequest)', e); }
    loadMaterialRequests();

    // Réinitialiser le formulaire
    document.getElementById('materialQuantity').value = '';

    showNotification('Demande de matériel ajoutée', 'success');
}

function loadMaterialRequests() {
    const container = document.getElementById('materialRequestsList');
    if (!container) return;

    // Ensure materialRequests exists
    if (!Array.isArray(appState.materialRequests)) appState.materialRequests = [];

    if (appState.materialRequests.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune demande en cours</p>';
        return;
    }

    // Render list safely using string builder to avoid broken template literals
    let html = '';
    appState.materialRequests.forEach(request => {
        html += '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">';
        html += '<div class="flex items-center space-x-4">';
        html += '<div class="p-2 bg-blue-100 rounded"><i class="fas fa-box text-blue-600" aria-hidden="true"></i></div>';
        html += '<div><p class="font-medium text-gray-800">' + escapeHTML(request.type || '') + '</p>';
        html += '<p class="text-sm text-gray-500">Quantité: ' + formatNumber(request.quantity || 0) + '</p></div>';
        html += '</div>';
        html += '<div class="flex items-center space-x-2">';
        const statusClass = (request.status === 'approved' || request.status === 'delivered') ? 'status-completed' : 'status-pending';
        const statusLabel = request.status === 'approved' ? 'Approuvée' : request.status === 'delivered' ? 'Livrée' : 'En attente';
        html += '<span class="status-badge ' + statusClass + '">' + statusLabel + '</span>';
        html += '<button data-cancel-request="' + escapeHTML(request.id || '') + '" aria-label="Annuler la demande" class="text-red-600 hover:text-red-900 cancel-request-btn">';
        html += '<i class="fas fa-times" aria-hidden="true"></i></button>';
        html += '</div></div>';
    });
    container.innerHTML = html;
}