import 'express-async-errors';
import express from 'express';
import path from 'path';
import prisma from './core/utils/prisma.js';
import { redisConnection } from './core/utils/queueManager.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './core/config/config.js';
import { jsonBigIntReplacer } from './utils/commonUtils.js';
import sharedocRoutes from './modules/sharedoc/sharedoc.routes.js';
import { setupSwagger } from './core/config/swagger.js';

const app = express();

app.set('trust proxy', 1);
app.set('json replacer', jsonBigIntReplacer);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://puter.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://tiles.openfreemap.org", "https://kf.kobotoolbox.org"],
      connectSrc: ["'self'", "https://kf.kobotoolbox.org", "wss://*.proquelec.sn"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors(config.cors));

app.get('/api/ping', async (req, res) => {
  let dbStatus = 'waiting';
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 5000)
    );
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = `error: ${e.message}`;
  }
  res.json({ status: 'ok', msg: 'GED OS Core API is alive', db: dbStatus, version: '1.0.3-MANUAL-CORS' });
});

// 2. Request Parsing
// rawBody uniquement sur les routes webhook (signature HMAC KoboToolbox)
app.use(
  '/api/kobo/webhook',
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
// Parsing standard pour tout le reste
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 3. Rate Limiting global (désactivé en DEV pour éviter les faux positifs)
const isDev = config.env === 'development';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: () => isDev,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limiting spécifique pour l'authentification (prévention brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.', code: 'AUTH_RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 4. Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
}

// 5. SaaS Routes (Prisma/DDD)
import authRoutes from './api/routes/auth.routes.js';
import syncRoutes from './api/routes/sync.routes.js';
import projectRoutes from './api/routes/project.routes.js';
import projectTemplateRoutes from './api/routes/projectTemplate.routes.js';
import householdRoutes from './api/routes/household.routes.js';
import logisticsRoutes from './api/routes/logistics.routes.js';
import zoneRoutes from './api/routes/zone.routes.js';
import kpiRoutes from './api/routes/kpi.routes.js';
import teamRoutes from './api/routes/team.routes.js';
import simulationRoutes from './api/routes/simulation.routes.js';
import monitoringRoutes from './api/routes/monitoring.routes.js';
import geoRoutes from './api/routes/geo.routes.js';
import koboRoutes from './modules/kobo/kobo.routes.js';
import uploadRoutes from './api/routes/upload.routes.js';
import missionRoutes from './api/routes/mission.routes.js';
import userRoutes from './api/routes/user.routes.js';
import organizationRoutes from './api/routes/organization.routes.js';
import sizingRoutes from './modules/sizing/sizing.routes.js';
import assistantRoutes from './modules/assistant/assistant.router.js';
import approvalRoutes from './modules/assistant/approval.router.js';
import alertsRoutes from './modules/alerts/alerts.routes.js';
import formationRoutes from './modules/formation/formation.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import pvRoutes from './api/routes/pv.routes.js';
import toolboxRoutes from './modules/toolbox/toolbox.routes.js';
import toolboxHooksRoutes from './modules/toolbox/toolboxHooks.routes.js';
import gedcollectRoutes from './modules/gedcollect/gedcollect.routes.js';
import gedcollectAdminRoutes from './modules/gedcollect/gedcollect.admin.routes.js';
import debugRoutes from './api/routes/debug.routes.js';
import adminPermissionRoutes from './api/routes/admin.permissions.routes.js';
import mesRoutes from './api/routes/mes.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { tenantResolver } from './middleware/tenantResolver.js';
import { domainContext } from './middleware/domainContext.js';
import { paginationMiddleware } from './utils/paginationHelper.js';
import { requestTimingMiddleware } from './middleware/timing.js';
import systemRoutes from './api/routes/system.routes.js';

setupSwagger(app);

// Add global middleware for pagination and timing
app.use(paginationMiddleware);
app.use(requestTimingMiddleware);

app.use('/api/auth', authRoutes);
// Tenant resolver: always populate AsyncLocalStorage with org/project when available
app.use(tenantResolver);
// Domain context: inject domain adapter and config for multi-domain support
app.use(domainContext);
app.use('/api/users', userRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-templates', projectTemplateRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/kobo', koboRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/sizing', sizingRoutes);
app.use('/api/ai', assistantRoutes);
app.use('/api/formations', formationRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pvs', pvRoutes);
app.use('/api/toolbox', toolboxRoutes);
app.use('/api/toolbox', toolboxHooksRoutes);
app.use('/api/gedcollect', gedcollectRoutes);
app.use('/api/gedcollect-admin', gedcollectAdminRoutes);
app.use('/api/sharedoc', sharedocRoutes);
app.use('/api/mes', mesRoutes);
if (config.env !== 'production') {
  app.use('/api/debug', debugRoutes);
}
app.use('/api/admin', adminPermissionRoutes);
app.use('/api/system', systemRoutes);

app.get('/health', async (req, res) => {
  const health = {
    status: 'UP',
    services: {
      database: 'DOWN',
      redis: redisConnection ? 'DOWN' : 'N/A',
    },
    time: new Date(),
    version: '1.0.0-PRO',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'UP';
  } catch (e) {
    health.status = 'PARTIAL';
    health.services.database = {
      status: 'DOWN',
      ...(process.env.NODE_ENV !== 'production'
        ? { error: e.message, code: e.code, meta: e.meta }
        : { error: 'Vérification DB échouée' }),
    };
  }

  try {
    const ping = await redisConnection.ping();
    if (ping === 'PONG') health.services.redis = 'UP';
  } catch {
    health.status = 'PARTIAL';
  }

  const statusCode = health.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(health);
});

// 6. 404 handler (doit être après toutes les routes)
app.use(notFoundHandler);

// 7. Global Error Handler
app.use(errorHandler);

export default app;
