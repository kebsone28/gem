/**
 * Permission & Configuration Caching Service
 * Reduces database queries by caching frequently accessed data
 */

import { redisConnection } from '../core/utils/queueManager.js';
import logger from '../utils/logger.js';

// In-memory fallback when Redis is unavailable (dev/test environments)
const memoryCache = new Map();

// Safe Redis wrapper to handle disabled/offline Redis state gracefully without throwing
const redis = {
  get: async (key) => {
    if (redisConnection && typeof redisConnection.get === 'function') {
      try {
        return await redisConnection.get(key);
      } catch (e) {
        // Redis error, fall through to memory
      }
    }
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiry < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  },
  setex: async (key, ttl, value) => {
    memoryCache.set(key, { value, expiry: Date.now() + ttl * 1000 });
    if (redisConnection && typeof redisConnection.setex === 'function') {
      try {
        return await redisConnection.setex(key, ttl, value);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  del: async (...keys) => {
    for (const key of keys) {
      memoryCache.delete(key);
    }
    if (redisConnection && typeof redisConnection.del === 'function') {
      try {
        return await redisConnection.del(...keys);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  keys: async (pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const memoryKeys = Array.from(memoryCache.keys()).filter(k => regex.test(k));
    if (redisConnection && typeof redisConnection.keys === 'function') {
      try {
        const redisKeys = await redisConnection.keys(pattern);
        return [...new Set([...redisKeys, ...memoryKeys])];
      } catch (e) {
        return memoryKeys.length > 0 ? memoryKeys : [];
      }
    }
    return memoryKeys.length > 0 ? memoryKeys : [];
  }
};

const CACHE_TTL = {
  USER_PERMISSIONS: 5 * 60, // 5 minutes
  PROJECT_CONFIG: 10 * 60, // 10 minutes
  ORG_SETTINGS: 15 * 60, // 15 minutes
};

/**
 * Cache user permissions
 */
export const cacheUserPermissions = async (userId, organizationId, permissions) => {
  try {
    const key = `permissions:${organizationId}:${userId}`;
    await redis.setex(key, CACHE_TTL.USER_PERMISSIONS, JSON.stringify(permissions));
  } catch (err) {
    logger.warn('[CACHE] Failed to cache permissions:', err.message);
    // Don't throw - cache failures are non-critical
  }
};

/**
 * Get cached user permissions
 */
export const getCachedUserPermissions = async (userId, organizationId) => {
  try {
    const key = `permissions:${organizationId}:${userId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn('[CACHE] Failed to retrieve cached permissions:', err.message);
    return null; // Cache miss - return null to trigger DB query
  }
};

/**
 * Invalidate user permissions cache
 */
export const invalidateUserPermissions = async (userId, organizationId) => {
  try {
    const key = `permissions:${organizationId}:${userId}`;
    await redis.del(key);
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate permissions:', err.message);
  }
};

/**
 * Cache project configuration
 */
export const cacheProjectConfig = async (projectId, config) => {
  try {
    const key = `project:config:${projectId}`;
    await redis.setex(key, CACHE_TTL.PROJECT_CONFIG, JSON.stringify(config));
  } catch (err) {
    logger.warn('[CACHE] Failed to cache project config:', err.message);
  }
};

/**
 * Get cached project configuration
 */
export const getCachedProjectConfig = async (projectId) => {
  try {
    const key = `project:config:${projectId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn('[CACHE] Failed to retrieve project config:', err.message);
    return null;
  }
};

/**
 * Invalidate project configuration cache
 */
export const invalidateProjectConfig = async (projectId) => {
  try {
    const key = `project:config:${projectId}`;
    await redis.del(key);
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate project config:', err.message);
  }
};

/**
 * Cache organization settings
 */
export const cacheOrgSettings = async (organizationId, settings) => {
  try {
    const key = `org:settings:${organizationId}`;
    await redis.setex(key, CACHE_TTL.ORG_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    logger.warn('[CACHE] Failed to cache org settings:', err.message);
  }
};

/**
 * Get cached organization settings
 */
export const getCachedOrgSettings = async (organizationId) => {
  try {
    const key = `org:settings:${organizationId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn('[CACHE] Failed to retrieve org settings:', err.message);
    return null;
  }
};

/**
 * Invalidate organization settings cache
 */
export const invalidateOrgSettings = async (organizationId) => {
  try {
    const key = `org:settings:${organizationId}`;
    await redis.del(key);
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate org settings:', err.message);
  }
};

/**
 * Utility: Invalidate all user-related caches
 */
export const invalidateUserCache = async (userId, organizationId) => {
  await invalidateUserPermissions(userId, organizationId);
};

/**
 * Utility: Invalidate all project-related caches
 */
export const invalidateProjectCache = async (projectId) => {
  await invalidateProjectConfig(projectId);
};

/**
 * Utility: Invalidate entire organization cache (on org settings change)
 */
export const invalidateOrgCache = async (organizationId) => {
  await invalidateOrgSettings(organizationId);
  // Could also invalidate all users in org, but more complex
};

/**
 * Cache Service Object with stats tracking
 * Provides a unified interface for cache operations
 */
export const cacheService = {
  stats: { hits: 0, misses: 0, errors: 0 },

  /**
   * Get a value from cache
   */
  get: async (key) => {
    try {
      const value = await redis.get(key);
      if (value) {
        cacheService.stats.hits++;
      } else {
        cacheService.stats.misses++;
      }
      return value ? JSON.parse(value) : null;
    } catch (err) {
      cacheService.stats.errors++;
      logger.warn('[CACHE] Get error:', err.message);
      return null;
    }
  },

  /**
   * Set a value in cache with TTL
   */
  set: async (key, value, ttl = 3600) => {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      logger.warn('[CACHE] Set error:', err.message);
    }
  },

  /**
   * Delete a key from cache
   */
  delete: async (key) => {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn('[CACHE] Delete error:', err.message);
    }
  },

  /**
   * Delete all keys matching a pattern
   */
  deletePattern: async (pattern) => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn('[CACHE] DeletePattern error:', err.message);
    }
  },

  /**
   * Get cache statistics
   */
  getStats: () => ({
    hits: cacheService.stats.hits,
    misses: cacheService.stats.misses,
    errors: cacheService.stats.errors,
    hitRate: cacheService.stats.hits + cacheService.stats.misses > 0
      ? (cacheService.stats.hits / (cacheService.stats.hits + cacheService.stats.misses)).toFixed(4)
      : 0,
  }),

  /**
   * Clear all stats
   */
  clearStats: () => {
    cacheService.stats = { hits: 0, misses: 0, errors: 0 };
  },
};

