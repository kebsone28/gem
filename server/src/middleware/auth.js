/**
 * auth.js — JWT authentication middleware
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Middleware: verify JWT token from Authorization header
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalide ou expiré' });
    }
}

/**
 * Middleware: require specific role(s)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Rôle insuffisant' });
        }
        next();
    };
}

module.exports = { verifyToken, requireRole };
