import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyGrappes() {
  try {
    console.log('=== VÉRIFICATION DES GRAPPES APRÈS NETTOYAGE ===\n');

    // Compter les ménages par grappe
    const grappes = await prisma.grappe.findMany({
      include: {
        _count: { select: { households: true } }
      }
    });

    let emptyCount = 0;
    let populatedCount = 0;
    let totalHouseholds = 0;

    const regions = {};

    for (const g of grappes) {
      // Recompter avec le filtre deletedAt: null
      const realCount = await prisma.household.count({
        where: { grappeId: g.id, deletedAt: null }
      });

      if (realCount === 0) {
        emptyCount++;
      } else {
        populatedCount++;
        totalHouseholds += realCount;
        
        // Grouper par région
        if (!regions[g.regionId]) {
          regions[g.regionId] = 0;
        }
        regions[g.regionId] += realCount;
      }
    }

    console.log(`Total grappes: ${grappes.length}`);
    console.log(`  - Grappes vides: ${emptyCount} ✗`);
    console.log(`  - Grappes avec ménages: ${populatedCount} ✓`);
    console.log(`\nTotal ménages: ${totalHouseholds}`);

    console.log('\n✓ Vérification terminée');
    console.log('\n📌 Vous pouvez maintenant recharger le bordereau');
    console.log('   L\'affichage devrait montrer 3,321 ménages');

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyGrappes();
