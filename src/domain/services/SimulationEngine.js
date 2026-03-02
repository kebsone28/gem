/**
 * Moteur de simulation avancé avec Monte Carlo
 * Simule l'exécution d'un projet avec prise en compte des aléas
 */
// Wrap in IIFE to avoid leaking top-level declarations when loaded as <script>
// (function () {

// Resolve ProductivityRate dependency in Node/tests and browser
let _ProductivityRate;
try {
    if (typeof module !== 'undefined' && module.exports) {
        _ProductivityRate = require('../value-objects/ProductivityRate');
    }
} catch (e) {}

const ProductivityRateLocal = _ProductivityRate?.default || _ProductivityRate?.ProductivityRate || _ProductivityRate;

export class SimulationEngine {
    constructor(logger) {
        this.logger = logger || window.logger;
    }

    /**
     * Simule un projet jour par jour
     */
    simulate(project, config = {}) {
        this.logger?.info('Starting project simulation', { projectId: project.id });

        const {
            startDate = project.startDate,
            productivityRates = {},
            uncertaintyFactors = {},
            maxDays = 365
        } = config;

        const simulation = {
            project,
            days: [],
            totalDuration: 0,
            completedHouses: 0,
            bottlenecks: [],
            risks: []
        };

        let currentDate = new Date(startDate);
        let day = 0;

        while (day < maxDays && simulation.completedHouses < project.totalHouses) {
            const dayResult = this.simulateDay(
                project,
                currentDate,
                day,
                productivityRates,
                uncertaintyFactors
            );

            simulation.days.push(dayResult);
            simulation.completedHouses += dayResult.housesCompleted;

            // Détecter les goulots d'étranglement
            if (dayResult.bottleneck) {
                simulation.bottlenecks.push({
                    day,
                    date: new Date(currentDate),
                    ...dayResult.bottleneck
                });
            }

            // Avancer au jour suivant
            currentDate.setDate(currentDate.getDate() + 1);
            day++;
        }

        simulation.totalDuration = day;

        this.logger?.info('Simulation completed', {
            projectId: project.id,
            duration: day,
            completedHouses: simulation.completedHouses
        });

        return simulation;
    }

    /**
     * Simule une journée
     */
    simulateDay(project, date, dayNumber, productivityRates, uncertaintyFactors) {
        const dayResult = {
            day: dayNumber,
            date: new Date(date),
            housesCompleted: 0,
            teamProgress: [],
            bottleneck: null
        };

        // Simuler chaque zone
        for (const zone of project.zones) {
            const zoneProgress = this.simulateZoneDay(
                zone,
                productivityRates,
                uncertaintyFactors
            );

            dayResult.housesCompleted += zoneProgress.completed;
            dayResult.teamProgress.push(...zoneProgress.teams);

            if (zoneProgress.bottleneck) {
                dayResult.bottleneck = {
                    zone: zone.id,
                    ...zoneProgress.bottleneck
                };
            }
        }

        return dayResult;
    }

    /**
     * Simule une journée pour une zone
     */
    simulateZoneDay(zone, productivityRates, uncertaintyFactors) {
        const result = {
            zone: zone.id,
            completed: 0,
            teams: [],
            bottleneck: null
        };

        // Simuler chaque équipe
        for (const [teamType, teams] of zone.teams.entries()) {
            for (const team of teams) {
                const baseRate = productivityRates[teamType] ||
                    (ProductivityRateLocal || ProductivityRate).fromDefaults(teamType);

                // Appliquer les facteurs d'incertitude
                const actualRate = this.applyUncertainty(
                    baseRate.housesPerDay,
                    uncertaintyFactors[teamType] || 0.1
                );

                const completed = Math.floor(actualRate);
                result.completed += completed;

                result.teams.push({
                    teamId: team.id,
                    type: teamType,
                    planned: baseRate.housesPerDay,
                    actual: completed,
                    efficiency: (completed / baseRate.housesPerDay) * 100
                });
            }
        }

        return result;
    }

    /**
     * Applique un facteur d'incertitude (distribution normale)
     */
    applyUncertainty(value, factor) {
        // Générer un nombre aléatoire avec distribution normale
        const random = this.normalRandom();
        const variation = value * factor * random;
        return Math.max(0, value + variation);
    }

    /**
     * Génère un nombre aléatoire avec distribution normale (Box-Muller)
     */
    normalRandom() {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    /**
     * Simulation Monte Carlo (multiple runs)
     */
    monteCarlo(project, config = {}, iterations = 1000) {
        this.logger?.info('Starting Monte Carlo simulation', {
            projectId: project.id,
            iterations
        });

        const results = [];

        for (let i = 0; i < iterations; i++) {
            const simulation = this.simulate(project, config);
            results.push({
                iteration: i,
                duration: simulation.totalDuration,
                completedHouses: simulation.completedHouses,
                bottlenecks: simulation.bottlenecks.length
            });
        }

        // Analyser les résultats
        const analysis = this.analyzeMonteCarloResults(results);

        this.logger?.info('Monte Carlo simulation completed', {
            projectId: project.id,
            iterations,
            meanDuration: analysis.duration.mean
        });

        return {
            results,
            analysis
        };
    }

    /**
     * Analyse les résultats Monte Carlo
     */
    analyzeMonteCarloResults(results) {
        const durations = results.map(r => r.duration);
        const completions = results.map(r => r.completedHouses);

        return {
            duration: {
                mean: this.mean(durations),
                median: this.median(durations),
                stdDev: this.standardDeviation(durations),
                min: Math.min(...durations),
                max: Math.max(...durations),
                percentiles: {
                    p10: this.percentile(durations, 10),
                    p25: this.percentile(durations, 25),
                    p50: this.percentile(durations, 50),
                    p75: this.percentile(durations, 75),
                    p90: this.percentile(durations, 90),
                    p95: this.percentile(durations, 95),
                    p99: this.percentile(durations, 99)
                }
            },
            completion: {
                mean: this.mean(completions),
                median: this.median(completions),
                stdDev: this.standardDeviation(completions)
            },
            confidence: {
                duration80: [
                    this.percentile(durations, 10),
                    this.percentile(durations, 90)
                ],
                duration95: [
                    this.percentile(durations, 2.5),
                    this.percentile(durations, 97.5)
                ]
            }
        };
    }

    /**
     * Calcule la moyenne
     */
    mean(values) {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    /**
     * Calcule la médiane
     */
    median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    /**
     * Calcule l'écart-type
     */
    standardDeviation(values) {
        const avg = this.mean(values);
        const squareDiffs = values.map(v => Math.pow(v - avg, 2));
        const avgSquareDiff = this.mean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Calcule un percentile
     */
    percentile(values, p) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;

        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    /**
     * Génère un rapport de simulation
     */
    generateReport(monteCarloResult) {
        const { analysis } = monteCarloResult;

        return {
            summary: {
                estimatedDuration: Math.round(analysis.duration.mean),
                confidenceInterval80: analysis.confidence.duration80.map(Math.round),
                confidenceInterval95: analysis.confidence.duration95.map(Math.round),
                risk: this.assessRisk(analysis)
            },
            details: {
                duration: {
                    best: analysis.duration.min,
                    worst: analysis.duration.max,
                    mostLikely: Math.round(analysis.duration.median),
                    average: Math.round(analysis.duration.mean),
                    standardDeviation: Math.round(analysis.duration.stdDev)
                },
                percentiles: analysis.duration.percentiles
            },
            recommendations: this.generateRecommendations(analysis)
        };
    }

    /**
     * Évalue le risque
     */
    assessRisk(analysis) {
        const variance = analysis.duration.stdDev / analysis.duration.mean;

        if (variance < 0.1) return 'Faible';
        if (variance < 0.2) return 'Modéré';
        if (variance < 0.3) return 'Élevé';
        return 'Très élevé';
    }

    /**
     * Génère des recommandations
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        const variance = analysis.duration.stdDev / analysis.duration.mean;

        if (variance > 0.2) {
            recommendations.push({
                type: 'warning',
                message: 'Forte variabilité détectée. Envisagez d\'ajouter des équipes de réserve.'
            });
        }

        const p90 = analysis.duration.percentiles.p90;
        const mean = analysis.duration.mean;

        if ((p90 - mean) / mean > 0.3) {
            recommendations.push({
                type: 'info',
                message: 'Risque de dépassement important. Planifiez une marge de sécurité de 30%.'
            });
        }

        return recommendations;
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.SimulationEngine = SimulationEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationEngine;
}

// })();
