import logger from '../utils/logger.js';

/**
 * Service de calcul du score IGPP (Indice Global de Performance PROQUELEC)
 * Formule: 30% Progress + 25% Budget + 20% Timeline + 15% Quality + 10% Productivity
 */
class IGPPService {
  /**
   * Calculer le score IGPP
   */
  static calculateScore(kpiData) {
    try {
      const scores = {
        progress: this._scoreProgress(kpiData),
        budget: this._scoreBudget(kpiData),
        timeline: this._scoreTimeline(kpiData),
        quality: this._scoreQuality(kpiData),
        productivity: this._scoreProductivity(kpiData)
      };

      // Pondération
      const igppScore = 
        (scores.progress * 0.30) +
        (scores.budget * 0.25) +
        (scores.timeline * 0.20) +
        (scores.quality * 0.15) +
        (scores.productivity * 0.10);

      const finalScore = Math.round(igppScore);

      return {
        score: finalScore,
        label: this._getLabel(finalScore),
        status: this._getStatus(finalScore),
        color: this._getColor(finalScore),
        detailedScores: scores,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Erreur calcul IGPP: ${error.message}`);
      return { score: 0, label: 'Erreur', status: 'ERROR', color: '#DC2626' };
    }
  }

  /**
   * Score Progress (30%)
   * Basé sur: electricity_access_percent + timeline_progress_percent
   */
  static _scoreProgress(kpi) {
    const accessPercent = parseFloat(kpi.electricity_access_percent) || 0;
    const timelinePercent = parseFloat(kpi.timeline_progress_percent) || 0;
    
    // Moyenne weighted: 60% access, 40% timeline
    const score = (accessPercent * 0.6) + (timelinePercent * 0.4);
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score Budget (25%)
   * Basé sur: variance du budget utilisé vs. cible
   */
  static _scoreBudget(kpi) {
    const percentUsed = parseFloat(kpi.percent_used) || 0;
    
    // Idéal: 60-85% utilisé
    if (percentUsed >= 60 && percentUsed <= 85) {
      return 100; // Parfait
    } else if (percentUsed < 60) {
      return Math.min(100, percentUsed); // Pas assez dépensé
    } else if (percentUsed <= 100) {
      return 100 - ((percentUsed - 85) * 2); // Légère dépassement
    } else {
      return Math.max(0, 50 - (percentUsed - 100)); // Dépassement majeur
    }
  }

  /**
   * Score Timeline (20%)
   * Basé sur: délai estimé
   */
  static _scoreTimeline(kpi) {
    const delayDays = parseFloat(kpi.estimated_delay_days) || 0;
    
    if (delayDays <= 0) return 100; // À temps
    if (delayDays <= 2) return 95;   // 1-2 jours
    if (delayDays <= 5) return 80;   // 3-5 jours
    if (delayDays <= 10) return 60;  // 6-10 jours
    return Math.max(40, 100 - (delayDays * 5)); // >10 jours
  }

  /**
   * Score Quality (15%)
   * Basé sur: compliance_rate et penalties for risks
   */
  static _scoreQuality(kpi) {
    let score = parseFloat(kpi.compliance_rate) || 90;
    
    // Pénalités par risques
    if (kpi.risk_level === 'critical') {
      score -= 30;
    } else if (kpi.risk_level === 'high') {
      score -= 15;
    } else if (kpi.risk_level === 'medium') {
      score -= 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score Productivity (10%)
   * Basé sur: team_saturation_percent
   */
  static _scoreProductivity(kpi) {
    const saturation = parseFloat(kpi.team_saturation_percent) || 50;
    
    // Idéal: 60-80% saturation
    if (saturation >= 60 && saturation <= 80) {
      return 100;
    } else if (saturation < 60) {
      return saturation; // Sous-utilisé
    } else if (saturation <= 100) {
      return 100 - ((saturation - 80) * 1.5); // Sur-charge
    } else {
      return Math.max(30, 100 - saturation); // Fortement sur-chargé
    }
  }

  /**
   * Obtenir le label du score
   */
  static _getLabel(score) {
    if (score >= 90) return 'Excellence';
    if (score >= 80) return 'Très bon';
    if (score >= 65) return 'Performance Solide';
    if (score >= 50) return 'À améliorer';
    return 'Critique';
  }

  /**
   * Obtenir le statut
   */
  static _getStatus(score) {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 65) return 'BON';
    if (score >= 50) return 'ACCEPTABLE';
    return 'CRITIQUE';
  }

  /**
   * Obtenir la couleur (hex)
   */
  static _getColor(score) {
    if (score >= 85) return '#059669'; // Emerald
    if (score >= 70) return '#2563eb'; // Blue
    if (score >= 50) return '#f59e0b'; // Amber
    return '#dc2626'; // Red
  }

  /**
   * Générer des recommandations basées sur le score
   */
  static generateRecommendations(kpiData, igppScore) {
    const recommendations = [];

    // Analyse par composant
    if (kpiData.electricity_access_percent < 50) {
      recommendations.push({
        type: 'ALERT',
        message: `Accès électricité faible (${kpiData.electricity_access_percent}%). Accélérer les livraisons.`,
        priority: 'HIGH'
      });
    }

    if (kpiData.estimated_delay_days > 5) {
      recommendations.push({
        type: 'WARNING',
        message: `Délai estimé ${kpiData.estimated_delay_days}j. Renforcer les équipes ou ajuster la timeline.`,
        priority: 'HIGH'
      });
    }

    if (kpiData.percent_used > 90) {
      recommendations.push({
        type: 'WARNING',
        message: `Budget utilisé à ${kpiData.percent_used}%. Vigilance sur dépassement.`,
        priority: 'MEDIUM'
      });
    }

    if (kpiData.team_saturation_percent > 85) {
      recommendations.push({
        type: 'ALERT',
        message: `Saturation équipes ${kpiData.team_saturation_percent}%. Risque de burnout.`,
        priority: 'HIGH'
      });
    }

    if (kpiData.compliance_rate < 85) {
      recommendations.push({
        type: 'INFO',
        message: `Conformité ${kpiData.compliance_rate}%. Renforcer QA et formation.`,
        priority: 'MEDIUM'
      });
    }

    if (kpiData.risk_level === 'critical' || kpiData.critical_stock_alerts > 5) {
      recommendations.push({
        type: 'ALERT',
        message: `${kpiData.critical_stock_alerts} alertes stock critiques. Action immédiate requise.`,
        priority: 'CRITICAL'
      });
    }

    // Si tout est bon
    if (recommendations.length === 0 && igppScore.score >= 80) {
      recommendations.push({
        type: 'SUCCESS',
        message: 'Projet en excellent état. Maintenir le cap !',
        priority: 'LOW'
      });
    }

    return recommendations;
  }
}

export default IGPPService;
