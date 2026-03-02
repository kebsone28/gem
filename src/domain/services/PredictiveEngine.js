/**
 * Moteur de Prévision IA (Simplifié)
 * Calcule les tendances et estime les dates de fin
 */
// (function () {
    export class PredictiveEngine {
        /**
         * Estime la date de fin pour une tâche donnée
         * @param {number} totalToPerform - Quantité totale à atteindre
         * @param {number} currentProgress - Quantité déjà réalisée
         * @param {Array} history - Liste des relevés quotidiens [{date, value}, ...]
         * @returns {Object} { estimatedEndDate, dailyRate, remainingDays }
         */
        estimateCompletion(totalToPerform, currentProgress, history = []) {
            const remaining = Math.max(0, totalToPerform - currentProgress);
            if (remaining === 0) return { estimatedEndDate: new Date(), dailyRate: 0, remainingDays: 0 };

            // Calculer la cadence moyenne sur les 7 derniers jours (ou moins si historique court)
            let dailyRate = this._calculateAverageRate(history, 7);

            // Si pas d'historique ou cadence nulle, on ne peut pas estimer précisément
            if (dailyRate <= 0) return { estimatedEndDate: null, dailyRate: 0, remainingDays: Infinity };

            const remainingDays = Math.ceil(remaining / dailyRate);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + remainingDays);

            return {
                estimatedEndDate: endDate,
                dailyRate: Math.round(dailyRate * 10) / 10,
                remainingDays: remainingDays
            };
        }

        /**
         * Calcule la cadence moyenne (unités/jour)
         */
        _calculateAverageRate(history, windowDays) {
            if (!history || history.length < 2) return 0;

            // Trier par date
            const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

            // Prendre les N derniers jours
            const relevant = sorted.slice(-windowDays);
            if (relevant.length < 2) return 0;

            const start = relevant[0];
            const end = relevant[relevant.length - 1];

            const timeDiff = new Date(end.date) - new Date(start.date);
            const daysDiff = Math.max(1, Math.round(timeDiff / (1000 * 60 * 60 * 24)));

            const valueDiff = end.value - start.value;

            return valueDiff / daysDiff;
        }

        /**
         * Analyse la santé globale
         */
        getHealthStatus(estimatedEndDate, targetDate) {
            if (!estimatedEndDate || !targetDate) return 'UNKNOWN';

            const diff = estimatedEndDate - targetDate;
            const daysDiff = diff / (1000 * 60 * 60 * 24);

            if (daysDiff <= 0) return 'ON_TRACK';
            if (daysDiff <= 7) return 'AT_RISK';
            return 'BEHIND';
        }
    }

    const engine = new PredictiveEngine();
    if (typeof window !== 'undefined') {
        window.PredictiveEngine = engine;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = engine;
    }
// })();
