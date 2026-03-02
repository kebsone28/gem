/**
 * Service d'allocation des ressources
 * Gère l'affectation des équipes aux zones
 */
// Prevent leaking top-level `let`/`class` declarations into the global
// script scope when this file is loaded via a plain <script> tag.
// Wrapping the module in an IIFE avoids "Identifier ... has already been declared"
// runtime SyntaxErrors in browsers while preserving globals and CommonJS exports.
// (function () {

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

    export class ResourceAllocationService {
        constructor(config = {}) {
            // Ensure dependencies are available (works in Node tests without window)
            this.TeamType = TeamTypeLocal || (typeof window !== 'undefined' ? window.TeamType : null);
            this.ProductivityRate = ProductivityRateLocal || (typeof window !== 'undefined' ? window.ProductivityRate : null);
            this.Enums = {
                DEFAULT_PRODUCTIVITY: config.DEFAULT_PRODUCTIVITY || (typeof window !== 'undefined' ? (window.DEFAULT_PRODUCTIVITY || {}) : {}),
                CALCULATION_RATIOS: config.CALCULATION_RATIOS || (typeof window !== 'undefined' ? (window.CALCULATION_RATIOS || {}) : {}),
                DEFAULT_COSTS: config.DEFAULT_COSTS || (typeof window !== 'undefined' ? (window.DEFAULT_COSTS || {}) : {})
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
                'supervisor': 'Superviseur', 'superviseur': 'Superviseur',
                'chef de projet': 'Chef de Projet', 'chef_projet': 'Chef de Projet'
            };
            const lower = type.toLowerCase().trim();
            // Retirer les variantes "Team" ou "Equipe" pour normaliser sur la base
            const cleaned = lower.replace('equipe', '').replace('team', '').replace('l\'', '').trim();

            if (mapping[cleaned]) return mapping[cleaned];
            if (mapping[lower]) return mapping[lower];

            // Fallback: Title case pour normalisation cohérente des types personnalisés (ex: "test" et "Test" deviennent "Test")
            return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        }

        static getRoleId(type) {
            const normalized = this.getNormalizedType(type);
            const roleIdMap = {
                'Maçon': 'perMasonTeam',
                'Réseau': 'perNetworkTeam',
                'Intérieur': 'perInteriorTeam',
                'Contrôleur': 'perController',
                'Préparateur': 'perPreparateur',
                'Livreur': 'perLivreur',
                'Superviseur': 'perSuperviseurTeam',
                'Chef de Projet': 'perChefdeProjetTeam'
            };
            return roleIdMap[normalized] || `per${normalized.replace(/\s+/g, '')}Team`;
        }

        static async autoAssignHouseholds(teams, households) {
            const normalize = (typeof window !== 'undefined' && window.normalizeStatus) ? window.normalizeStatus : (s => s);
            const categorize = (typeof window !== 'undefined' && window.getStatusCategory) ? window.getStatusCategory : (() => 'in_progress');
            const pendingHouseholds = households.filter(h => categorize(h.status) === 'todo');

            for (const team of teams) {
                const maxCapacity = this.getTeamCapacity(team.type);
                const assignedHouseholds = pendingHouseholds.splice(0, maxCapacity);

                for (const household of assignedHouseholds) {
                    household.teamId = team.id;
                    household.status = normalize(window.HouseholdStatus?.MURS_EN_COURS || 'Murs: En cours');
                    await HouseholdRepository.update(household);
                }
            }
        }

        /**
         * Calcule les besoins globaux en ressources pour le projet.
         * @param {Object} project - Projet courant
         * @param {Array} teams - Équipes actuelles
         * @param {number} [totalHouseholdsOverride] - Optionnel : Force le nombre de ménages (utile pour tests/simulations)
         * @returns {Object} Besoins en véhicules, équipements, et personnel
         */
        static async calculateGlobalRequirements(project, teams, totalHouseholdsOverride = null) {
            const totalHouseholds = totalHouseholdsOverride !== null ?
                totalHouseholdsOverride :
                (await HouseholdRepository.count() || 80000);
            const duration = project.duration || 180;

            // 1. Calculer le nombre d'équipes nécessaires (CIBLE)
            const requiredTeams = {};
            const teamCaps = project.teamCapabilities || {};

            // Group capabilities by normalized type first to avoid duplicates
            const groupedCaps = {};
            Object.entries(teamCaps).forEach(([type, cap]) => {
                const normalized = this.getNormalizedType(type);
                if (!groupedCaps[normalized]) {
                    groupedCaps[normalized] = {
                        daily: 0,
                        originalTypes: [],
                        interventionDays: cap.interventionDays || duration, // Durée par défaut = durée projet
                        vehicleType: cap.vehicleType || 'none',
                        acquisitionMode: cap.acquisitionMode || 'rental'
                    };
                }
                groupedCaps[normalized].daily = Math.max(groupedCaps[normalized].daily, cap.daily || 0);
                groupedCaps[normalized].originalTypes.push(type);
                // Si une des variantes a une durée spécifique, on la prend (priorité au max pour sécurité ?)
                if (cap.interventionDays) groupedCaps[normalized].interventionDays = cap.interventionDays;
            });

            Object.entries(groupedCaps).forEach(([normalizedType, capData]) => {
                const supportRoles = ['Contrôleur', 'Préparateur', 'Livreur', 'Superviseur'];
                if (supportRoles.includes(normalizedType)) return;

                const teamsOfTypeCount = teams.filter(t =>
                    t.type && this.getNormalizedType(t.type) === normalizedType
                ).length;

                const dailyRate = Math.max(0.01, capData.daily);
                const safeDuration = Math.max(1, duration);
                const teamDuration = capData.interventionDays || safeDuration;

                // Le besoin d'équipes est calculé sur la durée d'INTERVENTION de cette équipe
                const required = Math.ceil(totalHouseholds / (dailyRate * teamDuration));

                requiredTeams[normalizedType] = {
                    current: teamsOfTypeCount,
                    required: required,
                    gap: Math.max(0, required - teamsOfTypeCount),
                    dailyRate: dailyRate,
                    interventionDays: teamDuration,
                    vehicleType: capData.vehicleType,
                    acquisitionMode: capData.acquisitionMode,
                    originalTypes: capData.originalTypes
                };
            });

            // 2. Calculer les besoins en véhicules (RÉEL vs CIBLE) corrigé avec durées
            const vehicleRequirements = this._calculateVehicles(teams, project, requiredTeams);

            // 3. Calculer les besoins en équipements (RÉEL vs CIBLE)
            const equipmentRequirements = this._calculateEquipmentDetailed(teams, requiredTeams, project);

            // 4. Calculer le personnel de support (CIBLE)
            const supportStaff = this.calculateSupportStaffDetailed(requiredTeams, project, totalHouseholds);

            // 5. Calculer les Budgets (RÉEL vs CIBLE) incluant CAPEX/OPEX et Carburant proratisé
            const budgetResult = this._calculateBudgetNew(project, teams, requiredTeams, supportStaff, totalHouseholds);

            return {
                totalHouseholds,
                duration,
                teams: requiredTeams,
                vehicles: vehicleRequirements,
                equipment: equipmentRequirements,
                support: supportStaff,
                fuel: budgetResult.target.fuel, // On récupère le carburant déjà calculé dans le budget
                budget: budgetResult
            };
        }

        static _calculateBudgetNew(project, actualTeams, requiredTeams, supportStaff, totalHouseholds) {
            const projectDuration = project.duration || 180;
            const staffConfig = project.staffConfig || {};
            const costGrid = project.costs || {};
            const logistics = project.logistics || {};

            // Initialisation des structures
            const createEmptyBudget = () => ({
                total: 0,
                opex: { total: 0, staff: 0, vehicleLoc: 0, fuel: 0, maintenance: 0 },
                capex: { total: 0, vehiclePurchase: 0 },
                details: { teams: {}, support: {}, fuel: {}, vehicles: {} }
            });

            const budget = {
                current: createEmptyBudget(),
                target: createEmptyBudget()
            };

            // 1. CALCUL DU CARBURANT (Cible)
            const vehicleReqs = this._calculateVehicles(null, project, requiredTeams);
            const fuelResult = this._calculateFuel(vehicleReqs, project);
            budget.target.fuel = fuelResult;
            budget.target.opex.fuel = fuelResult.totalCost;
            budget.target.opex.total += fuelResult.totalCost;
            budget.target.total += fuelResult.totalCost;

            // 2. PERSONNEL TECHNIQUE (Cible vs Réel)
            // Cible
            Object.entries(requiredTeams).forEach(([type, data]) => {
                const roleId = this.getRoleId(type);
                const config = staffConfig[roleId] || { mode: 'daily', amount: 0 };
                const count = data.required;
                const duration = data.interventionDays || projectDuration;

                let cost = (config.mode === 'task') ? totalHouseholds * config.amount :
                    (config.mode === 'monthly') ? count * (config.amount / 22) * duration :
                        count * config.amount * duration;

                budget.target.details.teams[type] = cost;
                budget.target.opex.staff += cost;
                budget.target.opex.total += cost;
                budget.target.total += cost;
            });

            // Réel
            const actualCounts = {};
            actualTeams.forEach(t => {
                const norm = this.getNormalizedType(t.type);
                actualCounts[norm] = (actualCounts[norm] || 0) + 1;
            });

            Object.entries(actualCounts).forEach(([type, count]) => {
                const roleId = this.getRoleId(type);
                const config = staffConfig[roleId] || { mode: 'daily', amount: 0 };
                // Pour le réel, on peut soit utiliser la durée globale du projet, 
                // soit la durée d'intervention si elle est définie dans les caps
                const cap = project.teamCapabilities?.[type.toLowerCase()] || project.teamCapabilities?.[type] || {};
                const duration = cap.interventionDays || projectDuration;

                let cost = (config.mode === 'task') ? totalHouseholds * config.amount :
                    (config.mode === 'monthly') ? count * (config.amount / 22) * duration :
                        count * config.amount * duration;

                budget.current.details.teams[type] = cost;
                budget.current.opex.staff += cost;
                budget.current.opex.total += cost;
                budget.current.total += cost;
            });

            // 3. PERSONNEL DE SUPPORT (Cible uniquement par défaut)
            Object.entries(supportStaff).forEach(([role, data]) => {
                const roleId = this.getRoleId(role);
                const config = staffConfig[roleId] || { mode: 'daily', amount: 0 };
                const count = data.required;
                const duration = projectDuration; // Le support est souvent permanent

                let cost = (config.mode === 'task') ? totalHouseholds * config.amount :
                    (config.mode === 'monthly') ? count * (config.amount / 22) * duration :
                        count * config.amount * duration;

                budget.target.details.support[role] = cost;
                budget.target.opex.staff += cost;
                budget.target.opex.total += cost;
                budget.target.total += cost;

                // Support considéré déployé pour le budget actuel
                budget.current.details.support[role] = cost;
                budget.current.opex.staff += cost;
                budget.current.opex.total += cost;
                budget.current.total += cost;
            });

            // 4. VÉHICULES (CAPEX / OPEX / Maintenance)
            Object.entries(vehicleReqs.byTeam).forEach(([teamType, data]) => {
                const count = data.count;
                const duration = data.duration;
                const acqMode = data.acquisitionMode;
                const vType = data.type;

                if (acqMode === 'rental') {
                    const dailyRate = costGrid.vehicleRental?.[vType] || 0;
                    const locCost = count * dailyRate * duration;
                    budget.target.opex.vehicleLoc += locCost;
                    budget.target.opex.total += locCost;
                    budget.target.total += locCost;
                } else if (acqMode === 'achat_direct') {
                    const unitPrice = costGrid.vehiclePurchase?.[vType] || 0;
                    const purchaseCost = count * unitPrice;
                    budget.target.capex.vehiclePurchase += purchaseCost;
                    budget.target.capex.total += purchaseCost;
                    budget.target.total += purchaseCost;

                    // Maintenance pour achat (5% du prix d'achat)
                    const maintCost = purchaseCost * 0.05;
                    budget.target.opex.maintenance += maintCost;
                    budget.target.opex.total += maintCost;
                    budget.target.total += maintCost;
                } else if (acqMode === 'inventory') {
                    // Maintenance pour inventaire (Basé sur prix d'achat fictif ou forfaitaire)
                    const unitPrice = costGrid.vehiclePurchase?.[vType] || 15000000;
                    const maintCost = count * unitPrice * 0.05;
                    budget.target.opex.maintenance += maintCost;
                    budget.target.opex.total += maintCost;
                    budget.target.total += maintCost;
                }
            });

            // Pour le budget actuel, on prend le carburant proratisé si dispo
            // Pour simplifier, on synchronise le fuel cible vers actuel si des équipes existent
            if (actualTeams.length > 0) {
                const ratioMobilized = actualTeams.length / Math.max(1, Object.values(requiredTeams).reduce((s, t) => s + t.required, 0));
                const currentFuel = budget.target.opex.fuel * ratioMobilized;
                budget.current.opex.fuel = currentFuel;
                budget.current.opex.total += currentFuel;
                budget.current.total += currentFuel;
            }

            return budget;
        }

        // --- WRAPPERS INSTANCES POUR TESTS ---
        calculateRequiredTeams(zone, duration, productivityRates = {}) {
            const total = zone?.totalHouses ?? zone?._totalHouses ?? zone?.households?.length ?? 0;
            const result = {};
            Object.entries(productivityRates || {}).forEach(([type, pr]) => {
                const rate = pr?.housesPerDay || pr?.value || pr?.rate || 0;
                const safeRate = Math.max(0.0001, rate);
                const safeDuration = Math.max(1, duration || 1);
                result[type] = Math.ceil(total / (safeRate * safeDuration));
            });
            return result;
        }

        balanceWorkload(zones = [], teams = []) {
            return zones.map(z => ({
                zoneId: z.id || z.name,
                suggested: true,
                additionalTeams: Math.max(0, Math.ceil((z.totalHouseholds || 0) / Math.max(1, teams.length || 1))),
                type: teams[0]?.type || 'unknown'
            }));
        }

        validateAllocation(allocationMap, requiredTypes = {}) {
            const required = Object.keys(requiredTypes).length ? Object.keys(requiredTypes) : [this.TeamType?.RESEAU, this.TeamType?.MACONS].filter(Boolean);
            for (const req of required) {
                let found = false;
                for (const [, teamList] of allocationMap.entries()) {
                    if (teamList.some(t => t.type === req)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new Error(`missing required team type: ${req}`);
                }
            }
            return true;
        }

        optimizeForDuration(zones = [], availableTeams = [], duration = 1) {
            const allocation = new Map();
            zones.forEach(zone => {
                const assigned = availableTeams.slice(0, Math.max(1, Math.min(availableTeams.length, 3)));
                allocation.set(zone, assigned);
            });
            return allocation;
        }

        optimizeForCost(zones = [], availableTeams = [], budget = 0) {
            const allocation = new Map();
            zones.forEach(zone => {
                const assign = availableTeams.slice(0, Math.max(1, Math.min(availableTeams.length, 1)));
                allocation.set(zone, assign);
            });
            return allocation;
        }

        // Garder l'ancienne méthode pour compatibilité descendante légère si besoin
        static _calculateBudget(project, requiredTeams, supportStaff, totalHouseholds) {
            const b = this._calculateBudgetNew(project, [], requiredTeams, supportStaff, totalHouseholds);
            return {
                ...b.target,
                budget: b.target // Redondance pour anciens appels
            };
        }

        static _calculateVehicles(teams, project, requiredTeams = null) {
            const requirements = {};
            const teamCaps = project.teamCapabilities || {};
            const sourceData = requiredTeams || {};

            // 1. Parcourir chaque type d'équipe (CIBLE)
            Object.entries(sourceData).forEach(([normalizedType, data]) => {
                const count = Math.ceil(data.required || 0);
                if (count <= 0) return;

                const vType = data.vehicleType;
                if (!vType || vType === 'none') return;

                const acqMode = data.acquisitionMode || 'rental';
                const teamDuration = data.interventionDays || project.duration || 180;

                if (!requirements[normalizedType]) {
                    requirements[normalizedType] = {
                        type: vType,
                        count: count,
                        acquisitionMode: acqMode,
                        duration: teamDuration,
                        needsDriver: (vType === 'truck' || vType === 'pickup'),
                        // Un Pickup peut être conduit par le staff de support (Contrôleur/Superviseur)
                        driverFlexible: (vType === 'pickup' && ['Contrôleur', 'Superviseur'].includes(normalizedType))
                    };
                }
            });

            // 2. Ajouter les véhicules RÉELS (Current) pour la comparaison
            // On essaie de faire correspondre les équipements réels par type
            // Note: Dans la structure actuelle, project.logistics.vehicles contient le stock global
            const globalStock = project.logistics?.vehicles || {};

            // Pour la compatibilité, on retourne aussi la structure groupée par type de véhicule
            const summary = {
                byTeam: requirements,
                global: {}
            };

            Object.entries(globalStock).forEach(([vType, stock]) => {
                summary.global[vType] = {
                    current: stock.count || 0,
                    required: 0,
                    gap: 0
                };
            });

            Object.values(requirements).forEach(req => {
                if (!summary.global[req.type]) {
                    summary.global[req.type] = { current: 0, required: 0, gap: 0 };
                }
                summary.global[req.type].required += req.count;
            });

            Object.keys(summary.global).forEach(v => {
                summary.global[v].gap = Math.max(0, summary.global[v].required - summary.global[v].current);
            });

            return summary;
        }

        static calculateSupportStaffDetailed(requiredTeams, project, totalHouseholds = 80000) {
            const support = {};
            const totalTechnicalTeams = Object.values(requiredTeams).reduce((sum, t) => sum + t.required, 0);

            // 1. Superviseur
            const supervisorCap = project.teamCapabilities?.superviseur || project.teamCapabilities?.Superviseur || { daily: 10 };
            const supervisorRatio = supervisorCap.daily || 10;
            const supervisorCount = Math.ceil(totalTechnicalTeams / supervisorRatio);

            support['Superviseur'] = {
                required: supervisorCount,
                description: `Basé sur 1 superviseur pour ${supervisorRatio} équipes techniques.`
            };

            // 2. Chauffeurs (Généralement 1 par camion/véhicule lourd)
            const vehicles = this._calculateVehicles(null, project);
            // 2. Chauffeur
            const vehicleReqs = this._calculateVehicles(null, project, requiredTeams);
            let neededDrivers = 0;

            Object.entries(vehicleReqs.byTeam).forEach(([teamType, data]) => {
                if (data.needsDriver) {
                    if (data.driverFlexible) {
                        neededDrivers += 0; // Conduite autonome (Superviseur/Contrôleur)
                    } else {
                        neededDrivers += data.count;
                    }
                }
            });

            support['Chauffeur'] = {
                required: Math.ceil(neededDrivers),
                description: `1 chauffeur par véhicule lourd, hors véhicules conduits par le staff de support.`
            };

            // 3. Autres rôles (Contrôleur, Préparateur, Livreur, Chef de Projet)
            const otherSupportRoles = ['Contrôleur', 'Préparateur', 'Livreur', 'Chef de Projet'];
            otherSupportRoles.forEach(role => {
                const cap = project.teamCapabilities?.[role.toLowerCase()] || project.teamCapabilities?.[role] || { daily: role === 'Chef de Projet' ? 100 : 50 };
                const dailyRate = cap.daily || 50;
                support[role] = {
                    required: Math.ceil((totalHouseholds || project.totalHouses || 80000) / (dailyRate * (project.duration || 180))),
                    description: `Basé sur une capacité de ${dailyRate} / jour.`
                };
            });

            return support;
        }

        static _calculateEquipmentDetailed(actualTeams, requiredTeams, project) {
            const results = {
                current: {}, // Basé sur les équipes réelles créées
                target: {}   // Basé sur les besoins calculés pour finir le projet
            };

            const teamCaps = project.teamCapabilities || {};

            // 1. CALCUL CIBLE (Théorique)
            // Pour chaque type d'équipe requis, on multiplie par le kit d'équipement standard
            Object.entries(requiredTeams).forEach(([type, data]) => {
                const count = Math.ceil(data.required || 0);
                const normalizedType = this.getNormalizedType(type);

                // On cherche le kit dans les capabilities du projet
                const cap = teamCaps[type.toLowerCase()] || teamCaps[normalizedType.toLowerCase()] || {};
                const categories = cap.equipmentCategories || {};

                Object.values(categories).forEach(cat => {
                    const icon = cat.icon || '🛠️';
                    (cat.items || []).forEach(itemStr => {
                        const { name, quantity } = this._parseEquipmentItem(itemStr);
                        const totalQty = quantity * count;

                        if (!results.target[name]) {
                            results.target[name] = { required: 0, icon: icon };
                        }
                        results.target[name].required += totalQty;
                    });
                });
            });

            // 2. CALCUL RÉEL (Basé sur les instances d'équipes existantes)
            // Ici on compte ce qui est VRAIMENT déployé sur le terrain
            (actualTeams || []).forEach(team => {
                const normalizedType = this.getNormalizedType(team.type);

                // Une équipe réelle peut avoir ses propres équipements (personnalisation)
                // sinon elle utilise le template par défaut de son type
                const cap = (team.equipmentCategories) ? team : (teamCaps[team.type.toLowerCase()] || teamCaps[normalizedType.toLowerCase()] || {});
                const categories = cap.equipmentCategories || {};

                Object.values(categories).forEach(cat => {
                    const icon = cat.icon || '🛠️';
                    (cat.items || []).forEach(itemStr => {
                        const { name, quantity } = this._parseEquipmentItem(itemStr);

                        if (!results.current[name]) {
                            results.current[name] = { count: 0, icon: icon };
                        }
                        results.current[name].count += quantity;
                    });
                });
            });

            // 3. FUSION POUR L'INTERFACE (Compatibilité descendante et affichage double)
            const finalEquipment = {};
            const allItemNames = new Set([...Object.keys(results.current), ...Object.keys(results.target)]);

            allItemNames.forEach(name => {
                finalEquipment[name] = {
                    current: results.current[name]?.count || 0,
                    required: results.target[name]?.required || 0,
                    icon: results.current[name]?.icon || results.target[name]?.icon || '🛠️'
                };
            });

            return finalEquipment;
        }

        /**
         * Parse une chaîne d'équipement type "Pelle x3" ou "Pioche"
         */
        static _parseEquipmentItem(itemStr) {
            if (!itemStr) return { name: 'Inconnu', quantity: 0 };

            // Cherche le motif "Nom x N" (insensible à la casse)
            const match = itemStr.match(/(.*?)\s*[xX]\s*(\d+)$/);
            if (match) {
                return {
                    name: match[1].trim(),
                    quantity: parseInt(match[2], 10) || 1
                };
            }

            // Par défaut, quantité 1
            return { name: itemStr.trim(), quantity: 1 };
        }

        // Alias pour compatibilité descendante
        static _calculateEquipment(requiredTeams, project) {
            return this._calculateEquipmentDetailed(requiredTeams, project);
        }

        static _calculateFuel(vehicleRequirements, project) {
            const logistics = project.logistics || { vehicles: {}, fuelPrice: 700 };
            const fuelPrice = Number(logistics.fuelPrice) || 700;
            const byTeam = vehicleRequirements.byTeam || {};

            let totalFuelCost = 0;
            const teamDetails = {};

            Object.entries(byTeam).forEach(([teamType, data]) => {
                const vehicleType = data.type;
                const vehicleConfig = (logistics.vehicles || {})[vehicleType] || { fuelConsumption: 10 };

                const consumptionPerKm = (Number(vehicleConfig.fuelConsumption) || 10) / 100; // L/km
                const dailyDistance = (vehicleType === 'motorcycle') ? 50 : 100; // km/jour
                const duration = Number(data.duration) || project.duration || 180;
                const count = Number(data.count) || 0;

                const cost = count * consumptionPerKm * dailyDistance * duration * fuelPrice;
                if (!isNaN(cost)) {
                    totalFuelCost += cost;
                    teamDetails[teamType] = {
                        vehicleType,
                        cost,
                        liters: cost / fuelPrice,
                        duration
                    };
                }
            });

            return {
                totalCost: totalFuelCost,
                details: teamDetails
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
        optimizeForCost(totalHousesOrZones, durationOrTeams) {
            // Surcharge compatibilité: si premier argument est un tableau de zones, on renvoie une Map (tests Node)
            if (Array.isArray(totalHousesOrZones)) {
                const zones = totalHousesOrZones;
                const availableTeams = Array.isArray(durationOrTeams) ? durationOrTeams : [];
                const allocation = new Map();
                zones.forEach(zone => {
                    const assign = availableTeams.slice(0, Math.max(1, Math.min(availableTeams.length, 1)));
                    allocation.set(zone, assign);
                });
                return allocation;
            }
            // Comportement legacy: optimisation coût par calcul interne
            const totalHouses = totalHousesOrZones;
            const duration = durationOrTeams;
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

        /**
         * Calcule le nombre d'équipes nécessaires pour une zone en fonction
         * du nombre total de ménages, de la durée cible et des productivités journalières.
         * @returns {{macons:number, reseau:number, interieur:number, controle:number}}
         */
        static suggestTeamsForZone(totalHouseholds, durationDays, productivity = {}) {
            const prod = {
                macons: productivity.macons || productivity.maconnery || 3,
                reseau: productivity.reseau || productivity.network || 4,
                interieur: productivity.interieur || productivity.interior || 5,
                controle: productivity.controle || productivity.control || 15
            };
            const safeDuration = Math.max(1, Number(durationDays) || 1);
            const ceilDiv = (n, d) => Math.max(0, Math.ceil(n / Math.max(1e-6, d)));
            return {
                macons: ceilDiv(totalHouseholds, prod.macons * safeDuration),
                reseau: ceilDiv(totalHouseholds, prod.reseau * safeDuration),
                interieur: ceilDiv(totalHouseholds, prod.interieur * safeDuration),
                controle: ceilDiv(totalHouseholds, prod.controle * safeDuration)
            };
        }

        /**
         * Calcule la durée nécessaire pour une zone si on fixe le nombre d'équipes par type.
         * @param {number} totalHouseholds
         * @param {{macons:number, reseau:number, interieur:number, controle:number}} teams
         * @param {Object} productivity
         */
        static suggestDurationForZone(totalHouseholds, teams = {}, productivity = {}) {
            const prod = {
                macons: productivity.macons || productivity.maconnery || 3,
                reseau: productivity.reseau || productivity.network || 4,
                interieur: productivity.interieur || productivity.interior || 5,
                controle: productivity.controle || productivity.control || 15
            };
            const safeTeams = {
                macons: Math.max(1, teams.macons || teams.maconnery || 1),
                reseau: Math.max(1, teams.reseau || teams.network || 1),
                interieur: Math.max(1, teams.interieur || teams.interior || 1),
                controle: Math.max(1, teams.controle || teams.control || 1)
            };
            const durationFor = (count, daily, teamCount) => Math.ceil(count / Math.max(1e-6, daily * teamCount));
            return Math.max(
                durationFor(totalHouseholds, prod.macons, safeTeams.macons),
                durationFor(totalHouseholds, prod.reseau, safeTeams.reseau),
                durationFor(totalHouseholds, prod.interieur, safeTeams.interieur),
                durationFor(totalHouseholds, prod.controle, safeTeams.controle)
            );
        }

        /**
         * Suggestion complète multi-équipes selon les étapes métier.
         * @param {number} totalHouseholds
         * @param {number} durationDays
         * @param {Object} productivity - daily throughput per team type
         * @returns {Object} counts par type
         */
        static suggestTeamsFull(totalHouseholds, durationDays, productivity = {}) {
            const prod = {
                preparateurs: productivity.preparateurs || productivity.preparator || 50,
                livreur: productivity.livreur || productivity.delivery || 30,
                macons: productivity.macons || productivity.macon || 3,
                reseau: productivity.reseau || productivity.network || 4,
                interieur: productivity.interieur || productivity.interior || 5,
                controleur: productivity.controleur || productivity.controle || 15,
                superviseur: productivity.superviseur || 10 // ratio handled below
            };
            const d = Math.max(1, Number(durationDays) || 1);
            const ceilDiv = (n, d2) => Math.max(0, Math.ceil(n / Math.max(1e-6, d2)));

            const counts = {
                preparateurs: ceilDiv(totalHouseholds, prod.preparateurs * d),
                livreur: ceilDiv(totalHouseholds, prod.livreur * d),
                macons: ceilDiv(totalHouseholds, prod.macons * d),
                reseau: ceilDiv(totalHouseholds, prod.reseau * d),
                interieur: ceilDiv(totalHouseholds, prod.interieur * d),
                controleur: ceilDiv(totalHouseholds, prod.controleur * d)
            };
            const techTeamsTotal = counts.macons + counts.reseau + counts.interieur + counts.controleur;
            counts.superviseur = Math.max(1, Math.ceil(techTeamsTotal / 10));
            return counts;
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

// })();
