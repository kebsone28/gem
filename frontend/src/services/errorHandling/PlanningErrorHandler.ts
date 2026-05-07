import { toast } from 'react-hot-toast';
import logger from '../../utils/logger';

// Types d'erreurs spécifiques au planning
export const PlanningErrorType = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
  DATA_INCONSISTENCY: 'DATA_INCONSISTENCY',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ALLOCATION_ERROR: 'ALLOCATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
} as const;

export type PlanningErrorType = typeof PlanningErrorType[keyof typeof PlanningErrorType];

// Niveaux de sévérité
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// Interface pour les erreurs de planning
export interface PlanningError {
  id: string;
  type: PlanningErrorType;
  severity: ErrorSeverity;
  message: string;
  technicalMessage?: string;
  context?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  projectId?: string;
  actionable?: boolean;
  suggestedAction?: string;
  retryCount?: number;
  resolved?: boolean;
}

// Interface pour les gestionnaires d'erreurs
export interface ErrorHandler {
  canHandle(error: PlanningError): boolean;
  handle(error: PlanningError): Promise<boolean>;
  priority: number;
}

// Configuration du gestionnaire d'erreurs
export interface ErrorHandlerConfig {
  enableToastNotifications: boolean;
  enableLogging: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableErrorRecovery: boolean;
  collectErrorMetrics: boolean;
}

class PlanningErrorHandlerService {
  private handlers: ErrorHandler[] = [];
  private errorHistory: PlanningError[] = [];
  private config: ErrorHandlerConfig;
  private retryAttempts = new Map<string, number>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableToastNotifications: true,
      enableLogging: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableErrorRecovery: true,
      collectErrorMetrics: true,
      ...config,
    };

    // Enregistrement des gestionnaires par défaut
    this.registerDefaultHandlers();
  }

  // Enregistrement d'un gestionnaire d'erreurs
  registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
    // Tri par priorité (ordre décroissant)
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  // Création d'une erreur structurée
  createError(
    type: PlanningErrorType,
    message: string,
    options: Partial<PlanningError> = {}
  ): PlanningError {
    return {
      id: this.generateErrorId(),
      type,
      severity: options.severity || this.getDefaultSeverity(type),
      message,
      technicalMessage: options.technicalMessage,
      context: options.context,
      timestamp: new Date(),
      userId: options.userId,
      projectId: options.projectId,
      actionable: options.actionable ?? this.isActionableByDefault(type),
      suggestedAction: options.suggestedAction,
      retryCount: options.retryCount || 0,
      resolved: false,
      ...options,
    };
  }

  // Gestion principale des erreurs
  async handleError(error: PlanningError | Error | string, context?: Record<string, any>): Promise<boolean> {
    // Normalisation de l'erreur
    const planningError = this.normalizeError(error, context);
    
    // Ajout à l'historique
    this.addToHistory(planningError);

    // Logging
    if (this.config.enableLogging) {
      this.logError(planningError);
    }

    // Notification toast
    if (this.config.enableToastNotifications) {
      this.showErrorToast(planningError);
    }

    // Tentative de récupération automatique
    if (this.config.enableErrorRecovery && planningError.actionable) {
      const recovered = await this.attemptRecovery(planningError);
      if (recovered) {
        return true;
      }
    }

    // Délégation aux gestionnaires enregistrés
    for (const handler of this.handlers) {
      if (handler.canHandle(planningError)) {
        try {
          const handled = await handler.handle(planningError);
          if (handled) {
            return true;
          }
        } catch (handlerError) {
          logger.error('[PlanningErrorHandler] Handler failed', handlerError);
        }
      }
    }

    return false;
  }

  // Normalisation des erreurs
  private normalizeError(error: PlanningError | Error | string, context?: Record<string, any>): PlanningError {
    if (this.isPlanningError(error)) {
      return { ...error, context: { ...error.context, ...context } };
    }

    if (error instanceof Error) {
      return this.createError(
        this.inferErrorType(error),
        error.message,
        {
          technicalMessage: error.stack,
          context,
        }
      );
    }

    if (typeof error === 'string') {
      return this.createError(
        PlanningErrorType.VALIDATION_ERROR,
        error,
        { context }
      );
    }

    return this.createError(
      PlanningErrorType.VALIDATION_ERROR,
      'Erreur inconnue',
      { context, technicalMessage: JSON.stringify(error) }
    );
  }

  // Inférence du type d'erreur
  private inferErrorType(error: Error): PlanningErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return PlanningErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('timeout')) {
      return PlanningErrorType.TIMEOUT_ERROR;
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return PlanningErrorType.PERMISSION_ERROR;
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return PlanningErrorType.RESOURCE_NOT_FOUND;
    }
    
    if (message.includes('validation')) {
      return PlanningErrorType.VALIDATION_ERROR;
    }
    
    if (message.includes('calculation')) {
      return PlanningErrorType.CALCULATION_ERROR;
    }
    
    if (message.includes('dependency')) {
      return PlanningErrorType.DEPENDENCY_ERROR;
    }
    
    return PlanningErrorType.DATA_INCONSISTENCY;
  }

  // Tentative de récupération automatique
  private async attemptRecovery(error: PlanningError): Promise<boolean> {
    const retryKey = `${error.type}:${error.message}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= this.config.maxRetryAttempts) {
      return false;
    }

    this.retryAttempts.set(retryKey, currentAttempts + 1);

    // Attendre avant de réessayer
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * currentAttempts));

    try {
      // Logique de récupération spécifique au type d'erreur
      switch (error.type) {
        case PlanningErrorType.NETWORK_ERROR:
          return await this.handleNetworkError(error);
        
        case PlanningErrorType.TIMEOUT_ERROR:
          return await this.handleTimeoutError(error);
        
        case PlanningErrorType.CALCULATION_ERROR:
          return await this.handleCalculationError(error);
        
        default:
          return false;
      }
    } catch (recoveryError) {
      logger.error('[PlanningErrorHandler] Recovery failed', recoveryError);
      return false;
    }
  }

  // Gestionnaires de récupération spécifiques
  private async handleNetworkError(error: PlanningError): Promise<boolean> {
    // Implémenter la logique de retry réseau
    logger.info('[PlanningErrorHandler] Attempting network recovery');
    return false; // À implémenter selon les besoins
  }

  private async handleTimeoutError(error: PlanningError): Promise<boolean> {
    // Implémenter la logique de retry timeout
    logger.info('[PlanningErrorHandler] Attempting timeout recovery');
    return false; // À implémenter selon les besoins
  }

  private async handleCalculationError(error: PlanningError): Promise<boolean> {
    // Implémenter la logique de récupération de calcul
    logger.info('[PlanningErrorHandler] Attempting calculation recovery');
    return false; // À implémenter selon les besoins
  }

  // Affichage des notifications toast
  private showErrorToast(error: PlanningError): void {
    const toastConfig = {
      duration: error.severity === ErrorSeverity.CRITICAL ? 10000 : 5000,
      icon: this.getErrorIcon(error.type),
    };

    const message = error.suggestedAction 
      ? `${error.message}. ${error.suggestedAction}`
      : error.message;

    switch (error.severity) {
      case ErrorSeverity.LOW:
        toast(message, { ...toastConfig, style: { background: '#3b82f6' } });
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message, toastConfig);
        break;
      case ErrorSeverity.HIGH:
        toast.error(message, { ...toastConfig, duration: 8000 });
        break;
      case ErrorSeverity.CRITICAL:
        toast.error(message, { ...toastConfig, duration: 12000 });
        break;
    }
  }

  // Logging des erreurs
  private logError(error: PlanningError): void {
    const logData = {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      technicalMessage: error.technicalMessage,
      context: error.context,
      timestamp: error.timestamp,
      userId: error.userId,
      projectId: error.projectId,
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logger.info('[PlanningErrorHandler]', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('[PlanningErrorHandler]', logData);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logger.error('[PlanningErrorHandler]', logData);
        break;
    }
  }

  // Utilitaires
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isPlanningError(error: any): error is PlanningError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error;
  }

  private getDefaultSeverity(type: PlanningErrorType): ErrorSeverity {
    const severityMap = {
      [PlanningErrorType.VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
      [PlanningErrorType.NETWORK_ERROR]: ErrorSeverity.HIGH,
      [PlanningErrorType.CALCULATION_ERROR]: ErrorSeverity.HIGH,
      [PlanningErrorType.DATA_INCONSISTENCY]: ErrorSeverity.HIGH,
      [PlanningErrorType.PERMISSION_ERROR]: ErrorSeverity.HIGH,
      [PlanningErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [PlanningErrorType.RESOURCE_NOT_FOUND]: ErrorSeverity.MEDIUM,
      [PlanningErrorType.ALLOCATION_ERROR]: ErrorSeverity.MEDIUM,
      [PlanningErrorType.DEPENDENCY_ERROR]: ErrorSeverity.MEDIUM,
    };

    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  private isActionableByDefault(type: PlanningErrorType): boolean {
    const actionableTypes: PlanningErrorType[] = [
      PlanningErrorType.NETWORK_ERROR,
      PlanningErrorType.TIMEOUT_ERROR,
      PlanningErrorType.CALCULATION_ERROR,
      PlanningErrorType.ALLOCATION_ERROR,
    ];

    return actionableTypes.includes(type);
  }

  private getErrorIcon(type: PlanningErrorType): string {
    const iconMap = {
      [PlanningErrorType.VALIDATION_ERROR]: '⚠️',
      [PlanningErrorType.NETWORK_ERROR]: '🌐',
      [PlanningErrorType.CALCULATION_ERROR]: '🧮',
      [PlanningErrorType.DATA_INCONSISTENCY]: '📊',
      [PlanningErrorType.PERMISSION_ERROR]: '🔒',
      [PlanningErrorType.TIMEOUT_ERROR]: '⏰',
      [PlanningErrorType.RESOURCE_NOT_FOUND]: '🔍',
      [PlanningErrorType.ALLOCATION_ERROR]: '👥',
      [PlanningErrorType.DEPENDENCY_ERROR]: '🔗',
    };

    return iconMap[type] || '❌';
  }

  private addToHistory(error: PlanningError): void {
    this.errorHistory.unshift(error);
    
    // Limiter l'historique à 1000 erreurs
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(0, 1000);
    }
  }

  // Gestionnaires par défaut
  private registerDefaultHandlers(): void {
    // Gestionnaire d'erreurs de validation
    this.registerHandler({
      canHandle: (error) => error.type === PlanningErrorType.VALIDATION_ERROR,
      handle: async (error) => {
        // Logique de gestion des erreurs de validation
        logger.info('[ValidationHandler] Handling validation error', error);
        return true;
      },
      priority: 1,
    });

    // Gestionnaire d'erreurs réseau
    this.registerHandler({
      canHandle: (error) => error.type === PlanningErrorType.NETWORK_ERROR,
      handle: async (error) => {
        // Logique de gestion des erreurs réseau
        logger.info('[NetworkHandler] Handling network error', error);
        return false; // Permet le retry automatique
      },
      priority: 2,
    });
  }

  // Méthodes publiques
  getErrorHistory(): PlanningError[] {
    return [...this.errorHistory];
  }

  getErrorById(id: string): PlanningError | undefined {
    return this.errorHistory.find(error => error.id === id);
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryAttempts.clear();
  }

  getErrorMetrics(): Record<string, any> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(error => error.timestamp >= last24h);
    
    const errorsByType = recentErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
      resolvedErrors: recentErrors.filter(error => error.resolved).length,
      actionableErrors: recentErrors.filter(error => error.actionable).length,
    };
  }
}

// Instance singleton
export const planningErrorHandler = new PlanningErrorHandlerService();

// Export des fonctions utilitaires
export const handlePlanningError = (error: PlanningError | Error | string, context?: Record<string, any>) => {
  return planningErrorHandler.handleError(error, context);
};

export const createPlanningError = (
  type: PlanningErrorType,
  message: string,
  options?: Partial<PlanningError>
) => {
  return planningErrorHandler.createError(type, message, options);
};
