/**
 * Import carto_grappes reference data from JSON files to PostgreSQL
 * 
 * Creates tables for villages, menages, gps, prestataires
 * and imports data from frontend/public/archive/Liste/*.json
 * 
 * Usage:
 *   node import_carto_data.js
 */

import { basePrisma as prisma } from './src/core/utils/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../frontend/public/archive/Liste');

async function createTables() {
  console.log('🔧 Creating reference data tables...');
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carto_villages (
      id SERIAL PRIMARY KEY,
      region TEXT NOT NULL,
      village TEXT NOT NULL,
      n INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      defaultGrappe INTEGER,
      x REAL,
      y REAL,
      UNIQUE(region, village)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carto_menages (
      id SERIAL PRIMARY KEY,
      ordre INTEGER NOT NULL UNIQUE,
      nom TEXT NOT NULL,
      tel TEXT,
      village TEXT NOT NULL,
      commune TEXT,
      region TEXT NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carto_gps (
      id SERIAL PRIMARY KEY,
      ordre INTEGER NOT NULL UNIQUE,
      lat REAL,
      lon REAL,
      accuracy REAL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carto_prestataires (
      id SERIAL PRIMARY KEY,
      lot TEXT NOT NULL,
      nom TEXT NOT NULL,
      telephone TEXT,
      email TEXT,
      region TEXT,
      UNIQUE(lot, nom)
    );
  `);

  console.log('✅ Tables created');
}

async function importVillages() {
  console.log('📍 Importing villages...');
  const filePath = path.join(DATA_DIR, 'villages.json');
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const data = JSON.parse(content);
  
  let count = 0;
  for (const v of data) {
    try {
      await prisma.$executeRaw`
        INSERT INTO carto_villages (region, village, n, lat, lon, defaultGrappe, x, y)
        VALUES (${v.region}, ${v.village}, ${v.n}, ${v.lat}, ${v.lon}, ${v.defaultGrappe}, ${v.x}, ${v.y})
        ON CONFLICT (region, village) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.error(`Error importing village ${v.village}:`, e.message);
    }
  }
  
  console.log(`✅ Imported ${count} villages`);
}

async function importMenages() {
  console.log('👨‍👩‍👧‍👦 Importing ménages...');
  const filePath = path.join(DATA_DIR, 'menages.json');
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const data = JSON.parse(content);
  
  let count = 0;
  for (const m of data) {
    try {
      await prisma.$executeRaw`
        INSERT INTO carto_menages (ordre, nom, tel, village, commune, region)
        VALUES (${m.ordre}, ${m.nom}, ${m.tel}, ${m.village}, ${m.commune}, ${m.region})
        ON CONFLICT (ordre) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.error(`Error importing ménage ${m.ordre}:`, e.message);
    }
  }
  
  console.log(`✅ Imported ${count} ménages`);
}

async function importGps() {
  console.log('📡 Importing GPS data...');
  const filePath = path.join(DATA_DIR, 'gps.json');
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const data = JSON.parse(content);
  
  // GPS data is structured as { "ordre": [lat, lon, accuracy], ... }
  let count = 0;
  for (const [ordre, coords] of Object.entries(data)) {
    try {
      await prisma.$executeRaw`
        INSERT INTO carto_gps (ordre, lat, lon, accuracy)
        VALUES (${parseInt(ordre)}, ${coords[0]}, ${coords[1]}, ${coords[2]})
        ON CONFLICT (ordre) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.error(`Error importing GPS ${ordre}:`, e.message);
    }
  }
  
  console.log(`✅ Imported ${count} GPS points`);
}

async function importPrestataires() {
  console.log('🏢 Creating default prestataires...');
  
  const prestataires = [
    { lot: 'A', nom: 'PROQUELEC Lot A', telephone: '', email: '', region: 'Kaffrine' },
    { lot: 'B', nom: 'PROQUELEC Lot B', telephone: '', email: '', region: 'Kaffrine' },
    { lot: 'C', nom: 'PROQUELEC Lot C', telephone: '', email: '', region: 'Kaffrine' },
  ];
  
  let count = 0;
  for (const p of prestataires) {
    try {
      await prisma.$executeRaw`
        INSERT INTO carto_prestataires (lot, nom, telephone, email, region)
        VALUES (${p.lot}, ${p.nom}, ${p.telephone}, ${p.email}, ${p.region})
        ON CONFLICT (lot, nom) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.error(`Error importing prestataire ${p.nom}:`, e.message);
    }
  }
  
  console.log(`✅ Imported ${count} prestataires`);
}

async function main() {
  try {
    console.log('🚀 Starting carto_grappes data import...\n');
    
    await createTables();
    await importVillages();
    await importMenages();
    await importGps();
    await importPrestataires();
    
    console.log('\n🏁 Import complete!');
  } catch (error) {
    console.error('❌ Import error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();