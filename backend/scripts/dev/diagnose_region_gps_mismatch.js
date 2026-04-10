import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnosisRegionGPSMismatch() {
  try {
    console.log('=== DIAGNOSTIC: RÉGION vs GPS MISMATCH ===\n');

    // 1. Compter les ménages par région
    const byRegion = await prisma.household.groupBy({
      by: ['region'],
      where: { deletedAt: null },
      _count: { id: true }
    });

    console.log('📍 Ménages par RÉGION (colonne):\n');
    byRegion.forEach(r => {
      console.log(`   ${(r.region || '(null)').padEnd(20)} : ${r._count.id}`);
    });

    // 2. Vérifier GPS Dakar (problable zone de test)
    const dakarGPS = await prisma.household.findMany({
      where: {
        deletedAt: null,
        OR: [
          { latitude: { gte: 8.5, lte: 15.5 }, longitude: { gte: 13.5, lte: 15.5 } },  // Dakar bbox
          { 
            location: {
              path: ['coordinates'],
              array_contains: null  // Approximation, cherche coordinates []
            }
          }
        ]
      },
      select: { 
        id: true, 
        region: true, 
        latitude: true, 
        longitude: true,
        village: true,
        source: true
      },
      take: 10
    });

    console.log(`\n🗺️ Ménages avec GPS proche de Dakar:\n`);
    if (dakarGPS.length > 0) {
      dakarGPS.forEach(h => {
        console.log(`   ID: ${h.id}`);
        console.log(`   Région: ${h.region}, Village: ${h.village}`);
        console.log(`   GPS: ${h.latitude}, ${h.longitude}`);
        console.log(`   Source: ${h.source}\n`);
      });
    } else {
      console.log('   Aucun trouvé\n');
    }

    // 3. Statistiques GPS
    const withGPS = await prisma.household.count({
      where: {
        deletedAt: null,
        OR: [
          { latitude: { not: null } },
          { longitude: { not: null } }
        ]
      }
    });

    const withoutGPS = await prisma.household.count({
      where: {
        deletedAt: null,
        latitude: null,
        longitude: null
      }
    });

    console.log(`📊 Couverture GPS:\n`);
    console.log(`   Avec GPS: ${withGPS}`);
    console.log(`   Sans GPS: ${withoutGPS}`);
    console.log(`   Ratio: ${((withGPS / (withGPS + withoutGPS)) * 100).toFixed(1)}%\n`);

    // 4. Ménages par source
    const bySource = await prisma.household.groupBy({
      by: ['source'],
      where: { deletedAt: null },
      _count: { id: true }
    });

    console.log(`📤 Ménages par SOURCE:\n`);
    bySource.forEach(s => {
      console.log(`   ${(s.source || '(null)').padEnd(15)} : ${s._count.id}`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosisRegionGPSMismatch();
