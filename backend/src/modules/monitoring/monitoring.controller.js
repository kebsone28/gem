import { getRecentActions } from '../../services/audit.service.js';
import prisma from '../../core/utils/prisma.js';
import { redisConnection } from '../../core/utils/queueManager.js';
import os from 'os';

// @desc    Get recent activity for the organization
// @route   GET /api/monitoring/activity
export const getActivityFeed = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const activities = await getRecentActions(organizationId, 15);
        res.json({ activities });
    } catch (error) {
        console.error('Error fetching activity feed:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// @desc    Get performance comparison (households validated per team)
// @route   GET /api/monitoring/performance
export const getPerformanceStats = async (req, res) => {
    try {
        const { organizationId } = req.user;

        // Agrégation des ménages par statut pour cette organisation
        const stats = await prisma.household.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: { id: true }
        });

        // Validations par jour sur les 7 derniers jours
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let dailyStats = [];
        try {
            dailyStats = await prisma.auditLog.findMany({
                where: {
                    organizationId,
                    timestamp: { gte: sevenDaysAgo }
                },
                select: {
                    timestamp: true,
                    action: true
                },
                take: 200,
                orderBy: { timestamp: 'desc' }
            });
        } catch (auditErr) {
            // auditLog may not be available – not critical
            console.warn('[MONITORING] Impossible de lire auditLog:', auditErr.message);
        }

        res.json({ stats, dailyStats });
    } catch (error) {
        console.error('Error fetching performance stats:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// @desc    Get real-time system health and resource usage
// @route   GET /api/monitoring/system-health
export const getSystemHealth = async (req, res) => {
    try {
        const health = {
            status: 'UP',
            timestamp: new Date(),
            services: {
                database: { status: 'DOWN', details: 'N/A' },
                redis: { status: 'N/A', details: 'Non configuré en local' }
            },
            system: {
                uptime: os.uptime(),
                memory: {
                    free: os.freemem(),
                    total: os.totalmem(),
                    usage: os.totalmem() > 0 ? ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2) + '%' : '0%'
                },
                load: os.loadavg(),
                platform: os.platform()
            },
            version: '3.9.0-ENT'
        };

        // Check Database
        try {
            await prisma.$queryRaw`SELECT 1`;
            health.services.database.status = 'UP';
            health.services.database.details = 'Prisma Client Connected';
        } catch (dbError) {
            health.services.database.details = dbError.message;
            health.status = 'DEGRADED';
        }

        // Check Redis (optional – may be null in dev)
        if (redisConnection) {
            try {
                const ping = await redisConnection.ping();
                if (ping === 'PONG') {
                    health.services.redis.status = 'UP';
                    health.services.redis.details = 'BullMQ Queue Manager Ready';
                }
            } catch (redisError) {
                health.services.redis.status = 'DOWN';
                health.services.redis.details = redisError.message;
            }
        }

        res.json(health);
    } catch (error) {
        console.error('Critical Diagnostic Error:', error);
        res.status(500).json({
            error: 'Failed to generate diagnostic report',
            details: error.message
        });
    }
};
