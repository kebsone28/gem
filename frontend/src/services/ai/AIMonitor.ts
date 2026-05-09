/**
 * 📊 Système de Monitoring et Alertes pour l'IA
 * Surveille les performances et envoie des alertes en cas de dégradation
 */

interface HealthCheck {
  timestamp: number;
  component: string;
  status: 'healthy' | 'degraded' | 'critical';
  responseTime: number;
  errorRate: number;
  details: string;
}

interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  totalRequests: number;
  successRate: number;
  cacheHitRate: number;
  timestamp: number;
}

interface AIMonitorConfig {
  responseTimeThreshold: number; // ms
  errorRateThreshold: number; // 0-1
  degradationThreshold: number; // 0-1
  checkInterval: number; // ms
  alertRetention: number; // ms
}

class AIMonitor {
  private healthChecks: HealthCheck[] = [];
  private alerts: Alert[] = [];
  private config: AIMonitorConfig;
  private responseTimes: number[] = [];
  private errors: number = 0;
  private totalRequests: number = 0;
  private alertIdCounter: number = 0;

  constructor(config?: Partial<AIMonitorConfig>) {
    this.config = {
      responseTimeThreshold: 2000, // 2 secondes
      errorRateThreshold: 0.1, // 10%
      degradationThreshold: 0.3, // 30%
      checkInterval: 60000, // 1 minute
      alertRetention: 24 * 60 * 60 * 1000, // 24 heures
      ...config,
    };
  }

  /**
   * Enregistre une requête et son temps de réponse
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.responseTimes.push(responseTime);
    this.totalRequests++;

    if (!success) {
      this.errors++;
    }

    // Garder seulement les 1000 dernières requêtes
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Vérifier les seuils
    this.checkThresholds();
  }

  /**
   * Enregistre un health check
   */
  recordHealthCheck(component: string, status: HealthCheck['status'], responseTime: number, details: string): void {
    const check: HealthCheck = {
      timestamp: Date.now(),
      component,
      status,
      responseTime,
      errorRate: this.calculateErrorRate(),
      details,
    };

    this.healthChecks.push(check);

    // Garder seulement les 100 derniers checks
    if (this.healthChecks.length > 100) {
      this.healthChecks.shift();
    }

    // Créer une alerte si nécessaire
    if (status !== 'healthy') {
      this.createAlert(
        status === 'critical' ? 'critical' : 'warning',
        component,
        `Composant ${component} en état ${status}: ${details}`
      );
    }
  }

  /**
   * Crée une alerte
   */
  createAlert(severity: Alert['severity'], component: string, message: string): Alert {
    const alert: Alert = {
      id: `alert-${++this.alertIdCounter}`,
      timestamp: Date.now(),
      severity,
      component,
      message,
      resolved: false,
    };

    this.alerts.push(alert);
    this.cleanupOldAlerts();

    return alert;
  }

  /**
   * Résout une alerte
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  /**
   * Récupère les métriques de performance actuelles
   */
  getMetrics(): PerformanceMetrics {
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const len = sortedTimes.length;

    return {
      avgResponseTime: len > 0 ? sortedTimes.reduce((a, b) => a + b, 0) / len : 0,
      p95ResponseTime: len > 0 ? sortedTimes[Math.floor(len * 0.95)] || sortedTimes[len - 1] : 0,
      p99ResponseTime: len > 0 ? sortedTimes[Math.floor(len * 0.99)] || sortedTimes[len - 1] : 0,
      errorRate: this.calculateErrorRate(),
      totalRequests: this.totalRequests,
      successRate: this.totalRequests > 0 ? (this.totalRequests - this.errors) / this.totalRequests : 1,
      cacheHitRate: 0, // Sera mis à jour par le cache
      timestamp: Date.now(),
    };
  }

  /**
   * Récupère les alertes actives
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.resolved);
  }

  /**
   * Récupère toutes les alertes
   */
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Récupère les health checks récents
   */
  getRecentHealthChecks(limit: number = 10): HealthCheck[] {
    return this.healthChecks.slice(-limit);
  }

  /**
   * Vérifie si le système est healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.avgResponseTime < this.config.responseTimeThreshold &&
      metrics.errorRate < this.config.errorRateThreshold
    );
  }

  /**
   * Vérifie si le système est dégradé
   */
  isDegraded(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.avgResponseTime > this.config.responseTimeThreshold ||
      metrics.errorRate > this.config.errorRateThreshold
    );
  }

  /**
   * Calcule le taux d'erreur
   */
  private calculateErrorRate(): number {
    return this.totalRequests > 0 ? this.errors / this.totalRequests : 0;
  }

  /**
   * Vérifie les seuils et crée des alertes si nécessaire
   */
  private checkThresholds(): void {
    const metrics = this.getMetrics();

    // Vérifier le temps de réponse
    if (metrics.avgResponseTime > this.config.responseTimeThreshold) {
      this.createAlert(
        'warning',
        'performance',
        `Temps de réponse élevé: ${Math.round(metrics.avgResponseTime)}ms (seuil: ${this.config.responseTimeThreshold}ms)`
      );
    }

    // Vérifier le taux d'erreur
    if (metrics.errorRate > this.config.errorRateThreshold) {
      this.createAlert(
        'critical',
        'reliability',
        `Taux d'erreur élevé: ${(metrics.errorRate * 100).toFixed(1)}% (seuil: ${(this.config.errorRateThreshold * 100).toFixed(1)}%)`
      );
    }
  }

  /**
   * Nettoie les anciennes alertes
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - this.config.alertRetention;
    this.alerts = this.alerts.filter((a) => a.timestamp > cutoff || !a.resolved);
  }

  /**
   * Réinitialise les métriques
   */
  reset(): void {
    this.responseTimes = [];
    this.errors = 0;
    this.totalRequests = 0;
  }

  /**
   * Génère un rapport de santé complet
   */
  generateHealthReport(): {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: PerformanceMetrics;
    activeAlerts: number;
    recentChecks: HealthCheck[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const activeAlerts = this.getActiveAlerts();
    const recentChecks = this.getRecentHealthChecks(5);
    const recommendations: string[] = [];

    // Déterminer le statut global
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (metrics.errorRate > this.config.errorRateThreshold * 2) {
      status = 'critical';
    } else if (metrics.errorRate > this.config.errorRateThreshold || metrics.avgResponseTime > this.config.responseTimeThreshold) {
      status = 'degraded';
    }

    // Générer des recommandations
    if (metrics.avgResponseTime > this.config.responseTimeThreshold) {
      recommendations.push('Optimiser les temps de réponse du moteur IA');
      recommendations.push('Activer le cache si non activé');
    }

    if (metrics.errorRate > this.config.errorRateThreshold) {
      recommendations.push('Vérifier la connexion aux services IA externes');
      recommendations.push('Vérifier les logs d\'erreur');
    }

    if (metrics.cacheHitRate < 0.2) {
      recommendations.push('Améliorer la stratégie de cache');
    }

    return {
      status,
      metrics,
      activeAlerts: activeAlerts.length,
      recentChecks,
      recommendations,
    };
  }
}

// Singleton export
let monitorInstance: AIMonitor | null = null;

export function getAIMonitor(config?: Partial<AIMonitorConfig>): AIMonitor {
  if (!monitorInstance) {
    monitorInstance = new AIMonitor(config);
  }
  return monitorInstance;
}

export function resetAIMonitor(): void {
  monitorInstance = null;
}

export type { HealthCheck, Alert, PerformanceMetrics, AIMonitorConfig };
export { AIMonitor };
