/**
 * Cache Invalidation Handler
 * Event-driven cache invalidation on data changes
 */

import { cacheService } from '../services/cacheService.js';
import { invalidateUserPermissions, invalidateOrgPermissions } from './permissionCache.js';
import { invalidateOrgConfig } from './configCache.js';
import logger from '../utils/logger.js';

/**
 * Master cache invalidation handler
 * Call after any database update that affects cached data
 */
export const invalidateCache = async (eventType, data = {}) => {
  try {
    switch (eventType) {
      // Permission changes
      case 'PERMISSION_GRANTED':
      case 'PERMISSION_REVOKED':
        await invalidateUserPermissions(data.userId, data.organizationId);
        logger.info('[CACHE] Invalidated permission', { eventType, ...data });
        break;

      case 'ROLE_UPDATED':
        await invalidateUserPermissions(data.userId, data.organizationId);
        logger.info('[CACHE] Invalidated role', { ...data });
        break;

      case 'ORG_SETTINGS_CHANGED':
        await invalidateOrgPermissions(data.organizationId);
        await invalidateOrgConfig(data.organizationId);
        logger.info('[CACHE] Invalidated org settings', { ...data });
        break;

      // Mission cache
      case 'MISSION_UPDATED':
      case 'MISSION_DELETED':
        await cacheService.deletePattern(`mission:${data.missionId}:*`);
        await cacheService.deletePattern(`org:${data.organizationId}:missions:*`);
        logger.info('[CACHE] Invalidated mission', { eventType, ...data });
        break;

      case 'MISSION_ASSIGNED':
        await cacheService.deletePattern(`mission:${data.missionId}:*`);
        await cacheService.deletePattern(`org:${data.organizationId}:missions:*`);
        await cacheService.deletePattern(`project:${data.projectId}:missions:*`);
        logger.info('[CACHE] Invalidated mission assignment', { ...data });
        break;

      // Project cache
      case 'PROJECT_UPDATED':
      case 'PROJECT_DELETED':
        await cacheService.deletePattern(`project:${data.projectId}:*`);
        await cacheService.deletePattern(`org:${data.organizationId}:projects:*`);
        logger.info('[CACHE] Invalidated project', { eventType, ...data });
        break;

      // User cache
      case 'USER_UPDATED':
        await cacheService.deletePattern(`user:${data.userId}:*`);
        if (data.organizationId) {
          await invalidateUserPermissions(data.userId, data.organizationId);
        }
        logger.info('[CACHE] Invalidated user', { ...data });
        break;

      // Config cache
      case 'CONFIG_UPDATED':
        await invalidateOrgConfig(data.organizationId);
        logger.info('[CACHE] Invalidated config', { ...data });
        break;

      // Household cache
      case 'HOUSEHOLD_UPDATED':
      case 'HOUSEHOLD_DELETED':
        await cacheService.deletePattern(`household:${data.householdId}:*`);
        await cacheService.deletePattern(`org:${data.organizationId}:households:*`);
        logger.info('[CACHE] Invalidated household', { eventType, ...data });
        break;

      default:
        logger.warn('[CACHE] Unknown event type:', eventType);
    }
  } catch (error) {
    logger.error('[CACHE] Invalidation failed:', { eventType, error: error.message });
    // Don't throw - cache invalidation should not break the request
  }
};

/**
 * Helper: Invalidate entire organization cache
 */
export const invalidateOrgCache = async (orgId) => {
  try {
    await invalidateOrgConfig(orgId);
    await invalidateOrgPermissions(orgId);
    await cacheService.deletePattern(`org:${orgId}:*`);
    logger.info('[CACHE] Invalidated entire org cache', { orgId });
  } catch (error) {
    logger.error('[CACHE] Failed to invalidate org cache:', error.message);
  }
};

/**
 * Helper: Invalidate all caches (dangerous - use sparingly)
 */
export const invalidateAllCaches = async () => {
  try {
    await cacheService.deletePattern('*');
    logger.warn('[CACHE] Invalidated ALL caches');
  } catch (error) {
    logger.error('[CACHE] Failed to invalidate all caches:', error.message);
  }
};
