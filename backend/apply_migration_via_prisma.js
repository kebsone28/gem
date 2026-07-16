import prisma from './src/core/utils/prisma.js';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  try {
    console.log('=== Application de la migration Carto Grappes ===\n');

    const sqlPath = path.join(process.cwd(), 'prisma', 'migration_carto_grappes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter le SQL directement via Prisma
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier les tables créées
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'Carto%'
      ORDER BY table_name
    `;

    console.log('Tables Carto créées:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();