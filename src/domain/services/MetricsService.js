/**
 * Service de domaine pour les métriques et l'analyse
 * Remplace l'ancien analytics.js avec une architecture DDD
 */
(function () {
    class MetricsService {
        constructor(eventBus = null) {
            this.eventBus = eventBus;
            this.timers = new Map();
        }

        /**
         * Démarre un chronomètre pour une opération
         */
        startTimer(label) {
            this.timers.set(label, performance.now());
        }

        /**
         * Arrête un chronomètre et retourne la durée
         */
        endTimer(label) {
            if (!this.timers.has(label)) return 0;
            const start = this.timers.get(label);
            const duration = performance.now() - start;
            this.timers.delete(label);

            // Log ou émettre un événement
            if (this.eventBus) {
                this.eventBus.emit('metrics.timer', { label, duration });
            }

            return duration;
        }

        /**
         * Calcule la moyenne d'un tableau de nombres
         */
        mean(arr) {
            if (!arr || arr.length === 0) return 0;
            return arr.reduce((sum, val) => sum + val, 0) / arr.length;
        }

        /**
         * Régression linéaire simple pour détecter les tendances
         * Retourne { slope, intercept }
         */
        linearRegression(yValues) {
            if (!yValues || yValues.length < 2) return { slope: 0, intercept: yValues && yValues.length === 1 ? yValues[0] : 0 };

            const n = yValues.length;
            const xValues = Array.from({ length: n }, (_, i) => i);

            const sumX = xValues.reduce((a, b) => a + b, 0);
            const sumY = yValues.reduce((a, b) => a + b, 0);
            const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
            const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            return { slope, intercept };
        }

        /**
         * Calcule la médiane d'un tableau de nombres
         */
        median(arr) {
            if (!arr || arr.length === 0) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
        }

        /**
         * Calcule l'écart-type d'un tableau de nombres
         */
        standardDeviation(arr) {
            if (!arr || arr.length < 2) return 0;
            const mean = this.mean(arr);
            const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
            return Math.sqrt(variance);
        }

        /**
         * Calcule un percentile d'un tableau de nombres
         */
        percentile(arr, p) {
            if (!arr || arr.length === 0) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const index = (p / 100) * (sorted.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index % 1;

            if (upper >= sorted.length) return sorted[sorted.length - 1];
            return sorted[lower] * (1 - weight) + sorted[upper] * weight;
        }

        /**
         * Calcule le coefficient de corrélation entre deux tableaux
         */
        correlation(x, y) {
            if (!x || !y || x.length !== y.length || x.length < 2) return 0;

            const n = x.length;
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = y.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
            const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
            const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

            const numerator = n * sumXY - sumX * sumY;
            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

            return denominator === 0 ? 0 : numerator / denominator;
        }

        /**
         * Calcule la moyenne mobile d'un tableau
         */
        movingAverage(arr, windowSize) {
            if (!arr || arr.length < windowSize) return [];
            const result = [];
            for (let i = windowSize - 1; i < arr.length; i++) {
                const window = arr.slice(i - windowSize + 1, i + 1);
                result.push(this.mean(window));
            }
            return result;
        }

        /**
         * Prédit la date de fin d'une zone basée sur la productivité récente
         */
        predictEndDate(zone, currentDay) {
            if (!zone || !zone.metrics || !zone.metrics.productivity) {
                return null;
            }

            const recentDays = 7;
            const productivity = zone.metrics.productivity.slice(-recentDays);

            if (productivity.length === 0) return null;

            const avgProd = this.mean(productivity);

            if (avgProd === 0) return null;

            const remaining = zone.totalHouses - (zone.completedHouses || 0);
            const daysLeft = Math.ceil(remaining / avgProd);

            return currentDay + daysLeft;
        }

        /**
         * Détecte la tendance de productivité d'une zone
         * Retourne { trend: 'declining'|'improving'|'stable', severity: 'warning'|'info', slope }
         */
        detectTrend(zone) {
            if (!zone || !zone.metrics || !zone.metrics.productivity || zone.metrics.productivity.length < 7) {
                return { trend: 'stable', severity: 'info', slope: 0 };
            }

            const prod = zone.metrics.productivity;
            const regression = this.linearRegression(prod);
            const slope = regression.slope;

            if (slope < -0.5) {
                return { trend: 'declining', severity: 'warning', slope: slope };
            } else if (slope > 0.5) {
                return { trend: 'improving', severity: 'info', slope: slope };
            } else {
                return { trend: 'stable', severity: 'info', slope: slope };
            }
        }

        /**
         * Calcule la vélocité (vitesse d'avancement) d'une zone
         * Compare la productivité actuelle à la cible
         */
        calculateVelocity(zone, plannedDuration) {
            if (!zone || !zone.metrics || !zone.metrics.productivity) {
                return { current: 0, target: 0, ratio: 0, status: 'unknown' };
            }

            const last7Days = zone.metrics.productivity.slice(-7);
            const velocity = this.mean(last7Days);

            const target = plannedDuration > 0 ? zone.totalHouses / plannedDuration : 0;
            const ratio = target > 0 ? velocity / target : 0;

            return {
                current: velocity,
                target: target,
                ratio: ratio,
                status: velocity >= target * 0.9 ? 'on-track' : 'behind'
            };
        }

        /**
         * Identifie le chemin critique (zones qui déterminent la durée globale)
         */
        findCriticalPath(zones) {
            if (!zones || zones.length === 0) return [];

            // Trier par durée estimée décroissante
            const sorted = [...zones].sort((a, b) => (b.estimatedDuration || 0) - (a.estimatedDuration || 0));

            // Le chemin critique est la zone la plus lente (simplification)
            return sorted.slice(0, 1);
        }

        /**
         * Calcule des statistiques globales sur toutes les zones
         */
        calculateGlobalStats(zones) {
            if (!zones || zones.length === 0) {
                return {
                    avgProductivity: 0,
                    avgUtilization: 0,
                    totalCompleted: 0,
                    totalRemaining: 0,
                    fastestZone: null,
                    slowestZone: null
                };
            }

            const productivities = zones.map(z =>
                z.metrics && z.metrics.productivity ? this.mean(z.metrics.productivity) : 0
            );

            const utilizations = zones.map(z =>
                z.metrics && z.metrics.utilization ? this.mean(z.metrics.utilization) : 0
            );

            const completed = zones.reduce((sum, z) => sum + (z.completedHouses || 0), 0);
            const remaining = zones.reduce((sum, z) => sum + (z.totalHouses - (z.completedHouses || 0)), 0);

            // Trouver zones les plus rapides/lentes
            const withDuration = zones.filter(z => z.estimatedDuration > 0);
            const fastest = withDuration.length > 0
                ? withDuration.reduce((min, z) => z.estimatedDuration < min.estimatedDuration ? z : min)
                : null;
            const slowest = withDuration.length > 0
                ? withDuration.reduce((max, z) => z.estimatedDuration > max.estimatedDuration ? z : max)
                : null;

            return {
                avgProductivity: this.mean(productivities),
                avgUtilization: this.mean(utilizations),
                totalCompleted: completed,
                totalRemaining: remaining,
                fastestZone: fastest,
                slowestZone: slowest
            };
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.MetricsService = MetricsService;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MetricsService;
    }

    // Export ES6 pour les tests
    if (typeof globalThis !== 'undefined') {
        globalThis.MetricsService = MetricsService;
    }
})();
