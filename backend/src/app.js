import express from 'express';
import prisma from './core/utils/prisma.js';
import { redisConnection } from './core/utils/queueManager.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './core/config/config.js';

const app = express();

app.get('/api/ping', async (req, res) => {
    let dbStatus = 'waiting';
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000));
        await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
        dbStatus = 'connected';
    } catch (e) {
        dbStatus = `error: ${e.message}`;
    }
    res.json({ status: 'ok', msg: 'Core API is alive', db: dbStatus });
});

// 1. Security Middlewares
app.use(helmet());
// Dynamic CORS origin resolver
const corsOriginResolver = (origin, callback) => {
    // 1. Allow non-browser requests
    if (!origin) return callback(null, true);

    const allowed = config.cors.origin;
    console.log(`🔍 CORS Check: Request from [${origin}], Allowed: [${allowed}]`);

    // 2. Ultra-permissive mode
    if (allowed === '*' || allowed === 'dev_dynamic') {
        return callback(null, true);
    }

    // 3. Explicit check
    if (Array.isArray(allowed)) {
        if (allowed.includes(origin) || allowed.includes('*')) {
            return callback(null, true);
        }
    }

    // 4. Default to allow but log if it's not in our list (helpful for debug)
    console.warn(`⚠️ CORS Unknown origin: ${origin} - Allowing anyway for debug`);
    callback(null, true);
};

app.use(cors({
    origin: corsOriginResolver,
    credentials: true
}));

// 2. Request Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// 3. Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // Increased for testing and map tile heavy sessions
});
app.use('/api/', limiter);

// 4. Logging
if (config.env === 'development') {
    app.use(morgan('dev'));
}

// 5. SaaS Routes (Prisma/DDD)
import authRoutes from './api/routes/auth.routes.js';
import syncRoutes from './api/routes/sync.routes.js';
import projectRoutes from './api/routes/project.routes.js';
import householdRoutes from './api/routes/household.routes.js';
import zoneRoutes from './api/routes/zone.routes.js';
import kpiRoutes from './api/routes/kpi.routes.js';
import teamRoutes from './api/routes/team.routes.js';
import simulationRoutes from './api/routes/simulation.routes.js';
import monitoringRoutes from './api/routes/monitoring.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.get('/health', async (req, res) => {
    const health = {
        status: 'UP',
        services: {
            database: 'DOWN',
            redis: 'DOWN'
        },
        time: new Date(),
        version: '1.0.0-PRO'
    };

    try {
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'UP';
    } catch (e) {
        health.status = 'PARTIAL';
        health.services.database = {
            status: 'DOWN',
            error: e.message,
            code: e.code,
            meta: e.meta
        };
    }

    try {
        const ping = await redisConnection.ping();
        if (ping === 'PONG') health.services.redis = 'UP';
    } catch (e) {
        health.status = 'PARTIAL';
    }

    const statusCode = health.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(health);
});

// 6. Global Error Handler (Coming soon)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config.env === 'development' ? err.message : undefined
    });
});

export default app;
