/**
 * Service de domaine pour le calcul des coûts
 * Gère la logique complexe de calcul des coûts du projet
 */
(function () {
    // Resolve dependencies
    let _Project, _ValidationError, _Cost, _DEFAULT_COSTS, _TeamType;
    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Project = require('../entities/Project');
            _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
            _Cost = require('../value-objects/Cost');
            const enums = require('../../shared/constants/enums');
            _DEFAULT_COSTS = enums.DEFAULT_COSTS;
            _TeamType = enums.TeamType;
        }
    } catch (e) {
        _Project = typeof window !== 'undefined' ? window.Project : _Project;
        _ValidationError = typeof window !== 'undefined' ? window.ValidationError : _ValidationError;
        _Cost = typeof window !== 'undefined' ? window.Cost : _Cost;
        _DEFAULT_COSTS = typeof window !== 'undefined' ? window.DEFAULT_COSTS : _DEFAULT_COSTS;
        _TeamType = typeof window !== 'undefined' ? window.TeamType : _TeamType;
    }

    const ProjectLocal = _Project?.default || _Project?.Project || _Project;
    const ValidationErrorLocal = _ValidationError;
    const CostLocal = _Cost?.default || _Cost?.Cost || _Cost;
    const DEFAULT_COSTS_LOCAL = _DEFAULT_COSTS || {};
    const TeamTypeLocal = _TeamType;

    class CostCalculationService {
        constructor(pricingConfig = null) {
            // Default pricing structure with fallback values (FCFA)
            const defaultPricing = {
                VEHICLES: {
                    delivery_purchase: 15000000,
                    delivery_rent_per_day: 50000,
                    pm_purchase: 20000000,
                    pm_rent_per_day: 75000
                },
                EQUIPMENT: {
                    laptop: 500000,
                    phone: 150000,
                    tablet: 300000
                },
                FUEL_PER_LITER: 650,
                DAILY_RATES: {
                    preparateurs: 5000,
                    livraison: 5000,
                    macons: 7000,
                    reseau: 6000,
                    interieur_type1: 6000,
                    interieur_type2: 6000,
                    controleur: 5000,
                    superviseur: 10000
                },
                POTELET_COST: {
                    galva4m: 8500
                },
                SECONDARY_PANEL_COST: {
                    standard: 12000
                }
            };

            this.pricing = pricingConfig || (typeof window !== 'undefined' ? window.DEFAULT_COSTS : null) || (typeof globalThis !== 'undefined' ? globalThis.DEFAULT_COSTS : null) || DEFAULT_COSTS_LOCAL || defaultPricing;
        }

        // --- MÉTHODES STATIQUES AMÉLIORÉES ---
        static scenarios = [];

        /**
         * Calcule le coût total du projet avec une ventilation détaillée.
         */
        static async calculateDetailedCosts(project, teams) {
            const households = await HouseholdRepository.getAll();
            const totalHouseholds = households.length || 80000;
            const requirements = await ResourceAllocationService.calculateGlobalRequirements(project, teams);
            const staffConfig = project.staffConfig || {};
            const legacyCosts = project.costs || {};

            const getStaffCost = (roleId, count, duration) => {
                // Resolve cost and mode from config or legacy
                // RoleId usually matches keys like 'perMasonTeam' or 'perSupervisor'
                const config = staffConfig[roleId];
                const dailyRate = config ? config.amount : (legacyCosts[roleId] || 100000); // Amount is daily equivalent or full rate
                const mode = config ? config.mode : 'daily';

                if (mode === 'monthly') {
                    // Monthly salary * (duration / 30) * count
                    return Math.round(dailyRate * (Math.max(1, duration) / 30)) * count;
                } else if (mode === 'task') {
                    // Cost per task. How many tasks?
                    // Approximation: treat 'amount' as daily production value equivalent for now * duration
                    // OR if we assume amount is cost *per unit*, we need unit count.
                    // As fallback: treat as daily cost for global estimation
                    return dailyRate * duration * count;
                } else {
                    // Daily
                    return dailyRate * duration * count;
                }
            };

            // 1. Coûts des équipes techniques (Core: Maçon, Réseau, Intérieur)
            const durationForTeams = project.duration || requirements.duration || 180;
            const teamCosts = Object.entries(requirements.teams).reduce((sum, [type, data]) => {
                const mapToKey = {
                    'Maçon': 'perMasonTeam',
                    'Réseau': 'perNetworkTeam',
                    'Intérieur': 'perInteriorTeam'
                };
                const costKey = mapToKey[type] || `per${type.replace(/\s+/g, '')}Team`;
                return sum + getStaffCost(costKey, data.required, durationForTeams);
            }, 0);

            // 2. Coûts logistiques (Location + Carburant)
            const projectDuration = Number(project.duration) || Number(requirements.duration) || 180;
            const logisticsCosts = Object.entries(requirements.vehicles || {}).reduce((sum, [type, data]) => {
                const costs = project.costs || {};
                const vehicleRental = costs.vehicleRental || {};
                const rentalRate = Number(vehicleRental[type]) || 50000;
                const count = Number(data.required) || 0;
                return sum + (count * rentalRate * projectDuration);
            }, 0) + (Number(requirements.fuel?.totalCost) || 0);

            // 3. Coûts matériels (Exemple basé sur ratios)
            const matCosts = project.materialUnitCosts || {};
            const materialCosts = totalHouseholds * (
                (matCosts.potelet || 15000) +
                (16 * (matCosts.cable16mm || 5000)) +
                (matCosts.coffret || 30000) +
                (matCosts.kitInterieur || 180000)
            );

            // 4. Coûts de support (inclut Superviseurs, Préparateurs, Livreurs, etc.)
            let supportCosts = 0;
            if (requirements.support) {
                Object.entries(requirements.support).forEach(([role, data]) => {
                    let costKey = '';
                    if (role === 'Superviseurs' || role === 'Superviseur') costKey = 'perSupervisor';
                    else if (role === 'Chauffeurs') costKey = 'perDriver';
                    else if (role === 'Préparateurs' || role === 'Préparateur') costKey = 'perPreparateur';
                    else if (role === 'Livreurs' || role === 'Livreur') costKey = 'perLivreur';
                    else if (role === 'Contrôleurs' || role === 'Contrôleur') costKey = 'perController';
                    else if (role === 'Chef de Projet') costKey = 'perProjectManager';

                    let count = data.required || 0;

                    // Fallback for Chauffeurs/PM if not in staffConfig explicitly (can add to UI later)
                    // For now, use a default safe value if key not found in UI map
                    // But we used 'perController' in UI, let's see.

                    // Use getStaffCost wrapper. If Key absent, default 100000 used.
                    // Customize defaults for support roles:
                    let roleDefault = 5000;
                    if (role === 'Chef de Projet') roleDefault = 50000;

                    // Check if config exists, if not use default
                    const config = staffConfig[costKey];
                    const amount = config ? config.amount : (legacyCosts[costKey] || roleDefault);
                    const mode = config ? config.mode : 'daily';

                    // Inline calculation to restart specific checks
                    let val = 0;
                    const durationForSupport = project.duration || requirements.duration || 180;
                    if (mode === 'monthly') val = Math.round(amount * (durationForSupport / 30)) * count;
                    else val = amount * durationForSupport * count;

                    supportCosts += val;
                });
            } else {
                // Fallback if support requirements not calculated
                supportCosts = await this._calculateSupervisionCosts(project, teams);
            }


            const total = teamCosts + logisticsCosts + materialCosts + supportCosts;

            return {
                total,
                breakdown: {
                    teams: teamCosts,
                    logistics: logisticsCosts,
                    materials: materialCosts,
                    supervision: supportCosts,
                    fuel: requirements.fuel.totalCost,
                    vehicles: Object.fromEntries(
                        Object.entries(requirements.vehicles).map(([type, data]) => [
                            type,
                            data.required * (project.costs.vehicleRental[type] || 50000) * project.duration
                        ])
                    )
                },
                requirements
            };
        }

        /**
         * Exécute une simulation complète avec tous les coûts.
         */
        static async runFullSimulation(params) {
            const project = await ProjectRepository.getCurrent();
            const allTeams = await TeamRepository.getAll();

            // Mapper les params de l'UI vers les équipes si nécessaire, 
            // mais ici on assume que teams est déjà passé ou on simule via params
            // Si params contient masonTeams, networkTeams, etc.
            const simTeams = [
                { type: 'mason', count: parseInt(params.masonTeams) || 0 },
                { type: 'network', count: parseInt(params.networkTeams) || 0 },
                { type: 'interior', count: parseInt(params.interiorTeams) || 0 },
                { type: 'controller', count: parseInt(params.controllerTeams) || 0 },
                { type: 'preparateur', count: parseInt(params.preparateurTeams) || 1 },
                { type: 'livreur', count: parseInt(params.livreurTeams) || 1 }
            ];

            // Mettre à jour temporairement le projet avec les paramètres de simulation
            const tempProject = {
                ...project,
                duration: parseInt(params.projectDuration) || project.duration,
                logistics: {
                    ...project.logistics,
                    fuelPrice: parseFloat(params.fuelPrice) || project.logistics.fuelPrice
                }
            };

            const costs = await this.calculateDetailedCosts(tempProject, simTeams);
            const efficiency = this._calculateEfficiency(costs, tempProject);

            return {
                ...costs,
                duration: tempProject.duration,
                efficiency
            };
        }

        static _calculateEfficiency(costs, project) {
            const totalHouseholds = costs.requirements.teams.Maçon?.totalHouseholds || 80000; // Simplified
            return {
                costPerHousehold: costs.total / totalHouseholds,
                teamProductivity: 1 / project.duration, // Placeholder
                vehicleUtilization: 1.0 // Placeholder
            };
        }

        static async runSimulation(params) {
            // Rétrocompatibilité
            return this.runFullSimulation(params);
        }

        static saveScenario(params, results) {
            const scenario = {
                id: Date.now(),
                date: new Date().toISOString(),
                params: { ...params },
                results: { ...results }
            };
            this.scenarios.push(scenario);
            return scenario;
        }

        static getScenarios() {
            return this.scenarios;
        }

        /**
         * Calcule le coût total d'un projet
         */
        calculateProjectCost(project, duration, options = {}) {
            if (!(project instanceof (ProjectLocal || window.Project))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Project instance');
            }

            let totalCost = (CostLocal || window.Cost).zero('XOF');
            const params = { ...project.parameters, ...options };

            // Coûts de main d'œuvre
            const laborCost = this.calculateLaborCost(project.getAllTeams(), duration, params, project.totalHouses);
            totalCost = totalCost.add(laborCost);

            // Coûts de matériaux
            const materialCost = this.calculateMaterialCost(project.totalHouses, params);
            totalCost = totalCost.add(materialCost);

            // Coûts logistiques
            const logisticsCost = this.calculateLogisticsCost(project.zones, duration, params);
            totalCost = totalCost.add(logisticsCost);

            // Coûts de supervision
            const supervisionCost = this.calculateSupervisionCost(project.getAllTeams(), duration);
            totalCost = totalCost.add(supervisionCost);

            return {
                total: totalCost,
                breakdown: {
                    labor: laborCost,
                    materials: materialCost,
                    logistics: logisticsCost,
                    supervision: supervisionCost
                }
            };
        }

        /**
         * Calcule le coût de la main d'œuvre
         */
        calculateLaborCost(teams, duration, params = {}, totalHouses = 0) {
            let cost = (CostLocal || window.Cost).zero('XOF');
            const staffConfig = params.staffConfig || {};
            const paymentModes = params.paymentModes || {};
            const userCosts = params.costs || {}; // Dynamic costs from UI
            const TT = TeamTypeLocal || window.TeamType;

            // Cas spécial : Maçonnerie en sous-traitance
            if (paymentModes[TT.MACONS] === 'subcontract') {
                const modelKey = params.masonryModel || 'model1_standard';
                const model = this.pricing.SUBCONTRACTING_MASONRY[modelKey] || this.pricing.SUBCONTRACTING_MASONRY.model1_standard;
                const masonryCost = totalHouses * model.pricePerHouse;
                cost = cost.add(new (CostLocal || window.Cost)(masonryCost, 'XOF'));

                // Filtrer les équipes de maçons car gérées en sous-traitance
                teams = teams.filter(t => t.type !== TT.MACONS);
            }

            for (const team of teams) {
                // Determine if we have a user-provided cost for this team type
                // Check staffConfig first (new detailed mode), then legacy userCosts
                let specificCost = userCosts[team.type];
                let mode = paymentModes[team.type] || 'daily';

                // Map team type to staffConfig ID conventions (needs loose matching or consistent IDs)
                // IDs used in UI: perMasonTeam, perNetworkTeam, etc.
                const configId = `per${team.type.charAt(0).toUpperCase() + team.type.slice(1).toLowerCase()}Team`;
                // Or try direct type match
                const configKey = Object.keys(staffConfig).find(k => k.toLowerCase().includes(team.type.toLowerCase()));

                if (configKey && staffConfig[configKey]) {
                    specificCost = staffConfig[configKey].amount;
                    mode = staffConfig[configKey].mode;
                }

                const teamCost = this.calculateTeamCost(team, duration, mode, specificCost);
                cost = cost.add(teamCost);
            }

            return cost;
        }

        /**
         * Calcule le coût d'une équipe
         */
        calculateTeamCost(team, duration, paymentMode = 'daily', costOverride = null) {
            // Priority: User override > Default pricing
            const baseRate = costOverride !== null ? costOverride : this.getDailyRateForTeam(team.type);

            if (paymentMode === 'per-task') {
                // If per-task, baseRate is interpreted as Cost Per Unit (Task)
                // We need to know how many tasks? 
                // APPROXIMATION: For resource allocation, we often assume full capacity.
                // If we don't have task count per team, we might treat it as daily equivalent for now
                // OR ideally, we should calculate (TotalTasks / TotalTeams) * CostPerTask
                // But here we are calculating per TEAM instance.

                // fallback to treating user input as daily rate equivalent for simplicity in this version
                // unless we have specific task count on the team object.
                const dailyRate = baseRate;
                return new (CostLocal || window.Cost)(dailyRate * duration * (team.members.length || 1));
            }

            // Daily mode
            const dailyRate = baseRate;
            const totalDays = paymentMode === 'monthly' ? duration * 30 : duration; // Assume 30 days per month
            const memberCount = team.members.length || 1;

            return new (CostLocal || window.Cost)(dailyRate * totalDays * memberCount, 'XOF');
        }

        /**
         * Obtient le taux journalier pour un type d'équipe
         */
        getDailyRateForTeam(teamType) {
            const TT = TeamTypeLocal || window.TeamType;

            // Defensive check
            if (!this.pricing || !this.pricing.DAILY_RATES) {
                console.warn('Pricing DAILY_RATES not available, using default 5000', { pricing: this.pricing, DEFAULT_COSTS_LOCAL, window_DEFAULT_COSTS: window.DEFAULT_COSTS, globalThis_DEFAULT_COSTS: globalThis.DEFAULT_COSTS });
                return 5000;
            }

            const rateMap = {
                [TT.PREPARATEURS]: this.pricing.DAILY_RATES.preparateurs ?? 5000,
                [TT.LIVRAISON]: this.pricing.DAILY_RATES.livraison ?? 5000,
                [TT.MACONS]: this.pricing.DAILY_RATES.macons ?? 7000,
                [TT.RESEAU]: this.pricing.DAILY_RATES.reseau ?? 6000,
                [TT.INTERIEUR_TYPE1]: this.pricing.DAILY_RATES.interieur_type1 ?? 6000,
                [TT.INTERIEUR_TYPE2]: this.pricing.DAILY_RATES.interieur_type2 ?? 6000,
                [TT.CONTROLE]: this.pricing.DAILY_RATES.controleur ?? 5000
            };

            return rateMap[teamType] || 5000;
        }

        /**
         * Calcule le coût des matériaux
         */
        calculateMaterialCost(totalHouses, params = {}) {
            let total = 0;

            // Potelets (toujours requis)
            const poteletCost = this.pricing.POTELET_COST?.galva4m || 8500;
            total += totalHouses * poteletCost;

            // Coffrets (pour Type 1)
            const type1Share = params.type1Share || 0.6; // Default ratio
            const type1Houses = Math.round(totalHouses * type1Share);
            const panelCost = this.pricing.SECONDARY_PANEL_COST?.standard || 12000;
            total += type1Houses * panelCost;

            // Autres matériaux (câbles, etc.) - Forfaitaire
            const otherMaterials = 100000 * totalHouses;
            total += otherMaterials;

            return new (CostLocal || window.Cost)(total, 'XOF');
        }

        /**
         * Calcule les coûts logistiques
         */
        calculateLogisticsCost(zones, duration, params = {}) {
            let cost = (CostLocal || window.Cost).zero('XOF');

            // Coût des véhicules
            const vehicleCost = this.calculateVehicleCost(zones.length, duration, params);
            cost = cost.add(vehicleCost);

            // Coût du carburant
            const fuelCost = this.calculateFuelCost(zones, duration, params);
            cost = cost.add(fuelCost);

            return cost;
        }

        /**
         * Calcule le coût des véhicules
         */
        calculateVehicleCost(zoneCount, duration, params = {}) {
            let total = 0;
            const acquisitionMode = params.acquisitionMode || {};

            // Defensive check: ensure pricing structure exists
            if (!this.pricing || !this.pricing.VEHICLES) {
                console.warn('Pricing data not available for vehicle cost calculation, using defaults');
                // Use default values directly
                const defaultVehicles = {
                    delivery_purchase: 15000000,
                    delivery_rent_per_day: 50000,
                    pm_purchase: 20000000,
                    pm_rent_per_day: 75000
                };

                // Véhicules de livraison (1 par zone/équipe livraison)
                const deliveryVehicles = zoneCount; // Simplification
                if (acquisitionMode.delivery === 'purchase') {
                    total += deliveryVehicles * defaultVehicles.delivery_purchase;
                } else {
                    total += deliveryVehicles * defaultVehicles.delivery_rent_per_day * duration;
                }

                // Véhicules PM (toujours 1)
                if (acquisitionMode.pm === 'purchase') {
                    total += defaultVehicles.pm_purchase;
                } else {
                    total += defaultVehicles.pm_rent_per_day * duration;
                }

                return new (CostLocal || window.Cost)(total, 'XOF');
            }

            // Véhicules de livraison (1 par zone/équipe livraison)
            const deliveryVehicles = zoneCount; // Simplification
            if (acquisitionMode.delivery === 'purchase') {
                total += deliveryVehicles * (this.pricing.VEHICLES.delivery_purchase ?? 15000000);
            } else {
                total += deliveryVehicles * (this.pricing.VEHICLES.delivery_rent_per_day ?? 50000) * duration;
            }

            // Véhicules PM (1 par projet)
            if (acquisitionMode.pm === 'purchase') {
                total += (this.pricing.VEHICLES.pm_purchase ?? 20000000);
            } else {
                total += (this.pricing.VEHICLES.pm_rent_per_day ?? 75000) * duration;
            }

            return new (CostLocal || window.Cost)(total, 'XOF');
        }

        /**
         * Calcule le coût du carburant
         */
        calculateFuelCost(zones, duration, params = {}) {
            // Estimation : 20 litres par jour par zone + PM
            const litersPerDayPerZone = 20;
            const pmLitersPerDay = 15;

            const totalLiters = (zones.length * litersPerDayPerZone + pmLitersPerDay) * duration;

            return new (CostLocal || window.Cost)(totalLiters * (this.pricing.FUEL_PER_LITER ?? 1000), 'XOF');
        }

        /**
         * Calcule les coûts de supervision
         */
        calculateSupervisionCost(teams, duration) {
            // 1 superviseur pour 10 équipes
            const supervisorsNeeded = Math.ceil(teams.length / 10);

            // Defensive check for pricing data
            const dailyRate = this.pricing?.DAILY_RATES?.superviseur ?? 10000;

            return new (CostLocal || window.Cost)(supervisorsNeeded * dailyRate * duration, 'XOF');
        }

        /**
         * Calcule le coût par ménage
         */
        calculateCostPerHouse(totalCost, totalHouses) {
            if (totalHouses === 0) {
                return (CostLocal || window.Cost).zero();
            }
            return totalCost.divide(totalHouses);
        }

        /**
         * Estime le budget nécessaire pour un projet
         */
        estimateBudget(totalHouses, targetDuration, zones) {
            // Créer un projet temporaire pour l'estimation
            const tempProject = new (ProjectLocal || window.Project)(
                'temp',
                'Estimation',
                totalHouses,
                new Date()
            );

            // Ajouter des zones
            for (const zoneData of zones) {
                const zone = new (window.Zone)( // Assuming Zone is globally available or we need to resolve it
                    `zone-${zoneData.name}`,
                    zoneData.name,
                    zoneData.houses
                );
                tempProject.addZone(zone);
            }

            // Calculer le coût
            const costBreakdown = this.calculateProjectCost(tempProject, targetDuration);

            // Ajouter une marge de sécurité de 10%
            const margin = costBreakdown.total.multiply(0.1);
            const estimatedBudget = costBreakdown.total.add(margin);

            return {
                estimated: estimatedBudget,
                breakdown: costBreakdown.breakdown,
                margin,
                costPerHouse: this.calculateCostPerHouse(estimatedBudget, totalHouses)
            };
        }

        /**
         * Compare deux scénarios de coûts
         */
        compareScenarios(scenario1, scenario2) {
            const diff = scenario1.total.amount - scenario2.total.amount;
            const percentDiff = (diff / scenario2.total.amount) * 100;

            return {
                difference: new (CostLocal || window.Cost)(Math.abs(diff)),
                percentDifference: percentDiff,
                cheaper: diff < 0 ? 'scenario1' : 'scenario2',
                recommendation: this.getRecommendation(scenario1, scenario2)
            };
        }

        /**
         * Obtient une recommandation basée sur les scénarios
         */
        getRecommendation(scenario1, scenario2) {
            const diff = scenario1.total.amount - scenario2.total.amount;

            if (Math.abs(diff) < scenario2.total.amount * 0.05) {
                return 'Les deux scénarios sont équivalents en termes de coût';
            } else if (diff < 0) {
                return 'Le scénario 1 est plus économique';
            } else {
                return 'Le scénario 2 est plus économique';
            }
        }

        /**
         * Calcule le coût total du projet incluant main-d'œuvre et matériaux
         * @param {Array} teams - Équipes assignées
         * @param {number} totalHouses - Nombre total de maisons
         * @param {number} duration - Durée en jours
         * @param {Object} params - Paramètres supplémentaires
         * @returns {Object} Résultat avec amount et breakdown
         */
        calculateTotalCost(teams, totalHouses, duration, params = {}) {
            const laborCost = this.calculateLaborCost(teams, duration, params, totalHouses);
            const materialCost = this.calculateMaterialCost(totalHouses, params);

            const totalAmount = laborCost.amount + materialCost.amount;

            return {
                amount: totalAmount,
                breakdown: {
                    labor: laborCost,
                    materials: materialCost
                }
            };
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.CostCalculationService = CostCalculationService;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CostCalculationService;
    }

    // Export ES6 pour les tests
    if (typeof globalThis !== 'undefined') {
        globalThis.CostCalculationService = CostCalculationService;
    }
})();
