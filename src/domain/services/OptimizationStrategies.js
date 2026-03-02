/**
 * Stratégies d'optimisation pour l'allocation de ressources
 */

// Wrap in IIFE to avoid leaking top-level declarations when loaded as <script>
// (function () {

// Module-level TeamType resolution to support node tests without window globals
let _TeamType;
try {
    if (false && typeof module !== 'undefined' && module.exports) {
        _TeamType = require('../../shared/constants/enums').TeamType;
    }
} catch (e) { }

const TeamTypeLocal = _TeamType;

/**
 * Interface de base pour les stratégies d'optimisation
 */
export class OptimizationStrategy {
    optimize(zones, teams, constraints) {
        throw new Error('optimize() must be implemented by subclass');
    }

    getName() {
        return this.constructor.name;
    }
}

/**
 * Stratégie Greedy (gloutonne)
 * Alloue les équipes en priorisant les zones avec le plus de ménages
 */
export class GreedyOptimizationStrategy extends OptimizationStrategy {
    optimize(zones, teams, constraints = {}) {
        const allocation = new Map();

        // Trier les zones par nombre de ménages (décroissant)
        const sortedZones = [...zones].sort((a, b) => b.totalHouses - a.totalHouses);

        // Grouper les équipes par type
        const teamsByType = new Map();
        for (const team of teams) {
            if (!teamsByType.has(team.type)) {
                teamsByType.set(team.type, []);
            }
            teamsByType.get(team.type).push(team);
        }

        // Allouer les équipes
        for (const zone of sortedZones) {
            const zoneTeams = [];

            // Pour chaque type d'équipe
            for (const [teamType, availableTeams] of teamsByType.entries()) {
                if (availableTeams.length > 0) {
                    // Prendre la première équipe disponible
                    const team = availableTeams.shift();
                    zoneTeams.push(team);
                }
            }

            allocation.set(zone, zoneTeams);
        }

        return allocation;
    }
}

/**
 * Stratégie d'algorithme génétique
 * Utilise l'évolution pour trouver une allocation optimale
 */
export class GeneticAlgorithmStrategy extends OptimizationStrategy {
    constructor(options = {}) {
        super();
        this.populationSize = options.populationSize || 50;
        this.generations = options.generations || 100;
        this.mutationRate = options.mutationRate || 0.1;
        this.eliteSize = options.eliteSize || 5;
    }

    optimize(zones, teams, constraints = {}) {
        // Créer la population initiale
        let population = this.createInitialPopulation(zones, teams);

        // Évolution
        for (let gen = 0; gen < this.generations; gen++) {
            // Évaluer la fitness
            const fitness = population.map(individual => ({
                individual,
                fitness: this.calculateFitness(individual, constraints)
            }));

            // Trier par fitness
            fitness.sort((a, b) => b.fitness - a.fitness);

            // Sélectionner l'élite
            const elite = fitness.slice(0, this.eliteSize).map(f => f.individual);

            // Créer la nouvelle génération
            const newPopulation = [...elite];

            while (newPopulation.length < this.populationSize) {
                // Sélection des parents
                const parent1 = this.selectParent(fitness);
                const parent2 = this.selectParent(fitness);

                // Croisement
                const child = this.crossover(parent1, parent2);

                // Mutation
                if (Math.random() < this.mutationRate) {
                    this.mutate(child);
                }

                newPopulation.push(child);
            }

            population = newPopulation;
        }

        // Retourner le meilleur individu
        const best = population.reduce((best, current) => {
            const currentFitness = this.calculateFitness(current, constraints);
            const bestFitness = this.calculateFitness(best, constraints);
            return currentFitness > bestFitness ? current : best;
        });

        return best;
    }

    createInitialPopulation(zones, teams) {
        const population = [];

        for (let i = 0; i < this.populationSize; i++) {
            const individual = new Map();
            const availableTeams = [...teams];

            for (const zone of zones) {
                const zoneTeams = [];
                const teamsNeeded = Math.min(7, availableTeams.length); // 7 types d'équipes

                for (let j = 0; j < teamsNeeded; j++) {
                    const randomIndex = Math.floor(Math.random() * availableTeams.length);
                    zoneTeams.push(availableTeams.splice(randomIndex, 1)[0]);
                }

                individual.set(zone, zoneTeams);
            }

            population.push(individual);
        }

        return population;
    }

    calculateFitness(allocation, constraints) {
        let fitness = 0;

        // Critère 1: Équilibrage de la charge
        const workloads = [];
        for (const [zone, teams] of allocation.entries()) {
            const workload = zone.totalHouses / Math.max(teams.length, 1);
            workloads.push(workload);
        }

        const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
        const workloadVariance = workloads.reduce((sum, w) =>
            sum + Math.pow(w - avgWorkload, 2), 0
        ) / workloads.length;

        fitness += 1000 / (1 + workloadVariance); // Minimiser la variance

        // Critère 2: Couverture complète
        for (const [zone, teams] of allocation.entries()) {
            const teamTypes = new Set(teams.map(t => t.type));
            fitness += teamTypes.size * 10; // Bonus pour chaque type d'équipe
        }

        // Critère 3: Respect des contraintes
        if (constraints.maxDuration) {
            // Pénalité si la durée estimée dépasse
            // (à implémenter selon les besoins)
        }

        return fitness;
    }

    selectParent(fitness) {
        // Sélection par tournoi
        const tournamentSize = 3;
        const tournament = [];

        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * fitness.length);
            tournament.push(fitness[randomIndex]);
        }

        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].individual;
    }

    crossover(parent1, parent2) {
        const child = new Map();
        const zones = Array.from(parent1.keys());

        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            // Choisir aléatoirement entre les deux parents
            const teams = Math.random() < 0.5
                ? parent1.get(zone)
                : parent2.get(zone);
            child.set(zone, [...teams]);
        }

        return child;
    }

    mutate(individual) {
        const zones = Array.from(individual.keys());
        if (zones.length < 2) return;

        // Échanger des équipes entre deux zones aléatoires
        const zone1 = zones[Math.floor(Math.random() * zones.length)];
        const zone2 = zones[Math.floor(Math.random() * zones.length)];

        if (zone1 === zone2) return;

        const teams1 = individual.get(zone1);
        const teams2 = individual.get(zone2);

        if (teams1.length > 0 && teams2.length > 0) {
            const idx1 = Math.floor(Math.random() * teams1.length);
            const idx2 = Math.floor(Math.random() * teams2.length);

            [teams1[idx1], teams2[idx2]] = [teams2[idx2], teams1[idx1]];
        }
    }
}

/**
 * Stratégie d'optimisation par coût
 * Minimise le coût total en utilisant le minimum d'équipes
 */
export class CostMinimizationStrategy extends OptimizationStrategy {
    optimize(zones, teams, constraints = {}) {
        const allocation = new Map();
        const { maxBudget } = constraints;

        // Trier les équipes par coût (croissant)
        const sortedTeams = [...teams].sort((a, b) => {
            const costA = this.getTeamCost(a);
            const costB = this.getTeamCost(b);
            return costA - costB;
        });

        let remainingBudget = maxBudget ? maxBudget.amount : Infinity;

        for (const zone of zones) {
            const zoneTeams = [];

            // Allouer le minimum d'équipes nécessaires
            for (const teamType of Object.values(TeamType)) {
                const team = sortedTeams.find(t =>
                    t.type === teamType && !this.isAllocated(t, allocation)
                );

                if (team) {
                    const teamCost = this.getTeamCost(team);
                    if (teamCost <= remainingBudget) {
                        zoneTeams.push(team);
                        remainingBudget -= teamCost;
                    }
                }
            }

            allocation.set(zone, zoneTeams);
        }

        return allocation;
    }

    getTeamCost(team) {
        // Coût estimé par équipe (à ajuster selon les données réelles)
        const TT = TeamTypeLocal || TeamType;
        const baseCosts = {
            [TT.PREPARATEURS]: 50000,
            [TT.LIVRAISON]: 60000,
            [TT.MACONS]: 80000,
            [TT.RESEAU]: 90000,
            [TT.INTERIEUR_TYPE1]: 70000,
            [TT.INTERIEUR_TYPE2]: 75000,
            [TT.CONTROLE]: 65000
        };

        return baseCosts[team.type] || 70000;
    }

    isAllocated(team, allocation) {
        for (const teams of allocation.values()) {
            if (teams.includes(team)) return true;
        }
        return false;
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.OptimizationStrategy = OptimizationStrategy;
    window.GreedyOptimizationStrategy = GreedyOptimizationStrategy;
    window.GeneticAlgorithmStrategy = GeneticAlgorithmStrategy;
    window.CostMinimizationStrategy = CostMinimizationStrategy;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OptimizationStrategy,
        GreedyOptimizationStrategy,
        GeneticAlgorithmStrategy,
        CostMinimizationStrategy
    };
}

// })();
