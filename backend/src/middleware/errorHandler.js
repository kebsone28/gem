import logger from '../utils/logger.js';

/**
 * Middleware 404 Not Found
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware de gestion des erreurs centralisé
 */
export const errorHandler = (err, req, res) => {
  const timestamp = new Date().toISOString();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log l'erreur
  logger.error(`[${requestId}] Erreur: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.email || 'anonymous',
    timestamp
  });

  // Erreurs validations Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details.map(d => ({
        path: d.path.join('.'),
        message: d.message
      })),
      requestId
    });
  }

  // Erreurs de base de données
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error(`❌ Erreur DB: Impossible de se connecter`);
    return res.status(503).json({
      error: 'Service indisponible. Veuillez réessayer.',
      requestId
    });
  }

  // Erreurs PostgreSQL
  if (err.code && err.code.startsWith('23')) { // Unique violation, etc.
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Ces données existent déjà',
        requestId
      });
    }

    return res.status(400).json({
      error: 'Erreur de base de données',
      requestId
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token invalide',
      requestId
    });
  }

  // Erreur par défaut
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Erreur serveur interne';

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'development' ? message : 'Erreur serveur',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default { notFoundHandler, errorHandler };
