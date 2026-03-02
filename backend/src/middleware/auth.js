import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Middleware d'authentification JWT
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn(`❌ Token invalide: ${error.message}`);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré' });
      }
      
      return res.status(401).json({ error: 'Token invalide' });
    }
  } catch (error) {
    logger.error(`Erreur authentification: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Middleware d'autorisation par rôle
 */
export const authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (requiredRoles.length && !requiredRoles.includes(req.user.role)) {
      logger.warn(`🚫 Accès refusé: ${req.user.email} (${req.user.role}) tentait d'accéder à ${req.path}`);
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};

/**
 * Middleware d'authentification optionnelle (pour stats publiques)
 */
export const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
      } catch (error) {
        // Token invalide mais on continue (stats publiques)
        req.user = null;
      }
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur authentification optionnelle: ${error.message}`);
    next();
  }
};

export default { authenticate, authorize, optionalAuthenticate };
