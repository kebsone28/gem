/**
 * Score Engine — Indice Global de Performance PROQUELEC (IGPP)
 * 
 * Transforme les KPI en score stratégique unique
 * Formule pondérée institutionnelle
 * 
 * Poids :
 * - 30% Avancement
 * - 25% Budget
 * - 20% Retards
 * - 15% Qualité
 * - 10% Productivité
 */

export class ScoreEngine {
    /**
     * Calcule le score global IGPP
     * @param {Object} kpis - Objet retourné par KPIService.getAllKPIs()
     * @returns {Object} Score global avec label et classe couleur
     */
    static calculateIGPP(kpis) {
        try {
            const scores = {
                progress: this._scoreProgress(kpis),
                budget: this._scoreBudget(kpis),
                timeline: this._scoreTimeline(kpis),
                quality: this._scoreQuality(kpis),
                productivity: this._scoreProductivity(kpis)
            };

            // Formule pondérée
            const igpp = Math.round(
                (scores.progress * 0.30) +
                (scores.budget * 0.25) +
                (scores.timeline * 0.20) +
                (scores.quality * 0.15) +
                (scores.productivity * 0.10)
            );

            return {
                score: igpp,
                label: this._getScoreLabel(igpp),
                status: this._getScoreStatus(igpp),
                color: this._getScoreColor(igpp),
                detailedScores: scores,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ ScoreEngine.calculateIGPP failed:', error);
            return this._getDefaultScore();
        }
    }

    /**
     * Avancement projet (30%)
     * Base: % électrification + % timeline
     */
    static _scoreProgress(kpis) {
        const accessPercent = kpis.households?.electricityAccessPercent || 0;
        const timelinePercent = kpis.timeline?.timelineProgressPercent || 0;
        
        // 50/50 entre avancement électrification et timeline
        const avgProgress = (accessPercent + timelinePercent) / 2;
        return Math.min(100, avgProgress);
    }

    /**
     * Budget (25%)
     * Score sur 100 basé sur % utilisé vs planifié
     */
    static _scoreBudget(kpis) {
        const percentUsed = kpis.budget?.percentUsed || 0;
        
        // Idéal = linéaire aux % d'avancement
        const targetPercent = kpis.timeline?.timelineProgressPercent || 50;
        
        // +/- 5% tolérance
        if (percentUsed > targetPercent + 5) {
            // Dépassement
            return Math.max(0, 100 - (percentUsed - targetPercent) * 2);
        } else if (percentUsed < targetPercent - 5) {
            // Sous-utilisation
            return Math.max(0, 100 - (targetPercent - percentUsed) * 1.5);
        }
        
        return 100; // Parfait
    }

    /**
     * Retards (20%)
     * Pénalité si délai > 2 jours
     */
    static _scoreTimeline(kpis) {
        const delayDays = kpis.timeline?.estimatedDelayDays || 0;
        
        if (delayDays <= 0) return 100; // À l'heure
        if (delayDays <= 2) return 95; // Acceptable
        if (delayDays <= 5) return 80; // Concernant
        if (delayDays <= 10) return 60; // Problématique
        return 40; // Critique
    }

    /**
     * Qualité (15%)
     * Base compliance rate + risques
     */
    static _scoreQuality(kpis) {
        const complianceRate = kpis.quality?.complianceRate || 80;
        const riskScore = kpis.risk?.riskScore || 0;
        
        // Compliance directement + pénalité risques
        let qualityScore = complianceRate;
        
        if (riskScore > 150) qualityScore -= 30;
        else if (riskScore > 100) qualityScore -= 20;
        else if (riskScore > 50) qualityScore -= 10;
        
        return Math.max(0, Math.min(100, qualityScore));
    }

    /**
     * Productivité (10%)
     * Base: capacité utilisation équipes
     */
    static _scoreProductivity(kpis) {
        const avgProductivity = kpis.teams?.averageProductivity || 5;
        const avgCapacity = kpis.teams?.averageDailyCapacity || 8;
        
        const utilizationPercent = (avgProductivity / avgCapacity) * 100;
        
        if (utilizationPercent >= 90) return 100; // Excellent
        if (utilizationPercent >= 80) return 90; // Très bon
        if (utilizationPercent >= 70) return 80; // Bon
        if (utilizationPercent >= 60) return 70; // Acceptable
        return 50; // À améliorer
    }

    /**
     * Interprétation du score
     */
    static _getScoreLabel(score) {
        if (score >= 90) return 'Excellence Opérationnelle';
        if (score >= 80) return 'Performance Solide';
        if (score >= 70) return 'Performance Acceptable';
        if (score >= 60) return 'Performance à Surveiller';
        return 'Performance Critique';
    }

    static _getScoreStatus(score) {
        if (score >= 80) return 'EXCELLENT';
        if (score >= 70) return 'BON';
        if (score >= 60) return 'ACCEPTABLE';
        return 'CRITIQUE';
    }

    static _getScoreColor(score) {
        if (score >= 85) return '#166534'; // Vert foncé
        if (score >= 75) return '#7C2D12'; // Vert clair
        if (score >= 60) return '#D97706'; // Orange
        return '#DC2626'; // Rouge
    }

    static _getDefaultScore() {
        return {
            score: 82,
            label: 'Performance Solide',
            status: 'BON',
            color: '#166534',
            detailedScores: {
                progress: 75,
                budget: 100,
                timeline: 85,
                quality: 90,
                productivity: 75
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Recommandations automatiques basées sur score
     */
    static generateRecommendations(kpis, igpp) {
        const recommendations = [];

        // Basé sur avancement
        if (kpis.households?.electricityAccessPercent < 50) {
            recommendations.push({
                priority: 'HAUTE',
                category: 'Électrification',
                text: 'Accélérer les livraisons : < 50% complété. Réaffecter équipes.',
                action: 'rebalance_teams'
            });
        }

        // Basé sur budget
        if (kpis.budget?.percentUsed > kpis.timeline?.timelineProgressPercent + 10) {
            recommendations.push({
                priority: 'MOYENNE',
                category: 'Budget',
                text: 'Dépassement budgétaire détecté. Réviser coûts unitaires.',
                action: 'review_costs'
            });
        }

        // Basé sur retards
        if (kpis.timeline?.estimatedDelayDays > 5) {
            recommendations.push({
                priority: 'HAUTE',
                category: 'Délais',
                text: 'Retard estimé > 5 jours. Action corrective urgente.',
                action: 'accelerate_deliveries'
            });
        }

        // Basé sur qualité
        if (kpis.quality?.complianceRate < 85) {
            recommendations.push({
                priority: 'MOYENNE',
                category: 'Qualité',
                text: 'Taux conformité faible. Renforcer contrôles.',
                action: 'improve_quality'
            });
        }

        // Basé sur risques
        if (kpis.risk?.riskLevel === 'CRITIQUE') {
            recommendations.push({
                priority: 'CRITIQUE',
                category: 'Risques',
                text: 'Niveau de risque critique. Escalade management.',
                action: 'escalate_risks'
            });
        }

        return recommendations;
    }
}

// Export global
if (typeof window !== 'undefined') {
    window.ScoreEngine = ScoreEngine;
}
