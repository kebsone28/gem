import logger from '../utils/logger.js';
import { basePrisma } from '../core/utils/prisma.js';

/**
 * 404 Not Found
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/** Persist critical errors to DB for diagnostics (fire-and-forget safe) */
const persistSystemError = (err, req) => {
  const isDbError =
    err.message?.includes("Can't reach database server") ||
    err.code?.startsWith('P');
  if (isDbError) return;

  const status = err.statusCode || err.status || 500;
  if (status < 500) return;

  const { organizationId, userId, projectId } = req.user || {};
  try {
    basePrisma.systemError.create({
      data: {
        organizationId,
        userId,
        projectId,
        code: err.code || 'UNEXPECTED_ERROR',
        message: String(err.message || '').substring(0, 1000),
        stack: String(err.stack || '').substring(0, 5000),
        context: {
          url: req.originalUrl,
          method: req.method,
          userAgent: req.headers['user-agent']
        }
      }
    }).catch(() => {});
  } catch {
    // silently ignore persistence failures to avoid error loops
  }
};

/**
 * Centralized error handler
 */
export const errorHandler = (err, req, res, _next) => {
  const timestamp = new Date().toISOString();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.error(`[${requestId}] ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.email || 'anonymous',
    timestamp
  });

  persistSystemError(err, req);

  if (err.isJoi) {
    const messages = err.details.map(d => d.message).join('; ');
    return res.status(400).json({
      error: `Validation failed: ${messages}`,
      details: err.details.map(d => ({
        path: d.path.join('.'),
        message: d.message
      })),
      requestId
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service indisponible. Veuillez réessayer.',
      requestId
    });
  }

  if (err.code?.startsWith('23')) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ces données existent déjà', requestId });
    }
    return res.status(400).json({ error: 'Erreur de base de données', requestId });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Session invalide ou expirée', requestId });
  }

  if (err.message?.includes("Can't reach database server")) {
    return res.status(503).json({
      error: 'Le serveur ne parvient pas à contacter PostgreSQL.',
      code: 'DB_CONNECTION_ERROR',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: statusCode === 500 && !isDev ? 'Erreur serveur interne' : err.message || 'Erreur serveur',
    requestId,
    ...(isDev && { stack: err.stack })
  });
};

export default { notFoundHandler, errorHandler };
