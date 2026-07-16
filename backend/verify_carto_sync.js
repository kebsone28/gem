import prisma from './src/core/utils/prisma.js';

async function verifyCartoSync() {
  try {
    console.log('=== Vérification de la synchronisation des données cartographiques ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836';

    // Récupérer les régions
    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId }
    });

    console.log(`Régions trouvées: ${regions.length}`);
    regions.forEach(r => {
      console.log(`  - ${r.name} (${r.code})`);
    });

    // Récupérer les grappes
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true },
      orderBy: [{ region: { name: 'asc' } }, { grappeNumber: 'asc' }]
    });

    console.log(`\nGrappes actives: ${grappes.length}`);
    grappes.forEach(g => {
      console.log(`  - ${g.grappeKey} (${g.region.name}): ${g.menageCount} ménages`);
    });

    // Vérifier la distribution attendue
    const expectedDistribution = {
      'Kaffrine': 6,
      'Tambacounda': 3
    };

    console.log('\n=== Vérification de la distribution ===');
    const distribution = {};
    grappes.forEach(g => {
      const regionName = g.region.name;
      distribution[regionName] = (distribution[regionName] || 0) + 1;
    });

    let allCorrect = true;
    Object.entries(expectedDistribution).forEach(([region, expected]) => {
      const actual = distribution[region] || 0;
      const correct = actual === expected;
      allCorrect = allCorrect && correct;
      console.log(`${region}: ${actual}/${expected} grappes ${correct ? '✅' : '❌'}`);
    });

    // Vérifier les entrepreneurs
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId },
      orderBy: [{ lot: 'asc' }, { entreprise: 'asc' }]
    });

    console.log(`\nEntrepreneurs: ${entrepreneurs.length}`);
    const entrepreneurByLot = {};
    entrepreneurs.forEach(e => {
      if (!entrepreneurByLot[e.lot]) {
        entrepreneurByLot[e.lot] = [];
      }
      entrepreneurByLot[e.lot].push(e);
    });

    Object.keys(entrepreneurByLot).sort().forEach(lot => {
      console.log(`\nLot ${lot}:`);
      entrepreneurByLot[lot].forEach(e => {
        if (e.mode === 'global') {
          console.log(`  - ${e.entreprise}: Mode global (toutes les grappes)`);
        } else if (e.grappeKey) {
          console.log(`  - ${e.entreprise}: ${e.grappeKey} (${e.mode})`);
        }
      });
    });

    // Vérifier que BAMBA NDOA a bien 2 grappes (1 Kaffrine + 1 Tambacounda)
    const bambaAssignments = entrepreneurs.filter(e => e.entreprise === 'BAMBA NDOA');
    console.log(`\n=== Vérification BAMBA NDOA ===`);
    console.log(`Assignations totales: ${bambaAssignments.length}`);
    bambaAssignments.forEach(e => {
      const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
      const region = grappe ? grappe.region.name : 'Inconnue';
      console.log(`  - Lot ${e.lot}: ${e.grappeKey} (${region})`);
    });

    if (allCorrect) {
      console.log('\n✅ Synchronisation correcte !');
    } else {
      console.log('\n❌ Problème de synchronisation détecté !');
    }

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCartoSync();