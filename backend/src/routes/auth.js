import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, transaction } from '../db/connection.js';
import logger from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

/**
 * POST /api/auth/login
 * Authentifier un utilisateur et retourner les tokens
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Récupérer l'utilisateur avec son rôle
    const result = await query(`
      SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, 
             u.status, u.locked_until, u.login_attempts,
             r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER($1)
    `, [email]);

    if (result.rows.length === 0) {
      logger.warn(`❌ Tentative de connexion échouée: email non trouvé (${email})`);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = result.rows[0];

    // Vérifier si l'utilisateur est actif
    if (user.status !== 'active') {
      logger.warn(`🚫 Utilisateur inactif: ${email} (${user.status})`);
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    // Vérifier si le compte est verrouillé
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      logger.warn(`🔒 Compte verrouillé: ${email}`);
      return res.status(401).json({ error: 'Compte temporairement verrouillé' });
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Incrémenter les tentatives échouées
      const newAttempts = (user.login_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;

      await query(
        `UPDATE users SET login_attempts = $1 ${shouldLock ? ', locked_until = NOW() + INTERVAL \'15 minutes\'' : ''} WHERE id = $2`,
        [newAttempts, user.id]
      );

      logger.warn(`❌ Mot de passe invalide: ${email} (tentative ${newAttempts})`);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Login réussi - réinitialiser les tentatives
    await query(
      `UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    // Générer les tokens
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRATION }
    );

    // Stocker le refresh token dans la DB
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)`,
      [
        user.id,
        refreshTokenHash,
        req.headers['user-agent'],
        req.ip
      ]
    );

    logger.success(`✅ Login réussi: ${email} (${user.role})`);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Renouveler le refresh token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis' });
    }

    // Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (error) {
      logger.warn(`❌ Refresh token invalide`);
      return res.status(401).json({ error: 'Refresh token invalide' });
    }

    // Vérifier que le token existe en DB et n'est pas révoqué
    const refreshTokenHash = require('crypto')
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const result = await query(
      `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
      [decoded.id, refreshTokenHash]
    );

    if (result.rows.length === 0) {
      logger.warn(`❌ Refresh token non trouvé ou expiré`);
      return res.status(401).json({ error: 'Session expirée' });
    }

    // Récupérer l'utilisateur
    const userResult = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const user = userResult.rows[0];

    // Générer nouveau access token
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    logger.success(`✅ Token rafraîchi: ${user.email}`);

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Révoquer le refresh token
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const refreshTokenHash = require('crypto')
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), revoked_by = $1 WHERE token_hash = $2`,
        [req.user.id, refreshTokenHash]
      );
    }

    logger.success(`✅ Logout: ${req.user.email}`);

    res.json({ message: 'Déconnecté avec succès' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Récupérer l'utilisateur courant
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
