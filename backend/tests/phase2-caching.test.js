/**
 * Phase 2: Caching Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cacheService } from '../src/services/cacheService.js';
import {
  checkPermissionWithCache,
  invalidateUserPermissions,
} from '../src/middleware/permissionCache.js';
import {
  getOrgConfigCached,
  invalidateOrgConfig,
} from '../src/middleware/configCache.js';
import {
  invalidateCache,
  invalidateOrgCache,
} from '../src/middleware/cacheInvalidation.js';

describe('Phase 2: Caching', () => {

  beforeEach(() => {
    // Clear stats before each test
    cacheService.clearStats();
  });

  // ========================
  // CACHE SERVICE TESTS
  // ========================

  describe('Cache Service', () => {
    it('should set and get values', async () => {
      await cacheService.set('test:key', { data: 'value' }, 3600);
      const result = await cacheService.get('test:key');

      expect(result).toEqual({ data: 'value' });
    });

    it('should delete values', async () => {
      await cacheService.set('test:key', 'value', 3600);
      await cacheService.delete('test:key');
      const result = await cacheService.get('test:key');

      expect(result).toBeNull();
    });

    it('should delete by pattern', async () => {
      await cacheService.set('perm:user1:org1:read', true, 3600);
      await cacheService.set('perm:user1:org1:write', true, 3600);
      await cacheService.set('perm:user2:org1:read', true, 3600);

      await cacheService.deletePattern('perm:user1:org1:*');

      const result1 = await cacheService.get('perm:user1:org1:read');
      const result2 = await cacheService.get('perm:user2:org1:read');

      expect(result1).toBeNull();
      expect(result2).toBeDefined();
    });

    it('should track hits and misses', async () => {
      await cacheService.set('key1', 'value1', 3600);

      // Hit
      await cacheService.get('key1');
      expect(cacheService.stats.hits).toBe(1);

      // Miss
      await cacheService.get('nonexistent');
      expect(cacheService.stats.misses).toBe(1);
    });

    it('should calculate hit rate', async () => {
      cacheService.stats.hits = 8;
      cacheService.stats.misses = 2;

      const stats = cacheService.getStats();
      expect(parseFloat(stats.hitRate)).toBe(0.8);
    });
  });

  // ========================
  // PERMISSION CACHING TESTS
  // ========================

  describe('Permission Caching', () => {
    it('should cache permission checks', async () => {
      const userId = 'user-1';
      const permission = 'READ_MISSION';
      const orgId = 'org-1';

      // First call - cache miss
      const result1 = await checkPermissionWithCache(userId, permission, orgId);
      const missBefore = cacheService.stats.misses;

      // Second call - cache hit
      const result2 = await checkPermissionWithCache(userId, permission, orgId);
      const missAfter = cacheService.stats.misses;

      // Should have one more miss (first call)
      expect(missAfter).toBe(missBefore);
      expect(result1).toBe(result2);
    });

    it('should invalidate user permissions', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';

      // Cache a permission
      await cacheService.set(`perm:${userId}:${orgId}:read`, true, 3600);
      let result = await cacheService.get(`perm:${userId}:${orgId}:read`);
      expect(result).toBe(true);

      // Invalidate
      await invalidateUserPermissions(userId, orgId);

      // Should be cleared
      result = await cacheService.get(`perm:${userId}:${orgId}:read`);
      expect(result).toBeNull();
    });

    it('should handle cache failures gracefully', async () => {
      // Mock cache failure
      const originalGet = cacheService.get;
      cacheService.get = vi.fn().mockRejectedValueOnce(new Error('Cache unavailable'));

      // Should still return a value (from DB)
      const result = await checkPermissionWithCache('user-1', 'READ', 'org-1');
      expect(typeof result).toBe('boolean');

      // Restore
      cacheService.get = originalGet;
    });
  });

  // ========================
  // CONFIG CACHING TESTS
  // ========================

  describe('Config Caching', () => {
    it('should cache org config', async () => {
      const orgId = 'org-1';

      // First call - cache miss
      const config1 = await getOrgConfigCached(orgId);
      const misses1 = cacheService.stats.misses;

      // Second call - cache hit
      const config2 = await getOrgConfigCached(orgId);
      const misses2 = cacheService.stats.misses;

      expect(config1).toEqual(config2);
      expect(misses2).toBeLessThan(misses1 + 1); // Hit, not miss
    });

    it('should invalidate org config', async () => {
      const orgId = 'org-1';

      // Cache config
      await cacheService.set(`config:org:${orgId}`, { setting: 'value' }, 3600);
      let result = await cacheService.get(`config:org:${orgId}`);
      expect(result).toBeDefined();

      // Invalidate
      await invalidateOrgConfig(orgId);

      // Should be cleared
      result = await cacheService.get(`config:org:${orgId}`);
      expect(result).toBeNull();
    });
  });

  // ========================
  // CACHE INVALIDATION TESTS
  // ========================

  describe('Cache Invalidation Strategy', () => {
    it('should invalidate mission on update', async () => {
      const missionId = 'mission-1';
      const orgId = 'org-1';

      await cacheService.set(`mission:${missionId}:*`, 'data', 3600);

      await invalidateCache('MISSION_UPDATED', {
        missionId,
        organizationId: orgId,
      });

      const result = await cacheService.get(`mission:${missionId}:*`);
      expect(result).toBeNull();
    });

    it('should invalidate on permission change', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';

      await cacheService.set(`perm:${userId}:${orgId}:read`, true, 3600);

      await invalidateCache('PERMISSION_GRANTED', {
        userId,
        organizationId: orgId,
      });

      const result = await cacheService.get(`perm:${userId}:${orgId}:read`);
      expect(result).toBeNull();
    });

    it('should invalidate org cache', async () => {
      const orgId = 'org-1';

      await cacheService.set(`org:${orgId}:key`, 'value', 3600);
      await cacheService.set(`perm:user:${orgId}:read`, true, 3600);
      await cacheService.set(`config:org:${orgId}`, {}, 3600);

      await invalidateOrgCache(orgId);

      expect(await cacheService.get(`org:${orgId}:key`)).toBeNull();
      expect(await cacheService.get(`perm:user:${orgId}:read`)).toBeNull();
      expect(await cacheService.get(`config:org:${orgId}`)).toBeNull();
    });
  });

});
