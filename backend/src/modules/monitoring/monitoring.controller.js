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
        console.error('Error fetching activity feed:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Get performance comparison (households validated per team)
// @route   GET /api/monitoring/performance
export const getPerformanceStats = async (req, res) => {
    try {
        const { organizationId } = req.user;

        // On agrège les ménages validés par teamId (User.role/specialty)
        const stats = await prisma.household.groupBy({
            by: ['status'],
            where: {
                // On pourrait filtrer par projet si nécessaire
            },
            _count: {
                id: true
            }
        });

        // Pour un dashboard "WOW", on va aussi chercher les validations par jour sur les 7 derniers jours
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dailyStats = await prisma.auditLog.findMany({
            where: {
                organizationId,
                action: 'VALIDATION_TERRAIN', // Supposons que c'est l'action de validation
                timestamp: { gte: sevenDaysAgo }
            },
            select: {
                timestamp: true,
                action: true
            }
        });

        res.json({ stats, dailyStats });
    } catch (error) {
        console.error('Error fetching performance stats:', error);
        res.status(500).json({ error: 'Server error' });
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
                redis: { status: 'DOWN', details: 'N/A' }
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
            version: '1.0.0-PRO'
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

        // Check Redis
        try {
            const ping = await redisConnection.ping();
            if (ping === 'PONG') {
                health.services.redis.status = 'UP';
                health.services.redis.details = 'BullMQ Queue Manager Ready';
            }
        } catch (redisError) {
            health.services.redis.details = redisError.message;
            health.status = 'DEGRADED';
        }

        res.json(health);
    } catch (error) {
        console.error('Critical Diagnostic Error:', error);
        res.status(500).json({
            error: 'Failed to generate diagnostic report',
            details: error.message,
            stack: error.stack
        });
    }
};
