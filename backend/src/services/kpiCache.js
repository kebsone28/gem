import logger from '../utils/logger.js';

/**
 * Service de cache pour KPI
 * TTL par défaut: 5 minutes (configurable via env)
 */
class KPICache {
  constructor(ttlSeconds = 300) {
    this.cache = new Map();
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Récupérer du cache
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const entry = this.cache.get(key);
    
    // Vérifier si expiré
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      logger.debug(`🔄 Cache expiré: ${key}`);
      return null;
    }

    logger.debug(`✅ Cache hit: ${key}`);
    return entry.data;
  }

  /**
   * Stocker dans le cache
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (this.ttlSeconds * 1000),
      createdAt: Date.now()
    });
    logger.debug(`💾 Cache stored: ${key} (TTL: ${this.ttlSeconds}s)`);
  }

  /**
   * Invalider un clé
   */
  invalidate(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      logger.info(`🗑️  Cache invalidated: ${key}`);
    }
  }

  /**
   * Vider tout le cache
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    logger.info(`🗑️  Cache cleared (${count} entries removed)`);
  }

  /**
   * Récupérer statistiques du cache
   */
  getStats() {
    const totalSize = this.cache.size;
    const validEntries = Array.from(this.cache.values())
      .filter(entry => entry.expiresAt > Date.now()).length;

    return {
      totalEntries: totalSize,
      validEntries,
      expiredEntries: totalSize - validEntries,
      cacheSize: `${(new TextEncoder().encode(JSON.stringify(this.cache)) / 1024).toFixed(2)}KB`
    };
  }
}

// Instance globale avec TTL du .env
const kpiCache = new KPICache(
  parseInt(process.env.KPI_CACHE_TTL_SECONDS) || 300
);

export default kpiCache;
