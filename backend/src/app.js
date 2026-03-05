import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './core/config/config.js';

const app = express();

// 1. Security Middlewares
app.use(helmet());
// Dynamic CORS origin resolver
const corsOriginResolver = (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = config.cors.origin;

    // Production: explicit whitelist only
    if (Array.isArray(allowedOrigins)) {
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked: ${origin}`));
    }

    // Development: allow any localhost or 127.0.0.1 port
    if (allowedOrigins === 'dev_dynamic') {
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocalhost) return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
    }

    callback(new Error('CORS: origin not configured'));
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

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/teams', teamRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        time: new Date(),
        version: '1.0.0-PRO'
    });
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
