/**
 * index.js — Express API entry point
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { pool } = require('./db');

const app = express();

// ====== Middleware ======
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api')) {
            console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
        }
    });
    next();
});

// ====== Auth Middleware (protect all /api routes except auth) ======
const { verifyToken } = require('./middleware/auth');

// ====== Routes ======
const authRoutes = require('./routes/auth');
const householdRoutes = require('./routes/households');
const projectRoutes = require('./routes/projects');
const teamRoutes = require('./routes/teams');
const deliveryRoutes = require('./routes/deliveries');
const syncRoutes = require('./routes/sync');

// Public routes
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            database: dbResult.rows[0].db,
            serverTime: dbResult.rows[0].time,
            version: '1.0.0'
        });
    } catch (err) {
        res.status(503).json({ status: 'error', error: err.message });
    }
});

// Protected routes
app.use('/api/households', verifyToken, householdRoutes);
app.use('/api/projects', verifyToken, projectRoutes);
app.use('/api/teams', verifyToken, teamRoutes);
app.use('/api/deliveries', verifyToken, deliveryRoutes);
app.use('/api/sync', verifyToken, syncRoutes);

// ====== Error Handler ======
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} introuvable` });
});

// ====== Start Server ======
app.listen(config.port, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════╗
║  Électrification API Server               ║
║  Port: ${config.port}                              ║
║  Env:  ${config.nodeEnv.padEnd(20)}         ║
║  DB:   ${config.db.host}:${config.db.port}/${config.db.database}  ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
