import { getRecentActions } from '../../services/audit.service.js';
import prisma from '../../core/utils/prisma.js';
import { redisConnection } from '../../core/utils/queueManager.js';
import os from 'os';

// @desc    Get recent activity for the organization
// @route   GET /api/monitoring/activity
export const getActivityFeed = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'Identification organisation manquante' });
        
        const activities = await getRecentActions(organizationId, 1500); 
        res.json({ activities });
    } catch (error) {
        console.error('Error fetching activity feed:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// @desc    Get performance comparison 
// @route   GET /api/monitoring/performance
export const getPerformanceStats = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'Identification organisation manquante' });

        const stats = await prisma.household.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: { id: true }
        });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let dailyStats = [];
        let dailyYield = [0, 0, 0, 0, 0, 0, 0];
        try {
            const logs = await prisma.auditLog.findMany({
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
            dailyStats = logs;
            const now = new Date();
            logs.forEach(log => {
                const diffTime = Math.abs(now.getTime() - new Date(log.timestamp).getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays < 7) {
                    dailyYield[6 - diffDays]++;
                }
            });
        } catch (auditErr) {
            console.warn('[MONITORING] Impossible de lire auditLog:', auditErr.message);
        }

        res.json({ stats, dailyStats, dailyYield });
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

        try {
            await prisma.$queryRaw`SELECT 1`;
            health.services.database.status = 'UP';
            health.services.database.details = 'Prisma Client Connected';
        } catch (dbError) {
            health.services.database.details = dbError.message;
            health.status = 'DEGRADED';
        }

        if (redisConnection && typeof redisConnection.ping === 'function') {
            try {
                const pingPromise = redisConnection.ping();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 2000));
                const ping = await Promise.race([pingPromise, timeoutPromise]);
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
        res.status(500).json({ error: 'Failed to generate diagnostic report', details: error.message });
    }
};

// @desc    Get all system errors for diagnostics
// @route   GET /api/monitoring/system-errors
export const getSystemErrors = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const errors = await prisma.systemError.findMany({
            where: {
                OR: [
                    { organizationId },
                    { organizationId: null }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json({ errors });
    } catch (error) {
        console.error('Failed to fetch system errors:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Mark a system error as resolved
// @route   PATCH /api/monitoring/system-errors/:id/resolve
export const resolveSystemError = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        // 🛡️ [SECURITY sec_006] Scope resolution by organizationId
        await prisma.systemError.updateMany({
            where: { 
                id,
                OR: [
                    { organizationId },
                    { organizationId: null } // Allow resolving global errors if needed, but scoped is safer
                ]
            },
            data: { isResolved: true }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to resolve system error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Log a client-side error to the diagnostic system
// @route   POST /api/monitoring/client-errors
export const logClientError = async (req, res) => {
    try {
        let { message, stack, context } = req.body;
        const organizationId = req.user?.organizationId;
        // 🐛 [BUG bug_010] Use req.projectId instead of req.user.projectId
        const projectId = req.projectId || req.user?.projectId;
        const userId = req.user?.id;

        // Validation & Size limits
        if (!message) return res.status(400).json({ error: 'Message is required' });
        
        // Truncate fields to prevent DB bloat
        message = String(message).substring(0, 1000);
        stack = stack ? String(stack).substring(0, 5000) : null;
        
        // Sanitize context: whitelist keys or at least ensure it's a flat object with size limits
        const safeContext = {};
        if (context && typeof context === 'object') {
            Object.keys(context).forEach(key => {
                if (['componentStack', 'info', 'route', 'action'].includes(key)) {
                    safeContext[key] = String(context[key]).substring(0, 2000);
                }
            });
        }

        await prisma.systemError.create({
            data: {
                organizationId,
                projectId,
                userId,
                code: 'CLIENT_SIDE_ERROR',
                message,
                stack,
                context: {
                    ...safeContext,
                    url: (req.headers.referer || '').substring(0, 500),
                    userAgent: (req.headers['user-agent'] || '').substring(0, 500)
                }
            }
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Failed to log client error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
};
