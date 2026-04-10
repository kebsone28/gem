import express from 'express';
import prisma from '../core/utils/prisma.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc System Health Check
 * @access Public (or Admin only depending on security preference)
 */
router.get('/', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    services: {
        database: { status: 'unknown' },
        memory: { 
            usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
    }
  };

  try {
    // Test Database Connectivity
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.services.database.status = 'UP';
    
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    healthcheck.services.database.status = 'DOWN';
    logger.error('Healthcheck failed:', error);
    res.status(503).json(healthcheck);
  }
});

export default router;
