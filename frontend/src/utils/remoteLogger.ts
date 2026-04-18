/**
 * SERVICE : Remote Logger (Surveillance Proactive)
 */
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
  public async error(message: string, error: any, context?: any) {
    console.error(`🔴 [REMOTE LOG] ${message}`, error, context);

    if (!this.isEnabled) return;

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message,
          stack: error?.stack,
          context: {
            ...context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (err) {
      // Échec silencieux
    }
  }

  public warn(message: string, context?: any) {
    if (import.meta.env.DEV) {
      console.warn(`🟠 [REMOTE LOG] ${message}`, context);
    }
  }
}

export const remoteLogger = RemoteLogger.getInstance();
