/**
 * db.js — PostgreSQL connection pool
 */
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err.message);
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL client connected');
});

/**
 * Helper: run a query
 */
async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
        console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 80));
    }
    return res;
}

/**
 * Helper: get a single row
 */
async function queryOne(text, params) {
    const res = await query(text, params);
    return res.rows[0] || null;
}

module.exports = { pool, query, queryOne };
