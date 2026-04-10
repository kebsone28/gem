import { PrismaClient } from '@prisma/client';
import { generateDynamicGrappes } from './src/utils/clustering.js';

const prisma = new PrismaClient();

async function testImprovedClustering() {
  try {
    console.log('=== TEST: IMPROVED CLUSTERING ===\n');

    // Récupérer tous les ménages
    const households = await prisma.household.findMany({
      where: { deletedAt: null },
      take: 100  // Test avec 100 ménages
    });

    console.log(`Loaded ${households.length} households for testing\n`);

    if (households.length === 0) {
      console.log('No households to test. Please import data first.');
      return;
    }

    // Tester le nouveau clustering
    const { grappes, sous_grappes, stats } = generateDynamicGrappes(households);

    console.log('\n=== RÉSULTATS ===\n');
    console.log(`Grappes générées: ${grappes.length}`);
    console.log(`Sous-grappes générées: ${sous_grappes.length}\n`);

    console.log('=== EXEMPLES DE GRAPPES ===\n');
    grappes.slice(0, 5).forEach((g, i) => {
      console.log(`${i + 1}. ${g.nom}`);
      console.log(`   Region: ${g.region}, Village: ${g.village}`);
      console.log(`   Ménages: ${g.nb_menages} (${g.gps_percentage}% avec GPS)`);
      if (g.has_gps) {
        console.log(`   Centre GPS: ${g.centroide_lat}, ${g.centroide_lon}`);
        console.log(`   Rayon: ${g.rayon_moyen_km}km (max: ${g.rayon_max_km}km)`);
      } else {
        console.log(`   Sans coordonnées GPS`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testImprovedClustering();
