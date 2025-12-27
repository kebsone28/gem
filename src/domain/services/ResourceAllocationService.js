/**
 * Service d'allocation des ressources
 * Gère l'affectation des équipes aux zones
 */
// Prevent leaking top-level `let`/`class` declarations into the global
// script scope when this file is loaded via a plain <script> tag.
// Wrapping the module in an IIFE avoids "Identifier ... has already been declared"
// runtime SyntaxErrors in browsers while preserving globals and CommonJS exports.
(function () {

    // Imports dynamiques pour compatibilité
    let _TeamType, _ProductivityRate, _ValidationError, _ConstraintViolationError;

    try {
        if (typeof module !== 'undefined' && module.exports) {
            const enums = require('../../shared/constants/enums');
            _TeamType = enums.TeamType;
            _ProductivityRate = require('../value-objects/ProductivityRate');
            const errors = require('../../shared/errors/DomainErrors');
            _ValidationError = errors.ValidationError;
            _ConstraintViolationError = errors.ConstraintViolationError;
        }
    } catch (e) {
        // ignore
    }

    if (!_TeamType && typeof window !== 'undefined') {
        _TeamType = window.TeamType;
    }
    if (!_ProductivityRate && typeof window !== 'undefined') {
        _ProductivityRate = window.ProductivityRate;
    }
    if (!_ValidationError && typeof window !== 'undefined') {
        _ValidationError = window.ValidationError;
    }
    if (!_ConstraintViolationError && typeof window !== 'undefined') {
        _ConstraintViolationError = window.ConstraintViolationError;
    }

    const TeamTypeLocal = _TeamType;
    const ProductivityRateLocal = _ProductivityRate?.default || _ProductivityRate?.ProductivityRate || _ProductivityRate;
    const ValidationErrorLocal = _ValidationError;
    const ConstraintViolationErrorLocal = _ConstraintViolationError;

    class ResourceAllocationService {
        constructor() {
            // Ensure dependencies are available
            this.TeamType = TeamTypeLocal || window.TeamType;
            this.ProductivityRate = ProductivityRateLocal || window.ProductivityRate;
            this.Enums = {
                DEFAULT_PRODUCTIVITY: window.DEFAULT_PRODUCTIVITY || {},
                CALCULATION_RATIOS: window.CALCULATION_RATIOS || {},
                DEFAULT_COSTS: window.DEFAULT_COSTS || {}
            };
        }

        // --- MÉTHODES STATIQUES AMÉLIORÉES ---
        static getNormalizedType(type) {
            if (!type) return 'Inconnu';
            const mapping = {
                'mason': 'Maçon', 'maçon': 'Maçon',
                'network': 'Réseau', 'réseau': 'Réseau',
                'interior': 'Intérieur', 'intérieur': 'Intérieur',
                'controller': 'Contrôleur', 'contrôleur': 'Contrôleur',
                'preparateur': 'Préparateur', 'préparateur': 'Préparateur',
                'livreur': 'Livreur',
                'supervisor': 'Superviseur', 'superviseur': 'Superviseur'
            };
            const lower = type.toLowerCase().trim();
            // Retirer les variantes "Team" ou "Equipe" pour normaliser sur la base
            const cleaned = lower.replace('equipe', '').replace('team', '').replace('l\'', '').trim();
            return mapping[cleaned] || mapping[lower] || type;
        }

        static async autoAssignHouseholds(teams, households) {
            const pendingHouseholds = households.filter(h => h.status === 'Attente démarrage');

            for (const team of teams) {
                const maxCapacity = this.getTeamCapacity(team.type);
                const assignedHouseholds = pendingHouseholds.splice(0, maxCapacity);

                for (const household of assignedHouseholds) {
                    household.teamId = team.id;
                    household.status = `Attente ${team.type}`;
                    await HouseholdRepository.update(household);
                }
            }
        }

        /**
         * Calcule les besoins globaux en ressources pour le projet.
         * @param {Object} project - Projet courant
         * @param {Array} teams - Équipes actuelles
         * @returns {Object} Besoins en véhicules, équipements, et personnel
         */
        static async calculateGlobalRequirements(project, teams) {
            const households = await HouseholdRepository.getAll();
            const totalHouseholds = households.length || 80000;
            const duration = project.duration || 180;

            // 1. Calculer le nombre d'équipes nécessaires avec précision
            const requiredTeams = {};
            const teamCaps = project.teamCapabilities || {};

            // Group capabilities by normalized type first to avoid duplicates (e.g. Mason vs Maçon)
            const groupedCaps = {};
            Object.entries(teamCaps).forEach(([type, cap]) => {
                const normalized = this.getNormalizedType(type);
                if (!groupedCaps[normalized]) {
                    groupedCaps[normalized] = {
                        daily: 0,
                        originalTypes: []
                    };
                }
                // We take the max daily rate for the normalized group
                groupedCaps[normalized].daily = Math.max(groupedCaps[normalized].daily, cap.daily || 0);
                groupedCaps[normalized].originalTypes.push(type);
            });

            // Now calculate requirements for each consolidated group
            Object.entries(groupedCaps).forEach(([normalizedType, capData]) => {
                // EXCLURE les rôles de support du tableau "Equipes Techniques"
                const supportRoles = ['Contrôleur', 'Préparateur', 'Livreur', 'Superviseur'];
                if (supportRoles.includes(normalizedType)) return;

                const teamsOfType = teams.filter(t =>
                    t.type && this.getNormalizedType(t.type) === normalizedType
                ).length;

                const dailyRate = Math.max(0.01, capData.daily);
                const safeDuration = Math.max(1, duration);
                const required = Math.ceil(totalHouseholds / (dailyRate * safeDuration));

                requiredTeams[normalizedType] = {
                    current: teamsOfType,
                    required: required,
                    gap: Math.max(0, required - teamsOfType),
                    dailyRate: dailyRate,
                    originalTypes: capData.originalTypes
                };
            });

            // 2. Calculer les besoins en véhicules
            const vehicleRequirements = this._calculateVehicles(teams, project);

            // 3. Calculer les besoins en équipements (détaillés)
            const equipmentRequirements = this._calculateEquipmentDetailed(requiredTeams, project);

            // 4. Calculer le personnel de support
            const supportStaff = this.calculateSupportStaffDetailed(requiredTeams, project);

            return {
                totalHouseholds,
                duration,
                teams: requiredTeams,
                vehicles: vehicleRequirements,
                equipment: equipmentRequirements,
                support: supportStaff,
                fuel: this._calculateFuel(vehicleRequirements, project)
            };
        }

        static _calculateVehicles(teams, project) {
            const requirements = {};
            const teamCaps = project.teamCapabilities || {};

            // Initialiser les compteurs par type de véhicule
            const vehicleTypes = Object.keys(project.logistics.vehicles);
            vehicleTypes.forEach(v => {
                requirements[v] = { required: 0, current: project.logistics.vehicles[v].count || 0, gap: 0 };
            });

            // Calculer les besoins basés sur la config de chaque type d'équipe
            Object.entries(teamCaps).forEach(([type, cap]) => {
                const vehicleType = cap.vehicleType; // e.g., 'pickup', 'truck', 'motorcycle'
                if (vehicleType && requirements[vehicleType]) {
                    // Trouver le nombre d'équipes nécessaires de ce type
                    const totalHouseholds = Number(project.totalHouses) || 80000;
                    const duration = Number(project.duration) || 180;
                    const dailyRate = Math.max(0.1, Number(cap.daily) || 1);
                    const requiredTeamsCount = Math.ceil(totalHouseholds / (dailyRate * duration));

                    // Ratio par défaut: 1 véhicule pour N équipes (ex: 1 pickup pour 2 équipes réseau, 1 moto par contrôleur)
                    let ratio = 0.5; // Par défaut 1 pour 2
                    if (vehicleType === 'motorcycle') ratio = 1;
                    if (vehicleType === 'truck') ratio = 0.2; // 1 pour 5

                    requirements[vehicleType].required += Math.ceil(requiredTeamsCount * ratio);
                }
            });

            // Recalculer les écarts
            Object.keys(requirements).forEach(v => {
                requirements[v].gap = Math.max(0, requirements[v].required - requirements[v].current);
            });

            return requirements;
        }

        static calculateSupportStaffDetailed(requiredTeams, project) {
            const support = {};
            const totalTechnicalTeams = Object.values(requiredTeams).reduce((sum, t) => sum + t.required, 0);

            // 1. Superviseurs (Ratio configurable ou par défaut 1 pour 10)
            const supervisorRatio = 10;
            support['Superviseurs'] = {
                required: Math.ceil(totalTechnicalTeams / supervisorRatio),
                description: `Basé sur 1 superviseur pour ${supervisorRatio} équipes techniques.`
            };

            // 2. Chauffeurs (Généralement 1 par camion/véhicule lourd)
            const vehicles = this._calculateVehicles(null, project);
            const heavyVehicles = (vehicles.truck?.required || 0) + (vehicles.pickup?.required || 0);
            support['Chauffeurs'] = {
                required: heavyVehicles,
                description: "1 chauffeur par véhicule de transport (Camions & Pickups)."
            };

            // 3. Chef de Projet
            support['Chef de Projet'] = {
                required: 1,
                description: "Coordination globale du projet."
            };

            // 4. Préparateurs (Logistique déportée)
            const preparatorRatio = 20; // 1 pour 20 équipes
            support['Préparateurs'] = {
                required: Math.max(1, Math.ceil(totalTechnicalTeams / preparatorRatio)),
                description: `Gestion des kits (1 pour ${preparatorRatio} équipes).`
            };

            // 5. Livreurs (Approvisionnement rapide)
            const deliveryRatio = 15; // 1 pour 15 équipes
            support['Livreurs'] = {
                required: Math.max(1, Math.ceil(totalTechnicalTeams / deliveryRatio)),
                description: `Rotation matériel (1 pour ${deliveryRatio} équipes).`
            };

            // 6. Contrôleurs (Qualité)
            const controllerRatio = 15;
            support['Contrôleurs'] = {
                required: Math.max(1, Math.ceil(totalTechnicalTeams / controllerRatio)),
                description: `Contrôle qualité (1 pour ${controllerRatio} équipes).`
            };

            return support;
        }

        static _calculateEquipmentDetailed(requiredTeams, project) {
            const equipment = {};

            Object.entries(requiredTeams).forEach(([type, data]) => {
                const capability = project.teamCapabilities[type.toLowerCase()];
                if (capability && capability.equipment) {
                    capability.equipment.forEach(item => {
                        if (!equipment[item]) equipment[item] = 0;
                        // On multiplie par le nombre d'équipes requises (car 1 kit par équipe)
                        equipment[item] += data.required;
                    });
                }
            });

            return equipment;
        }

        // Alias pour compatibilité descendante
        static _calculateEquipment(requiredTeams, project) {
            return this._calculateEquipmentDetailed(requiredTeams, project);
        }

        static _calculateFuel(vehicleRequirements, project) {
            const duration = Number(project.duration) || 180;
            const logistics = project.logistics || { vehicles: {}, fuelPrice: 700 };
            const fuelPrice = Number(logistics.fuelPrice) || 700;

            const totalFuelCost = Object.entries(vehicleRequirements || {}).reduce((sum, [type, data]) => {
                const vehicles = logistics.vehicles || {};
                const vehicle = vehicles[type] || { fuelConsumption: 10 };
                const dailyDistance = (type === 'motorcycle') ? 50 : 100; // km/jour
                const consumptionPerKm = (Number(vehicle.fuelConsumption) || 10) / 100; // L/km

                // On ne calcule le carburant que pour les véhicules nécessaires
                const operationalCount = Number(data.required) || 0;
                const cost = operationalCount * consumptionPerKm * dailyDistance * duration * fuelPrice;
                return sum + (isNaN(cost) ? 0 : cost);
            }, 0);

            return {
                totalCost: totalFuelCost,
                details: Object.fromEntries(
                    Object.entries(vehicleRequirements).map(([type, data]) => {
                        const vehicle = project.logistics.vehicles[type] || { fuelConsumption: 10 };
                        const consumptionPerKm = (vehicle.fuelConsumption || 10) / 100;
                        const dailyDistance = (type === 'motorcycle') ? 50 : 100;
                        const cost = data.required * consumptionPerKm * dailyDistance * duration * fuelPrice;
                        return [type, { cost, liters: cost / fuelPrice }];
                    })
                )
            };
        }

        /**
         * Réalloue les ressources en fonction des besoins calculés.
         */
        static async reallocateResources(requirements, project) {
            const updatedLogistics = JSON.parse(JSON.stringify(project.logistics));
            let hasChanges = false;

            Object.entries(requirements.vehicles).forEach(([type, data]) => {
                if (!updatedLogistics.vehicles[type]) {
                    updatedLogistics.vehicles[type] = { count: 0, capacity: 2, fuelConsumption: 10 };
                }

                if (updatedLogistics.vehicles[type].count !== data.required) {
                    updatedLogistics.vehicles[type].count = data.required;
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                console.log("Reallocation: updating project parameters with new vehicle counts");
                await ProjectRepository.updateProjectParameters({
                    logistics: updatedLogistics,
                    _reallocationTimestamp: new Date().toISOString()
                });
            }

            return hasChanges;
        }

        static getTeamCapacity(teamType) {
            // Tentative de récupération depuis les paramètres globaux si disponibles
            const project = window.currentProject; // Cache du projet si disponible
            if (project && project.teamCapabilities && project.teamCapabilities[teamType.toLowerCase()]) {
                return project.teamCapabilities[teamType.toLowerCase()].daily;
            }

            const capacities = {
                'Maçon': 2,       // 2 murs/jour
                'Réseau': 10,     // 10 branchements/jour
                'Intérieur': 8,   // 8 installations/jour
                'Contrôleur': 15,  // 15 contrôles/jour
                'Préparateur': 50,
                'Livreur': 30
            };
            return capacities[teamType] || 5;
        }

        /**
         * Calcule l'allocation optimale des ressources
         * @param {Project} project - Le projet à optimiser
         * @param {Array} availableTeams - Liste des équipes disponibles (optionnel)
         * @param {Object} constraints - Contraintes (budget, durée, stratégie)
         */
        calculateAllocation(project, availableTeams = [], constraints = {}) {
            if (!project) {
                throw new Error('Project is required');
            }

            // Stratégie par défaut : équilibrée
            const strategy = constraints.strategy || 'balanced';
            const targetDuration = constraints.targetDuration || project.duration || 180;
            const totalHouses = project.totalHouses;

            console.log(`🚀 Optimizing resources for project "${project.name}" (${totalHouses} houses, ${targetDuration} days)`);

            let teams = [];
            let logistics = {};

            // 1. Calcul des équipes techniques (Coeur de métier)
            if (strategy === 'cost') {
                teams = this.optimizeForCost(totalHouses, targetDuration);
            } else if (strategy === 'fast') {
                teams = this.optimizeForSpeed(totalHouses, targetDuration);
            } else {
                teams = this.optimizeBalanced(totalHouses, targetDuration);
            }

            // 2. Calcul du personnel de support (Superviseurs, Chauffeurs, etc.)
            const supportTeams = this.calculateSupportStaff(teams);
            teams.push(...supportTeams);

            // 3. Calcul de la logistique (Véhicules, Kits, Équipements)
            logistics = this.calculateLogistics(teams, targetDuration);

            // 4. Estimation des coûts
            const estimatedCost = this.calculateEstimatedCost(teams, logistics, targetDuration);

            return {
                strategy,
                teams,
                logistics,
                estimatedDuration: targetDuration,
                estimatedCost,
                optimizationDate: new Date().toISOString()
            };
        }

        /**
         * Optimisation équilibrée (Standard)
         */
        optimizeBalanced(totalHouses, duration) {
            const teams = [];
            const productivity = this.Enums.DEFAULT_PRODUCTIVITY;

            // Calcul basé sur la productivité quotidienne moyenne
            // Formule : (Total Ménages / Durée) / Productivité journalière = Nb Équipes

            const requiredDailyOutput = totalHouses / duration;

            for (const [type, rate] of Object.entries(productivity)) {
                // Determine team ID from type (handle mapped types if needed)
                const count = Math.ceil(requiredDailyOutput / rate);
                teams.push({
                    id: type,
                    type: type,
                    count: Math.max(1, count), // Always at least 1 team
                    productivity: rate
                });
            }

            return teams;
        }

        /**
         * Optimisation pour le coût (Minimum d'équipes, durée max tolérée)
         */
        optimizeForCost(totalHouses, duration) {
            // On étire la durée au maximum acceptable ou on réduit les équipes au min
            // Ici on utilise la même logique mais avec une marge de sécurité plus faible
            return this.optimizeBalanced(totalHouses, duration * 1.2);
        }

        /**
         * Optimisation pour la vitesse (Maximum d'équipes)
         */
        optimizeForSpeed(totalHouses, duration) {
            // On vise une durée plus courte
            return this.optimizeBalanced(totalHouses, duration * 0.8);
        }

        /**
         * Calcule le personnel de support nécessaire
         */
        calculateSupportStaff(technicalTeams) {
            const support = [];

            // Total des équipes techniques
            const totalTechnicalTeams = technicalTeams.reduce((sum, t) => sum + t.count, 0);

            // 1. Superviseurs (Ratio: 1 pour N équipes)
            const supervisorRatio = this.Enums.CALCULATION_RATIOS.SUPERVISOR_PER_TEAMS || 10;
            const supervisorCount = Math.ceil(totalTechnicalTeams / supervisorRatio);
            support.push({
                id: 'superviseur',
                type: 'superviseur',
                count: Math.max(1, supervisorCount)
            });

            // 2. Agents de livraison (Ratio: 1 pour N ménages)
            // Note: C'est une approximation, dépendant de la taille du projet
            // On peut aussi le baser sur le nombre d'équipes de livraison
            const deliveryTeams = technicalTeams.find(t => t.type === 'livraison');
            if (deliveryTeams) {
                support.push({
                    id: 'agent_livraison',
                    type: 'agent_livraison',
                    count: deliveryTeams.count // 1 agent par équipe de livraison
                });
            }

            // 3. Chef de projet
            support.push({
                id: 'chef_projet',
                type: 'chef_projet',
                count: 1
            });

            // 4. Chauffeurs (Calculé dans la logistique normalement, mais ajouté ici comme staff)
            // Sera ajusté selon le nombre de véhicules lourds

            return support;
        }

        /**
         * Calcule les besoins logistiques
         */
        calculateLogistics(teams, duration) {
            const vehicles = {
                lightVehicles: 0,
                trucks: 0,
                motos: 0
            };

            const kits = {
                controllerKits: 0,
                networkKits: 0,
                interiorKits: 0,
                masonKits: 0,
                prepKits: 0,
                deliveryKits: 0
            };

            const equipment = {
                computers: 0,
                phones: 0,
                tablets: 0,
                printers: 0
            };

            // Règles d'attribution
            teams.forEach(team => {
                switch (team.type) {
                    case 'preparateurs':
                        kits.prepKits += team.count;
                        vehicles.motos += team.count; // 1 moto par équipe prépa
                        break;
                    case 'livraison':
                        kits.deliveryKits += team.count;
                        vehicles.trucks += team.count; // 1 camion par équipe
                        break;
                    case 'macons':
                        kits.masonKits += team.count;
                        break; // Généralement transportés ou locaux
                    case 'reseau':
                        kits.networkKits += team.count;
                        vehicles.trucks += Math.ceil(team.count / 2); // 1 camion pour 2 équipes
                        break;
                    case 'interieur_type1':
                    case 'interieur_type2':
                        kits.interiorKits += team.count;
                        break;
                    case 'controle':
                        kits.controllerKits += team.count;
                        vehicles.motos += team.count;
                        equipment.tablets += team.count;
                        break;
                    case 'superviseur':
                        vehicles.lightVehicles += team.count;
                        equipment.computers += team.count;
                        equipment.phones += team.count;
                        break;
                    case 'chef_projet':
                        vehicles.lightVehicles += 1;
                        equipment.computers += 1;
                        break;
                }
            });

            // Ajout des chauffeurs basés sur les camions
            if (vehicles.trucks > 0) {
                teams.push({
                    id: 'chauffeur',
                    type: 'chauffeur',
                    count: vehicles.trucks
                });
            }

            return { vehicles, kits, equipment };
        }

        /**
         * Estime les coûts globaux
         */
        calculateEstimatedCost(teams, logistics, duration) {
            let total = 0;
            const costs = this.Enums.DEFAULT_COSTS;

            // 1. Coûts Salariaux (Journaliers x Durée x Nombre)
            teams.forEach(team => {
                // Mapping sommaire des types d'équipe vers les clés de coûts
                // Note: Idéalement, les clés devraient correspondre exactement
                let costKey = team.type;
                if (team.type === 'macons') costKey = 'macon';
                if (team.type === 'preparateurs') costKey = 'preparateur';

                const dailyRate = costs.DAILY_RATES[costKey] || 5000; // Fallback
                total += dailyRate * team.count * duration;
            });

            // 2. Coûts Logistiques (Acquisition ou Location)
            // Simplification: On suppose l'acquisition pour ce calcul, ou un mix
            if (logistics.vehicles) {
                total += (logistics.vehicles.lightVehicles || 0) * (costs.VEHICLES.pm_purchase / 10); // Amortissement 10%
                total += (logistics.vehicles.trucks || 0) * (costs.VEHICLES.delivery_purchase / 10);
                total += (logistics.vehicles.motos || 0) * (costs.VEHICLES.controller_purchase / 10); // Using controller value usually logic check
            }

            // 3. Coûts Kits 
            // ... (Ajouter selon les coûts unitaires des kits)

            return total;
        }
    }


    /**
     * Stratégie d'allocation équilibrée (Placeholder pattern Stratégie)
     */
    class BalancedAllocationStrategy {
        constructor() { }
        optimize(project, constraints) {
            console.log('Using BalancedAllocationStrategy');
            return []; // Placeholder implementation
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.ResourceAllocationService = ResourceAllocationService;
        window.BalancedAllocationStrategy = BalancedAllocationStrategy;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ResourceAllocationService, BalancedAllocationStrategy };
    }

    // Export ES6 pour les tests
    if (typeof globalThis !== 'undefined') {
        globalThis.ResourceAllocationService = ResourceAllocationService;
        globalThis.BalancedAllocationStrategy = BalancedAllocationStrategy;
    }

    // Export ES6
    // Note: removed top-level ES export to avoid SyntaxError when this file
    // is loaded in-browser via a plain <script> tag. The module already
    // exposes globals (`window.*`) and `module.exports` for Node environments.

})();
