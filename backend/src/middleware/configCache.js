/**
 * Configuration Caching Middleware
 * Implements Redis-backed config caching
 * Reduces database queries for org settings
 */

import { cacheService } from '../services/cacheService.js';
import logger from '../utils/logger.js';

const CONFIG_CACHE_TTL = 3600; // 1 hour
const MODULE_CACHE_TTL = 1800; // 30 minutes

/**
 * Get organization config with caching
 */
export const getOrgConfigCached = async (orgId) => {
  const cacheKey = `config:org:${orgId}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      logger.debug('[CACHE] Org config hit', { orgId });
      return cached;
    }
  } catch (err) {
    logger.warn('[CACHE] Org config cache read failed:', err.message);
  }

  logger.debug('[CACHE] Org config miss', { orgId });
  // Cache miss - would fetch from database
  // For now, return default config
  const config = { featureFlags: {}, settings: {} };

  cacheService.set(cacheKey, config, CONFIG_CACHE_TTL).catch((err) => {
    logger.warn('[CACHE] Org config cache write failed:', err.message);
  });

  return config;
};

/**
 * Get module registry with caching
 */
export const getModuleRegistryCached = async (orgId) => {
  const cacheKey = `config:modules:${orgId}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      logger.debug('[CACHE] Module registry hit', { orgId });
      return cached;
    }
  } catch (err) {
    logger.warn('[CACHE] Module registry cache read failed:', err.message);
  }

  logger.debug('[CACHE] Module registry miss', { orgId });
  // Cache miss - would fetch from database
  // For now, return default modules
  const registry = { modules: [] };

  cacheService.set(cacheKey, registry, MODULE_CACHE_TTL).catch((err) => {
    logger.warn('[CACHE] Module registry cache write failed:', err.message);
  });

  return registry;
};

/**
 * Invalidate organization config cache
 * Called on config update
 */
export const invalidateOrgConfig = async (orgId) => {
  try {
    await cacheService.delete(`config:org:${orgId}`);
    await cacheService.delete(`config:modules:${orgId}`);
    logger.debug('[CACHE] Invalidated org config', { orgId });
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate org config:', err.message);
  }
};

/**
 * Express middleware for automatic config caching
 * Attaches cached config to request
 */
export const configCacheMiddleware = async (req, res, next) => {
  try {
    if (req.user && req.user.organizationId) {
      req.orgConfig = await getOrgConfigCached(req.user.organizationId);
      req.modules = await getModuleRegistryCached(req.user.organizationId);
      logger.debug('[CACHE] Config attached to request', {
        userId: req.user.id,
        orgId: req.user.organizationId,
      });
    }
    next();
  } catch (error) {
    logger.error('[CACHE] Failed to attach org config:', error);
    next(); // Continue anyway
  }
};
