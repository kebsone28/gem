import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixKoboRegionToRealGPS() {
  try {
    console.log('=== CORRECTION: Région Kobo ↔ GPS ===\n');

    // Update all Kobo households with GPS matching Dakar bounds but incorrectly labeled Tambacounda
    const result = await prisma.household.updateMany({
      where: {
        source: 'Kobo',
        region: 'Tambacounda',
        latitude: { gte: 14.6, lte: 14.8 },
        longitude: { lte: -17.4, gte: -17.5 }
      },
      data: {
        region: 'Dakar'
      }
    });

    console.log(`✅ ${result.count} ménages Kobo corrigés Tambacounda → Dakar\n`);

    // Show updated records
    const updated = await prisma.household.findMany({
      where: {
        source: 'Kobo',
        region: 'Dakar'
      },
      select: {
        id: true,
        name: true,
        region: true,
        latitude: true,
        longitude: true
      }
    });

    console.log('📍 Ménages maintenant en Dakar :\n');
    updated.forEach(h => {
      console.log(`  ${h.name || h.id} → GPS [${h.latitude}, ${h.longitude}]`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixKoboRegionToRealGPS();
