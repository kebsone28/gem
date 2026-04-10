import { PrismaClient } from '@prisma/client';
import { generateDynamicGrappes } from './src/utils/clustering.js';

const prisma = new PrismaClient();

async function recreateGrappes() {
  try {
    console.log('=== REGÉNÉRATION INTELLIGENTE DES GRAPPES ===\n');

    // Get all households
    const households = await prisma.household.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        region: true,
        village: true,
        departement: true,
        latitude: true,
        longitude: true,
        location: true,
        name: true
      }
    });

    console.log(`📥 Ménages trouvés: ${households.length}\n`);

    // Generate grappes
    const result = generateDynamicGrappes(households, {
      'Dakar': 300,
      'Tambacounda': 600,
      'Kaffrine': 600,
      'Kolda': 600
    });

    console.log('✅ RÉSULTATS \n');
    console.log(`   Grappes: ${result.grappes.length}`);
    console.log(`   Sous-grappes: ${result.sous_grappes.length}`);
    console.log(`   Statistiques:`);
    console.log(`      • Total: ${result.stats.totalHouseholds}`);
    console.log(`      • Avec GPS: ${result.stats.withGPS} (${result.stats.gpsPercentage}%)`);
    console.log(`      • Sans GPS: ${result.stats.withoutGPS}`);

    // Save to DB - Only if user confirms
    console.log('\n⏳ À FAIRE: Les grappes peuvent être sauvegardées dans la BD');
    console.log('💾 Exemple: await prisma.grappe.createMany({ data: result.grappes })');

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

recreateGrappes();
