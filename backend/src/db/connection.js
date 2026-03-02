import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

/**
 * Pool de connexions PostgreSQL optimisé pour 200+ utilisateurs simultanés
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'proquelec',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'proquelec_saa',
  
  // Pool configuration
  min: parseInt(process.env.DB_POOL_MIN) || 4,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: 10000,
  
  // SSL (disabled for Docker local dev, enable for remote Wanekoo)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  // Application name for debugging
  application_name: 'proquelec-backend'
});

// Event listeners
pool.on('connect', () => {
  logger.debug('Nouvelle connexion établie');
});

pool.on('error', (err) => {
  logger.error(`Erreur pool inattendue: ${err.message}`, { err });
});

pool.on('remove', () => {
  logger.debug('Connexion retirée du pool');
});

/**
 * Test de connexion au démarrage
 */
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    logger.success(`✅ Connecté à PostgreSQL (${process.env.DB_HOST})`);
    return true;
  } catch (error) {
    logger.error(`❌ Impossible de se connecter à PostgreSQL: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Requête simple
 */
export const query = async (text, params = []) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    logger.error(`Erreur requête: ${error.message}`, { query: text, params });
    throw error;
  }
};

/**
 * Transaction
 */
export const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Erreur transaction: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fermeture du pool
 */
export const closePool = async () => {
  await pool.end();
  logger.info('Pool de connexions fermé');
};

export default { pool, testConnection, query, transaction, closePool };
