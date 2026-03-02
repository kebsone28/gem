/**
 * auth.js — Authentication routes
 * POST /api/auth/login
 * POST /api/auth/register (admin only)
 * GET  /api/auth/me
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../db');
const config = require('../config');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username et password requis' });
        }

        const user = await queryOne(
            'SELECT id, username, password_hash, display_name, role, is_active FROM users WHERE username = $1',
            [username]
        );

        if (!user) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Compte désactivé' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, displayName: user.display_name },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/register (admin only)
 * Body: { username, password, displayName, role }
 */
router.post('/register', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { username, password, displayName, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username et password requis' });
        }

        const validRoles = ['admin', 'supervisor', 'agent'];
        const userRole = validRoles.includes(role) ? role : 'agent';

        const hash = await bcrypt.hash(password, 10);
        const result = await queryOne(
            `INSERT INTO users (username, password_hash, display_name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, display_name, role`,
            [username, hash, displayName || username, userRole]
        );

        res.status(201).json(result);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username déjà utilisé' });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await queryOne(
            'SELECT id, username, display_name, role, is_active, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
