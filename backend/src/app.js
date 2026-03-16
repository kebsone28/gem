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

// 1. Manual CORS & Preflight (Bulletproof for production)
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Validation de l'origine
    const allowedOrigins = Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin];
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    if (origin && isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
        // En cas de refus CORS clair, on peut ne pas mettre l'en-tête (bloquant net)
        // Mais pour débugger l'erreur 408/preflight, on log.
        // console.log(`CORS Blocked: ${origin}`);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

    // Handle pre-flight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

app.get('/api/ping', async (req, res) => {
    let dbStatus = 'waiting';
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000));
        await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
        dbStatus = 'connected';
    } catch (e) {
        dbStatus = `error: ${e.message}`;
    }
    res.json({ status: 'ok', msg: 'Core API is alive', db: dbStatus, version: '1.0.3-MANUAL-CORS' });
});

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
import geoRoutes from './api/routes/geo.routes.js';
import koboRoutes from './modules/kobo/kobo.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/kobo', koboRoutes);

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

// 6. Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 GLOBAL ERROR:', err.stack);
    
    // Specific handling for DB errors in the global handler
    if (err.message?.includes("Can't reach database server")) {
        return res.status(503).json({
            error: 'Database Connection Error',
            message: 'Le serveur ne parvient pas à contacter PostgreSQL. Vérifiez Docker Desktop.',
            code: 'DB_CONNECTION_ERROR'
        });
    }

    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

export default app;
