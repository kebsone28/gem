import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImportSources() {
  try {
    console.log('=== ANALYSE DES SOURCES D\'IMPORTATION ===\n');

    // Compter par source
    const bySource = await prisma.household.groupBy({
      by: ['source'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log('Distribution par source:');
    bySource.forEach(s => {
      console.log(`  ${s.source || '(null)'}: ${s._count.id}`);
    });

    // Vérifier les métadonnées Kobo
    const withKoboData = await prisma.household.count({
      where: { deletedAt: null, koboData: { not: {} } }
    });
    console.log(`\nMénages avec métadonnées Kobo: ${withKoboData}`);

    // Vérifier la distribution par région
    console.log('\nDistribution par région:');
    const byRegion = await prisma.household.groupBy({
      by: ['region'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    byRegion.forEach(r => {
      console.log(`  ${r.region || '(null)'}: ${r._count.id}`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportSources();
