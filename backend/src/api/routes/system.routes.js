/**
 * System monitoring endpoints
 * Health checks, metrics, cache stats, slow queries
 */

import { Router } from 'express';
import { cacheService } from '../services/cacheService.js';
import { getSlowQueries } from '../middleware/timing.js';
import { authProtect, authorize } from './middlewares/auth.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Health check endpoint (public)
 * GET /api/system/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// All routes below require authentication and admin permission
router.use(authProtect);
router.use(authorize('ADMIN_PROQUELEC')); // Admin only

/**
 * Performance metrics
 * GET /api/system/metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const memory = process.memoryUsage();
    const cacheStats = cacheService?.getStats?.();

    res.json({
      uptime: process.uptime(),
      memory: {
        rss: (memory.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        external: (memory.external / 1024 / 1024).toFixed(2) + ' MB',
      },
      cache: cacheStats || { hits: 0, misses: 0, errors: 0 },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[METRICS] Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * Cache statistics
 * GET /api/system/cache-stats
 */
router.get('/cache-stats', (req, res) => {
  try {
    const stats = cacheService?.getStats?.() || { hits: 0, misses: 0, errors: 0 };
    const total = stats.hits + stats.misses;

    res.json({
      hits: stats.hits,
      misses: stats.misses,
      errors: stats.errors,
      hitRate: total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      totalRequests: total,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[CACHE_STATS] Error fetching cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

/**
 * Slow queries
 * GET /api/system/slow-queries?limit=50
 */
router.get('/slow-queries', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const slowQueries = getSlowQueries(limit);

    res.json({
      count: slowQueries.length,
      threshold: 1000,
      queries: slowQueries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[SLOW_QUERIES] Error fetching slow queries:', error);
    res.status(500).json({ error: 'Failed to fetch slow queries' });
  }
});

export default router;
