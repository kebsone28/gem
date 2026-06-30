import express from 'express';
import prisma from '../core/utils/prisma.js';
import logger from '../utils/logger.js';
import { config } from '../core/config/config.js';
import { redisConnection } from '../core/utils/queueManager.js';

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc System Health Check - Detailed
 * @access Public
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const healthcheck = {
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0-PRO',
    environment: config.env,
    services: {
      database: { status: 'unknown', latency: null },
      redis: { status: 'unknown', latency: null },
      queue: { status: 'unknown', pending: null },
      sync: { status: 'unknown', lastRun: null, queueLength: null },
    },
    memory: {
      usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      external: Math.round(process.memoryUsage().external / 1024 / 1024) + 'MB',
    },
    cpu: process.cpuUsage(),
  };

  let overallStatus = 'UP';

  // Test Database Connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    healthcheck.services.database = { status: 'UP', latency: `${dbLatency}ms` };
  } catch (error) {
    healthcheck.services.database = { status: 'DOWN', error: error.message };
    healthcheck.status = 'DEGRADED';
    overallStatus = 'DEGRADED';
    logger.error('Healthcheck DB failed:', error);
  }

  // Test Redis Connectivity
  try {
    if (redisConnection && config.redis.enabled) {
      const redisStart = Date.now();
      await redisConnection.ping();
      const redisLatency = Date.now() - redisStart;
      healthcheck.services.redis = { status: 'UP', latency: `${redisLatency}ms` };

      // Check BullMQ queues
      try {
        const { Queue } = await import('bullmq');
        const syncQueue = new Queue('sync', { connection: redisConnection });
        const pendingCount = await syncQueue.getWaitingCount();
        healthcheck.services.queue = { status: 'UP', pending: pendingCount };
        await syncQueue.close();
      } catch (queueError) {
        healthcheck.services.queue = { status: 'DOWN', error: queueError.message };
      }
    } else {
      healthcheck.services.redis = { status: 'DISABLED', latency: null };
      healthcheck.services.queue = { status: 'DISABLED', pending: null };
    }
  } catch (error) {
    healthcheck.services.redis = { status: 'DOWN', error: error.message };
    if (config.redis.enabled) {
      healthcheck.status = 'DEGRADED';
      overallStatus = 'DEGRADED';
    }
    logger.error('Healthcheck Redis failed:', error);
  }

  // Sync status (dernière synchronisation)
  try {
    const lastSync = await prisma.syncLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true, details: true },
    });
    if (lastSync) {
      const hoursSinceSync =
        (Date.now() - new Date(lastSync.createdAt).getTime()) / (1000 * 60 * 60);
      healthcheck.services.sync = {
        status: hoursSinceSync < 24 ? 'UP' : 'STALE',
        lastRun: lastSync.createdAt,
        lastAction: lastSync.action,
        hoursSinceSync: Math.round(hoursSinceSync * 10) / 10,
      };
      if (hoursSinceSync >= 24) {
        healthcheck.status = 'DEGRADED';
        overallStatus = 'DEGRADED';
      }
    } else {
      healthcheck.services.sync = { status: 'NO_DATA', lastRun: null };
    }
  } catch (error) {
    healthcheck.services.sync = { status: 'UNKNOWN', error: error.message };
  }

  // Overall status
  healthcheck.status = overallStatus;

  // HTTP status code
  const httpStatus = overallStatus === 'UP' ? 200 : 503;

  const totalLatency = Date.now() - startTime;
  healthcheck.responseTime = `${totalLatency}ms`;

  res.status(httpStatus).json(healthcheck);
});

/**
 * @route GET /api/v1/health/live
 * @desc Kubernetes Liveness Probe - Simple check
 * @access Public
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'ALIVE', timestamp: new Date().toISOString() });
});

/**
 * @route GET /api/v1/health/ready
 * @desc Kubernetes Readiness Probe - Full dependency check
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (config.redis.enabled && redisConnection) {
      await redisConnection.ping();
    }
    res.status(200).json({ status: 'READY', timestamp: new Date().toISOString() });
  } catch (error) {
    res
      .status(503)
      .json({ status: 'NOT_READY', error: error.message, timestamp: new Date().toISOString() });
  }
});

export default router;
