/**
 * Service de métriques et monitoring
 * Collecte et analyse les métriques de performance
 */
export class MetricsService {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.metrics = new Map();
        this.timers = new Map();
        this.counters = new Map();
        this.gauges = new Map();
    }

    /**
     * Démarre un timer
     */
    startTimer(name) {
        this.timers.set(name, {
            startTime: performance.now(),
            name
        });
    }

    /**
     * Arrête un timer et enregistre la métrique
     */
    endTimer(name) {
        const timer = this.timers.get(name);
        if (!timer) {
            this.logger?.warn(`Timer ${name} not found`);
            return null;
        }

        const duration = performance.now() - timer.startTime;
        this.timers.delete(name);

        this.recordMetric('timer', name, duration);
        return duration;
    }

    /**
     * Incrémente un compteur
     */
    incrementCounter(name, value = 1) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
        this.recordMetric('counter', name, current + value);
    }

    /**
     * Définit une jauge
     */
    setGauge(name, value) {
        this.gauges.set(name, value);
        this.recordMetric('gauge', name, value);
    }

    /**
     * Enregistre une métrique
     */
    recordMetric(type, name, value, tags = {}) {
        const metric = {
            type,
            name,
            value,
            tags,
            timestamp: new Date().toISOString()
        };

        // Stocker dans l'historique
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name).push(metric);

        // Limiter l'historique à 1000 entrées
        const history = this.metrics.get(name);
        if (history.length > 1000) {
            history.shift();
        }

        // Émettre un événement
        this.eventBus?.emit('metric.recorded', metric);

        // Logger si valeur anormale
        if (this.isAnomalous(name, value)) {
            this.logger?.warn(`Anomalous metric detected: ${name}`, { value, tags });
        }
    }

    /**
     * Vérifie si une valeur est anormale
     */
    isAnomalous(name, value) {
        const history = this.metrics.get(name);
        if (!history || history.length < 10) return false;

        const values = history.map(m => m.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const stdDev = Math.sqrt(
            values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
        );

        // Détection d'anomalie : valeur à plus de 3 écarts-types
        return Math.abs(value - mean) > 3 * stdDev;
    }

    /**
     * Obtient les statistiques d'une métrique
     */
    getMetricStats(name) {
        const history = this.metrics.get(name);
        if (!history || history.length === 0) {
            return null;
        }

        const values = history.map(m => m.value);
        const sorted = [...values].sort((a, b) => a - b);

        return {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            mean: values.reduce((sum, v) => sum + v, 0) / values.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            latest: values[values.length - 1]
        };
    }

    /**
     * Obtient toutes les métriques
     */
    getAllMetrics() {
        const result = {
            timers: {},
            counters: {},
            gauges: {}
        };

        for (const [name, history] of this.metrics.entries()) {
            const latest = history[history.length - 1];
            if (latest.type === 'timer') {
                result.timers[name] = this.getMetricStats(name);
            } else if (latest.type === 'counter') {
                result.counters[name] = this.counters.get(name);
            } else if (latest.type === 'gauge') {
                result.gauges[name] = this.gauges.get(name);
            }
        }

        return result;
    }

    /**
     * Mesure une fonction
     */
    async measure(name, fn) {
        this.startTimer(name);
        try {
            const result = await fn();
            this.endTimer(name);
            return result;
        } catch (error) {
            this.endTimer(name);
            this.incrementCounter(`${name}.errors`);
            throw error;
        }
    }

    /**
     * Décorateur pour mesurer une méthode
     */
    measureMethod(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const metricsService = this;

        descriptor.value = async function (...args) {
            const metricName = `${target.constructor.name}.${propertyKey}`;
            return await metricsService.measure(metricName, () =>
                originalMethod.apply(this, args)
            );
        };

        return descriptor;
    }

    /**
     * Collecte les métriques système
     */
    collectSystemMetrics() {
        // Métriques de performance
        if (window.performance && window.performance.memory) {
            this.setGauge('system.memory.used', window.performance.memory.usedJSHeapSize);
            this.setGauge('system.memory.total', window.performance.memory.totalJSHeapSize);
            this.setGauge('system.memory.limit', window.performance.memory.jsHeapSizeLimit);
        }

        // Métriques de navigation
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            this.setGauge('page.load.time', timing.loadEventEnd - timing.navigationStart);
            this.setGauge('page.dom.ready', timing.domContentLoadedEventEnd - timing.navigationStart);
        }
    }

    /**
     * Démarre la collecte périodique
     */
    startPeriodicCollection(interval = 60000) {
        this.collectionInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, interval);
    }

    /**
     * Arrête la collecte périodique
     */
    stopPeriodicCollection() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }
    }

    /**
     * Exporte les métriques
     */
    export() {
        return {
            metrics: Array.from(this.metrics.entries()).map(([name, history]) => ({
                name,
                history: history.slice(-100) // Dernières 100 entrées
            })),
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Réinitialise toutes les métriques
     */
    reset() {
        this.metrics.clear();
        this.timers.clear();
        this.counters.clear();
        this.gauges.clear();
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.MetricsService = MetricsService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetricsService;
}
