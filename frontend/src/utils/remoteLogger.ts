/**
 * SERVICE : Remote Logger (Surveillance Proactive)
 */
import logger from './logger';

interface LogContext {
  [key: string]: unknown;
}

class RemoteLogger {
  private static instance: RemoteLogger;
  private readonly endpoint = '/api/logs/report';
  private readonly isEnabled = import.meta.env.PROD;

  private constructor() {}

  public static getInstance(): RemoteLogger {
    if (!RemoteLogger.instance) {
      RemoteLogger.instance = new RemoteLogger();
    }
    return RemoteLogger.instance;
  }

  /**
   * Envoie un log d'erreur au serveur
   */
  public async error(message: string, error: Error | unknown, context?: LogContext) {
    logger.error(`🔴 [REMOTE LOG] ${message}`, error, context);

    if (!this.isEnabled) return;

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message,
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            ...context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // Échec silencieux
    }
  }

  public warn(message: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      logger.warn(`🟠 [REMOTE LOG] ${message}`, context);
    }
  }
}

export const remoteLogger = RemoteLogger.getInstance();
