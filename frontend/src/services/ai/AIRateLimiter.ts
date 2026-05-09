/**
 * ⏱️ Rate Limiter pour l'IA
 * Protège contre les abus et les surcharges
 */

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstAllowance: number; // Requêtes supplémentaires en rafale
}

interface UserBucket {
  requests: number[]; // Timestamps des requêtes
  burstUsed: number;
  lastReset: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter: number;
  limitType: 'minute' | 'hour' | 'day' | 'burst' | null;
}

class AIRateLimiter {
  private config: RateLimitConfig;
  private buckets: Map<string, UserBucket> = new Map();
  private cleanupInterval: number = 60 * 1000; // 1 minute
  private lastCleanup: number = Date.now();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      maxRequestsPerDay: 500,
      burstAllowance: 5,
      ...config,
    };
  }

  /**
   * Vérifie si une requête est autorisée
   */
  checkLimit(userId: string): RateLimitResult {
    this.cleanupIfNeeded();

    const now = Date.now();
    const bucket = this.getBucket(userId);

    // Nettoyer les requêtes expirées
    this.cleanBucket(bucket, now);

    // Vérifier les limites
    const minuteCount = this.countRequestsInWindow(bucket, now, 60 * 1000);
    const hourCount = this.countRequestsInWindow(bucket, now, 60 * 60 * 1000);
    const dayCount = this.countRequestsInWindow(bucket, now, 24 * 60 * 60 * 1000);

    // Vérifier la limite par minute
    if (minuteCount >= this.config.maxRequestsPerMinute) {
      const oldestInMinute = this.getOldestRequestInWindow(bucket, now, 60 * 1000);
      const retryAfter = oldestInMinute ? oldestInMinute + 60 * 1000 - now : 60000;

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: now + retryAfter,
        retryAfter: Math.max(0, retryAfter),
        limitType: 'minute',
      };
    }

    // Vérifier la limite par heure
    if (hourCount >= this.config.maxRequestsPerHour) {
      const oldestInHour = this.getOldestRequestInWindow(bucket, now, 60 * 60 * 1000);
      const retryAfter = oldestInHour ? oldestInHour + 60 * 60 * 1000 - now : 3600000;

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: now + retryAfter,
        retryAfter: Math.max(0, retryAfter),
        limitType: 'hour',
      };
    }

    // Vérifier la limite par jour
    if (dayCount >= this.config.maxRequestsPerDay) {
      const oldestInDay = this.getOldestRequestInWindow(bucket, now, 24 * 60 * 60 * 1000);
      const retryAfter = oldestInDay ? oldestInDay + 24 * 60 * 60 * 1000 - now : 86400000;

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: now + retryAfter,
        retryAfter: Math.max(0, retryAfter),
        limitType: 'day',
      };
    }

    // Calculer les requêtes restantes
    const remainingMinute = this.config.maxRequestsPerMinute - minuteCount;
    const remainingHour = this.config.maxRequestsPerHour - hourCount;
    const remainingDay = this.config.maxRequestsPerDay - dayCount;

    return {
      allowed: true,
      remainingRequests: Math.min(remainingMinute, remainingHour, remainingDay),
      resetTime: now + 60 * 1000,
      retryAfter: 0,
      limitType: null,
    };
  }

  /**
   * Enregistre une requête
   */
  recordRequest(userId: string): void {
    const bucket = this.getBucket(userId);
    bucket.requests.push(Date.now());
  }

  /**
   * Vérifie et enregistre en une seule opération
   */
  checkAndRecord(userId: string): RateLimitResult {
    const result = this.checkLimit(userId);
    if (result.allowed) {
      this.recordRequest(userId);
    }
    return result;
  }

  /**
   * Récupère ou crée un bucket utilisateur
   */
  private getBucket(userId: string): UserBucket {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = {
        requests: [],
        burstUsed: 0,
        lastReset: Date.now(),
      };
      this.buckets.set(userId, bucket);
    }
    return bucket;
  }

  /**
   * Nettoie les requêtes expirées d'un bucket
   */
  private cleanBucket(bucket: UserBucket, now: number): void {
    const dayAgo = now - 24 * 60 * 60 * 1000;
    bucket.requests = bucket.requests.filter((timestamp) => timestamp > dayAgo);
  }

  /**
   * Compte les requêtes dans une fenêtre temporelle
   */
  private countRequestsInWindow(bucket: UserBucket, now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return bucket.requests.filter((timestamp) => timestamp > cutoff).length;
  }

  /**
   * Récupère la plus ancienne requête dans une fenêtre
   */
  private getOldestRequestInWindow(bucket: UserBucket, now: number, windowMs: number): number | null {
    const cutoff = now - windowMs;
    const requestsInWindow = bucket.requests.filter((timestamp) => timestamp > cutoff);
    return requestsInWindow.length > 0 ? Math.min(...requestsInWindow) : null;
  }

  /**
   * Nettoie les buckets inactifs périodiquement
   */
  private cleanupIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      const dayAgo = now - 24 * 60 * 60 * 1000;
      for (const [userId, bucket] of this.buckets.entries()) {
        if (bucket.requests.length === 0 || bucket.requests[bucket.requests.length - 1] < dayAgo) {
          this.buckets.delete(userId);
        }
      }
      this.lastCleanup = now;
    }
  }

  /**
   * Récupère les statistiques d'un utilisateur
   */
  getStats(userId: string): {
    totalRequests: number;
    requestsLastMinute: number;
    requestsLastHour: number;
    requestsLastDay: number;
  } {
    const now = Date.now();
    const bucket = this.getBucket(userId);
    this.cleanBucket(bucket, now);

    return {
      totalRequests: bucket.requests.length,
      requestsLastMinute: this.countRequestsInWindow(bucket, now, 60 * 1000),
      requestsLastHour: this.countRequestsInWindow(bucket, now, 60 * 60 * 1000),
      requestsLastDay: this.countRequestsInWindow(bucket, now, 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Réinitialise un utilisateur
   */
  reset(userId: string): void {
    this.buckets.delete(userId);
  }
}

// Singleton export
let rateLimiterInstance: AIRateLimiter | null = null;

export function getAIRateLimiter(config?: Partial<RateLimitConfig>): AIRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new AIRateLimiter(config);
  }
  return rateLimiterInstance;
}

export function resetAIRateLimiter(): void {
  rateLimiterInstance = null;
}

export type { RateLimitResult, RateLimitConfig };
export { AIRateLimiter };
