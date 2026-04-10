import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGrappesAfterFix() {
  try {
    console.log('=== VÉRIFICATION GRAPPES APRÈS CORRECTION ===\n');

    // Grappes par région
    const grappes = await prisma.grappe.findMany({
      include: {
        region: true,
        households: {
          select: { id: true }
        }
      }
    });

    console.log(`📦 Total Grappes: ${grappes.length}\n`);

    // Group by zone
    const byZone = {};
    grappes.forEach(g => {
      const zoneName = g.region?.name || 'Unknown';
      if (!byZone[zoneName]) byZone[zoneName] = [];
      byZone[zoneName].push(g);
    });

    Object.entries(byZone).forEach(([zone, zoneGrappes]) => {
      const totalHouseholds = zoneGrappes.reduce((sum, g) => sum + g.households.length, 0);
      console.log(`\n📍 Zone: ${zone}`);
      console.log(`   Grappes: ${zoneGrappes.length}`);
      console.log(`   Ménages: ${totalHouseholds}`);
      zoneGrappes.forEach(g => {
        console.log(`   • ${g.name}: ${g.households.length} ménages`);
      });
    });

    // Households without grappe
    const unclassified = await prisma.household.findMany({
      where: {
        grappeId: null,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        region: true,
        latitude: true,
        longitude: true
      }
    });

    if (unclassified.length > 0) {
      console.log(`\n❌ Ménages non classés: ${unclassified.length}`);
      unclassified.forEach(h => {
        console.log(`   • ${h.name || h.id} (${h.region}) - GPS: [${h.latitude}, ${h.longitude}]`);
      });
    }

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkGrappesAfterFix();
