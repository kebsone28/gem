import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGPS() {
  try {
    const households = await prisma.household.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        region: true,
        latitude: true,
        longitude: true,
        village: true,
        source: true,
        name: true
      },
      orderBy: { latitude: 'desc' }
    });

    console.log('=== GPS RÉELS DES MÉNAGES ===\n');
    households.forEach(h => {
      console.log(`ID: ${h.id}`);
      console.log(`  Région: ${h.region}, Village: ${h.village}`);
      console.log(`  GPS: lat=${h.latitude}, lon=${h.longitude}`);
      console.log(`  Source: ${h.source}, Nom: ${h.name}\n`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkGPS();
