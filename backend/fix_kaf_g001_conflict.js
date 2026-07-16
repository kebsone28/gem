import prisma from './src/core/utils/prisma.js';

async function fixKafG001Conflict() {
  try {
    console.log('=== Correction du conflit KAF_G001 ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Donner KAF_G001 à FATOU THIAM (Lot C) et libérer pour Le Natangue Suarl (Lot B)
    console.log('Suppression de KAF_G001 pour Le Natangue Suarl (Lot B)...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G001',
        entreprise: 'Le Natangue Suarl'
      }
    });
    console.log('✓ KAF_G001 libérée pour Le Natangue Suarl\n');

    // Donner KAF_G004 à Le Natangue Suarl (libérée de Services Plus Senegal)
    console.log('Libération de KAF_G004 (Services Plus Senegal)...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G004',
        entreprise: 'Services Plus Senegal'
      }
    });
    console.log('✓ KAF_G004 libérée\n');

    console.log('Attribution de KAF_G004 à Le Natangue Suarl...');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G004',
        mode: 'individuel',
        entreprise: 'Le Natangue Suarl',
        societe: 'Le Natangue Suarl'
      }
    });
    console.log('✓ Le Natangue Suarl: KAF_G004 (365 ménages)\n');

    // Donner KAF_G001 à Services Plus Senegal
    console.log('Attribution de KAF_G001 à Services Plus Senegal...');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G001',
        mode: 'individuel',
        entreprise: 'Services Plus Senegal',
        societe: 'Services Plus Senegal'
      }
    });
    console.log('✓ Services Plus Senegal: KAF_G001 (360 ménages)\n');

    // Vérification finale
    console.log('=== Vérification finale ===');
    const lotBAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'B' },
      orderBy: { entreprise: 'asc' }
    });

    console.log('\nAssignations Lot B:');
    lotBAssignments.forEach(e => {
      console.log(`  ${e.entreprise}: ${e.grappeKey}`);
    });

    const lotCAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'C' },
      orderBy: { entreprise: 'asc' }
    });

    console.log('\nAssignations Lot C:');
    const byEntrepreneur = {};
    lotCAssignments.forEach(e => {
      if (!byEntrepreneur[e.entreprise]) byEntrepreneur[e.entreprise] = [];
      byEntrepreneur[e.entreprise].push(e.grappeKey);
    });

    Object.entries(byEntrepreneur).forEach(([entrepreneur, grappeKeys]) => {
      console.log(`  ${entrepreneur}: ${grappeKeys.length} grappe(s) (${grappeKeys.join(', ')})`);
    });

    // Vérifier les totaux
    const younousLotB = await prisma.cartoEntrepreneur.count({
      where: { organizationId, lot: 'B', entreprise: 'YOUNOUS DIAGNE' }
    });
    const younousLotC = await prisma.cartoEntrepreneur.count({
      where: { organizationId, lot: 'C', entreprise: 'YOUNOUS DIAGNE' }
    });
    const fatouLotC = await prisma.cartoEntrepreneur.count({
      where: { organizationId, lot: 'C', entreprise: 'FATOU THIAM' }
    });

    console.log(`\n📊 Totaux:`);
    console.log(`  YOUNOUS DIAGNE: ${younousLotB + younousLotC} grappes (${younousLotB} Lot B + ${younousLotC} Lot C) ✓`);
    console.log(`  FATOU THIAM: ${fatouLotC} grappes (6 Lot C) ✓`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixKafG001Conflict();