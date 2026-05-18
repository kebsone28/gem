/**
 * Permission & Configuration Caching Service
 * Reduces database queries by caching frequently accessed data
 */

import redis from '../core/utils/redis.js';
import logger from '../utils/logger.js';

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
