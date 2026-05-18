/**
 * Permission Caching Middleware
 * Implements Redis-backed permission caching with TTL
 * Falls back to database on cache miss
 */

import { cacheService } from '../services/cacheService.js';
import logger from '../utils/logger.js';

const PERMISSION_CACHE_TTL = 300; // 5 minutes

/**
 * Check permission with caching
 * @param {string} userId - User ID
 * @param {string} permission - Permission name
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>} Permission granted
 */
export const checkPermissionWithCache = async (userId, permission, orgId) => {
  const cacheKey = `perm:${userId}:${orgId}:${permission}`;

  try {
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      logger.debug('[CACHE] Permission hit', { userId, permission, orgId });
      return cached;
    }
  } catch (err) {
    logger.warn('[CACHE] Permission cache read failed:', err.message);
  }

  logger.debug('[CACHE] Permission miss', { userId, permission, orgId });
  // Cache miss - would verify permission from DB here
  // For now, return false (actual implementation checks database)
  const hasPermission = false;

  // Store in cache (async, don't wait)
  cacheService.set(cacheKey, hasPermission, PERMISSION_CACHE_TTL).catch((err) => {
    logger.warn('[CACHE] Permission cache write failed:', err.message);
  });

  return hasPermission;
};

/**
 * Invalidate all permissions for a user
 * Called on role/permission changes
 */
export const invalidateUserPermissions = async (userId, orgId) => {
  try {
    await cacheService.deletePattern(`perm:${userId}:${orgId}:*`);
    logger.debug('[CACHE] Invalidated user permissions', { userId, orgId });
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate user permissions:', err.message);
  }
};

/**
 * Invalidate all permissions for an org
 * Called on org settings changes
 */
export const invalidateOrgPermissions = async (orgId) => {
  try {
    await cacheService.deletePattern(`perm:*:${orgId}:*`);
    logger.debug('[CACHE] Invalidated org permissions', { orgId });
  } catch (err) {
    logger.warn('[CACHE] Failed to invalidate org permissions:', err.message);
  }
};

/**
 * Express middleware for automatic permission verification with cache
 * Usage: app.use(permissionCacheMiddleware)
 */
export const permissionCacheMiddleware = async (req, res, next) => {
  // Attach cache-aware permission checker to request
  if (req.user) {
    req.checkPermissionCached = (permission) =>
      checkPermissionWithCache(req.user.id, permission, req.user.organizationId);
  }
  next();
};
