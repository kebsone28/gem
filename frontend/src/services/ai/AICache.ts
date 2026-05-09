/**
 * 🗄️ Système de Cache Intelligent pour l'IA
 * Cache les réponses fréquentes avec invalidation intelligente
 */

import type { AIResponse } from './MissionSageService';

interface CacheEntry {
  response: AIResponse;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  queryHash: string;
  contextHash: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

class AICache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 100;
  private ttl: number = 5 * 60 * 1000; // 5 minutes
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };

  constructor(options?: { maxSize?: number; ttl?: number }) {
    if (options?.maxSize) this.maxSize = options.maxSize;
    if (options?.ttl) this.ttl = options.ttl;
  }

  /**
   * Génère une clé de cache basée sur la requête et le contexte
   */
  private generateKey(query: string, context?: Record<string, unknown>): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const contextStr = context ? JSON.stringify(context) : '';
    return `${normalizedQuery}::${contextStr}`;
  }

  /**
   * Vérifie si une entrée est valide (non expirée)
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.ttl;
  }

  /**
   * Récupère une réponse du cache
   */
  get(query: string, context?: Record<string, unknown>): AIResponse | null {
    const key = this.generateKey(query, context);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateHitRate();
      return null;
    }

    // Mettre à jour les statistiques d'accès
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateHitRate();

    return entry.response;
  }

  /**
   * Stocke une réponse dans le cache
   */
  set(query: string, response: AIResponse, context?: Record<string, unknown>): void {
    const key = this.generateKey(query, context);

    // Éviction si le cache est plein (LRU - Least Recently Used)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      queryHash: key,
      contextHash: context ? JSON.stringify(context) : '',
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Éviction LRU - supprime l'entrée la moins récemment utilisée
   */
  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Invalide une entrée spécifique
   */
  invalidate(query: string, context?: Record<string, unknown>): void {
    const key = this.generateKey(query, context);
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Invalide tout le cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Invalide les entrées expirées
   */
  invalidateExpired(): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
        count++;
        this.stats.evictions++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Récupère les statistiques du cache
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Met à jour le taux de hit
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Précharge des réponses courantes
   */
  preload(commonQueries: Array<{ query: string; response: AIResponse; context?: Record<string, unknown> }>): void {
    for (const { query, response, context } of commonQueries) {
      this.set(query, response, context);
    }
  }
}

// Singleton export
let cacheInstance: AICache | null = null;

export function getAICache(options?: { maxSize?: number; ttl?: number }): AICache {
  if (!cacheInstance) {
    cacheInstance = new AICache(options);
  }
  return cacheInstance;
}

export function resetAICache(): void {
  cacheInstance = null;
}

export type { CacheStats, CacheEntry };
export { AICache };
