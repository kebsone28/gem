const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function wipe() {
  try {
    console.log('Suppression de toutes les données...');
    await pool.query('TRUNCATE TABLE "Household" CASCADE;');
    await pool.query('TRUNCATE TABLE "Zone" CASCADE;');
    console.log('✅ Base de données Serveur (PostgreSQL) vidée avec succès !');
  } catch(e) {
    console.error('Erreur:', e);
  } finally {
    pool.end();
  }
}

wipe();
