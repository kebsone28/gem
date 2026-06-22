import logger from '../../services/logger';
import { planningErrorHandler } from '../../services/errorHandling/PlanningErrorHandler';

// Interface pour les métriques de performance
export interface PerformanceMetrics {
  timestamp: number;
  component: string;
  operation: string;
  duration: number;
  memoryUsage?: number;
  cacheHitRate?: number;
  errorCount?: number;
}

// Interface pour les métriques utilisateur
export interface UserMetrics {
  timestamp: number;
  userId?: string;
  projectId?: string;
  action: string;
  component: string;
  duration: number;
  success: boolean;
  errorMessage?: string;
}

// Interface pour les métriques système
export interface SystemMetrics {
  timestamp: number;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  activeTeams: number;
  cacheSize: number;
  errorRate: number;
  averageResponseTime: number;
}

class PlanningMetricsCollector {
  private performanceMetrics: PerformanceMetrics[] = [];
  private userMetrics: UserMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private maxMetricsCount = 1000;

  constructor() {
    this.setupPerformanceObserver();
    this.startPeriodicCollection();
  }

  // Configuration des observateurs de performance
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      // Observer les mesures de performance
      const performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('planning') || entry.name.includes('gantt')) {
            this.recordPerformanceMetric({
              timestamp: Date.now(),
              component: this.extractComponentFromName(entry.name),
              operation: this.extractOperationFromName(entry.name),
              duration: entry.duration,
              memoryUsage: this.getMemoryUsage(),
            });
          }
        }
      });

      performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
      this.observers.push(performanceObserver);
    }
  }

  // Collection périodique des métriques système
  private startPeriodicCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Toutes les 30 secondes

    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Nettoyer toutes les 5 minutes
  }

  // Enregistrement des métriques de performance
  public recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    this.limitMetricsSize(this.performanceMetrics);
    
    // Envoyer vers le service de monitoring
    this.sendToMonitoringService('performance', metric);
  }

  // Enregistrement des métriques utilisateur
  public recordUserMetric(metric: UserMetrics): void {
    this.userMetrics.push(metric);
    this.limitMetricsSize(this.userMetrics);
    
    this.sendToMonitoringService('user', metric);
  }

  // Enregistrement des métriques système
  public recordSystemMetric(metric: SystemMetrics): void {
    this.systemMetrics.push(metric);
    this.limitMetricsSize(this.systemMetrics);
    
    this.sendToMonitoringService('system', metric);
  }

  // Collection des métriques système
  private collectSystemMetrics(): void {
    const errorMetrics = planningErrorHandler.getErrorMetrics();
    
    const systemMetric: SystemMetrics = {
      timestamp: Date.now(),
      totalTasks: this.calculateTotalTasks(),
      completedTasks: this.calculateCompletedTasks(),
      delayedTasks: this.calculateDelayedTasks(),
      activeTeams: this.calculateActiveTeams(),
      cacheSize: this.getCacheSize(),
      errorRate: this.calculateErrorRate(errorMetrics),
      averageResponseTime: this.calculateAverageResponseTime(),
    };

    this.recordSystemMetric(systemMetric);
  }

  // Utilitaires pour extraire les informations
  private extractComponentFromName(name: string): string {
    const match = name.match(/planning-(\w+)/);
    return match ? match[1] : 'unknown';
  }

  private extractOperationFromName(name: string): string {
    const match = name.match(/-(\w+)-(start|end)/);
    return match ? match[1] : 'operation';
  }

  // Utilitaires pour les calculs
  private getMemoryUsage(): number {
    // @ts-ignore - performance.memory est une extension Chrome non-standard
    if (performance.memory) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024); // MB
    }
    return 0;
  }

  private getCacheSize(): number {
    // Estimation basée sur les métriques disponibles
    return this.performanceMetrics.length + this.userMetrics.length;
  }

  private calculateErrorRate(errorMetrics: any): number {
    const totalErrors = errorMetrics.totalErrors || 0;
    const totalOperations = this.performanceMetrics.length + this.userMetrics.length;
    return totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
  }

  private calculateAverageResponseTime(): number {
    if (this.performanceMetrics.length === 0) return 0;
    
    const totalDuration = this.performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return Math.round(totalDuration / this.performanceMetrics.length);
  }

  private calculateTotalTasks(): number {
    // À implémenter selon les données disponibles
    return 0;
  }

  private calculateCompletedTasks(): number {
    // À implémenter selon les données disponibles
    return 0;
  }

  private calculateDelayedTasks(): number {
    // À implémenter selon les données disponibles
    return 0;
  }

  private calculateActiveTeams(): number {
    // À implémenter selon les données disponibles
    return 0;
  }

  // Nettoyage des anciennes métriques
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 heures

    this.performanceMetrics = this.performanceMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
    this.userMetrics = this.userMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
    this.systemMetrics = this.systemMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
  }

  // Limitation de la taille des tableaux
  private limitMetricsSize(metrics: any[]): void {
    if (metrics.length > this.maxMetricsCount) {
      metrics.splice(0, metrics.length - this.maxMetricsCount);
    }
  }

  // Envoi vers le service de monitoring
  private sendToMonitoringService(type: string, metric: any): void {
    // Implémenter l'envoi vers votre service de monitoring
    // Ex: API endpoint, WebSocket, etc.
    
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[PlanningMetrics] ${type}:`, metric);
    }
    
    // Exemple d'envoi vers une API
    /*
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, metric, timestamp: Date.now() })
    }).catch(error => {
      logger.error('Failed to send metrics:', error);
    });
    */
  }

  // Méthodes publiques pour obtenir les métriques
  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  public getUserMetrics(): UserMetrics[] {
    return [...this.userMetrics];
  }

  public getSystemMetrics(): SystemMetrics[] {
    return [...this.systemMetrics];
  }

  public getRecentMetrics(minutes: number = 30): {
    performance: PerformanceMetrics[];
    user: UserMetrics[];
    system: SystemMetrics[];
  } {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);

    return {
      performance: this.performanceMetrics.filter(m => m.timestamp > cutoffTime),
      user: this.userMetrics.filter(m => m.timestamp > cutoffTime),
      system: this.systemMetrics.filter(m => m.timestamp > cutoffTime),
    };
  }

  // Génération de rapports
  public generateReport(): {
    summary: any;
    performance: any;
    errors: any;
    recommendations: string[];
  } {
    const recentMetrics = this.getRecentMetrics(60); // Dernière heure
    const errorMetrics = planningErrorHandler.getErrorMetrics();

    const summary = {
      totalOperations: recentMetrics.performance.length + recentMetrics.user.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(errorMetrics),
      memoryUsage: this.getMemoryUsage(),
      cacheSize: this.getCacheSize(),
    };

    const performance = {
      slowestOperations: this.getSlowestOperations(recentMetrics.performance, 5),
      fastestOperations: this.getFastestOperations(recentMetrics.performance, 5),
      componentPerformance: this.getComponentPerformance(recentMetrics.performance),
    };

    const errors = {
      totalErrors: errorMetrics.totalErrors || 0,
      errorsByType: errorMetrics.errorsByType || {},
      errorsBySeverity: errorMetrics.errorsBySeverity || {},
      recentErrors: this.getRecentErrors(recentMetrics.user),
    };

    const recommendations = this.generateRecommendations(summary, performance, errors);

    return {
      summary,
      performance,
      errors,
      recommendations,
    };
  }

  private getSlowestOperations(metrics: PerformanceMetrics[], count: number): PerformanceMetrics[] {
    return metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count);
  }

  private getFastestOperations(metrics: PerformanceMetrics[], count: number): PerformanceMetrics[] {
    return metrics
      .sort((a, b) => a.duration - b.duration)
      .slice(0, count);
  }

  private getComponentPerformance(metrics: PerformanceMetrics[]): Record<string, any> {
    const componentStats: Record<string, any> = {};

    metrics.forEach(metric => {
      if (!componentStats[metric.component]) {
        componentStats[metric.component] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
        };
      }

      const stats = componentStats[metric.component];
      stats.count++;
      stats.totalDuration += metric.duration;
      stats.averageDuration = stats.totalDuration / stats.count;
      stats.minDuration = Math.min(stats.minDuration, metric.duration);
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
    });

    return componentStats;
  }

  private getRecentErrors(userMetrics: UserMetrics[]): UserMetrics[] {
    return userMetrics.filter(metric => !metric.success).slice(0, 10);
  }

  private generateRecommendations(summary: any, performance: any, errors: any): string[] {
    const recommendations: string[] = [];

    if (summary.averageResponseTime > 2000) {
      recommendations.push('Le temps de réponse moyen est élevé. Envisagez d\'optimiser les algorithmes ou d\'ajouter du cache.');
    }

    if (summary.errorRate > 5) {
      recommendations.push('Le taux d\'erreur est élevé. Vérifiez les logs et améliorez la gestion des erreurs.');
    }

    if (summary.memoryUsage > 100) {
      recommendations.push('L\'utilisation mémoire est élevée. Envisagez d\'optimiser la gestion des données.');
    }

    if (errors.totalErrors > 10) {
      recommendations.push('Le nombre d\'erreurs est élevé. Investiguez les causes fréquentes.');
    }

    const slowComponents = Object.entries(performance.componentPerformance)
      .filter(([_, stats]: any) => stats.averageDuration > 1000)
      .map(([component]) => component);

    if (slowComponents.length > 0) {
      recommendations.push(`Les composants suivants sont lents: ${slowComponents.join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Les performances sont bonnes. Continuez à surveiller les métriques.');
    }

    return recommendations;
  }

  // Nettoyage
  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.performanceMetrics = [];
    this.userMetrics = [];
    this.systemMetrics = [];
  }
}

// Instance singleton
export const planningMetrics = new PlanningMetricsCollector();

// Hook React pour les métriques
export const usePlanningMetrics = () => {
  const recordUserAction = (action: string, component: string, duration: number, success: boolean, errorMessage?: string) => {
    planningMetrics.recordUserMetric({
      timestamp: Date.now(),
      action,
      component,
      duration,
      success,
      errorMessage,
    });
  };

  const startPerformanceMeasure = (name: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
  };

  const endPerformanceMeasure = (name: string) => {
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  };

  return {
    recordUserAction,
    startPerformanceMeasure,
    endPerformanceMeasure,
    getMetrics: planningMetrics.getRecentMetrics,
    generateReport: planningMetrics.generateReport,
  };
};
