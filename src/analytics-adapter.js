/**
 * Adaptateur pour Analytics (Legacy -> DDD)
 * Maintient la compatibilité avec l'ancien objet global Analytics
 * tout en utilisant le nouveau MetricsService
 */

(function () {
    'use strict';

    console.log('📊 Loading analytics adapter...');

    // Attendre l'initialisation des services
    window.addEventListener('load', () => {
        if (!window.metricsService) {
            console.warn('⚠️ MetricsService not found, using fallback');
            window.metricsService = new MetricsService();
        }

        // Créer l'objet legacy Analytics redirigeant vers MetricsService
        window.Analytics = {
            mean: (arr) => window.metricsService.mean(arr),

            linearRegression: (yValues) => window.metricsService.linearRegression(yValues),

            predictEndDate: (zone, currentDay) => {
                // Adapter la structure de zone si nécessaire
                const adaptedZone = {
                    ...zone,
                    totalHouses: zone.total || zone.totalHouses,
                    completedHouses: zone.stocks?.fini || zone.completedHouses || 0
                };
                return window.metricsService.predictEndDate(adaptedZone, currentDay);
            },

            detectTrend: (zone) => window.metricsService.detectTrend(zone),

            calculateVelocity: (zone, plannedDuration) => {
                const adaptedZone = {
                    ...zone,
                    totalHouses: zone.total || zone.totalHouses
                };
                return window.metricsService.calculateVelocity(adaptedZone, plannedDuration);
            },

            calculateUtilization: (zone) => {
                if (!zone || !zone.metrics || !zone.metrics.utilization) return 0;
                return window.metricsService.mean(zone.metrics.utilization);
            },

            findCriticalPath: (zones) => {
                // Adapter les zones pour le service
                const adaptedZones = zones.map(z => ({
                    ...z,
                    estimatedDuration: z.duration
                }));
                return window.metricsService.findCriticalPath(adaptedZones);
            },

            calculateGlobalStats: (zones) => {
                // Adapter les zones
                const adaptedZones = zones.map(z => ({
                    ...z,
                    totalHouses: z.total || z.totalHouses,
                    completedHouses: z.stocks?.fini || z.completedHouses || 0,
                    estimatedDuration: z.duration
                }));
                return window.metricsService.calculateGlobalStats(adaptedZones);
            }
        };

        console.log('✅ Analytics adapter ready (Legacy bridge established)');
    });
})();
