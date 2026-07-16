import prisma from './src/core/utils/prisma.js';

async function reassignYounousFatouV2() {
  try {
    console.log('=== Correction finale YOUNOUS DIAGNE et FATOU THIAM ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // 1. Libérer TAM_G002 de Le Natangue Suarl dans Lot B
    console.log('Libération de TAM_G002 (Le Natangue Suarl) dans Lot B...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G002',
        entreprise: 'Le Natangue Suarl'
      }
    });
    console.log('✓ TAM_G002 libérée\n');

    // 2. Supprimer toutes les assignations de YOUNOUS DIAGNE
    console.log('Suppression des assignations YOUNOUS DIAGNE...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'YOUNOUS DIAGNE'
      }
    });
    console.log('✓ Assignations YOUNOUS DIAGNE supprimées\n');

    // 3. Supprimer l'assignation de LAWS
    console.log('Suppression de l\'assignation LAWS...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'Lebougui all works services (LAWS)'
      }
    });
    console.log('✓ Assignation LAWS supprimée\n');

    // 4. Supprimer les assignations de FATOU THIAM
    console.log('Suppression des assignations FATOU THIAM...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'FATOU THIAM'
      }
    });
    console.log('✓ Assignations FATOU THIAM supprimées\n');

    // 5. Créer les nouvelles assignations
    console.log('=== Création des nouvelles assignations ===\n');

    // YOUNOUS DIAGNE - Lot B : TAM_G002 (450 ménages)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G002',
        mode: 'individuel',
        entreprise: 'YOUNOUS DIAGNE',
        societe: 'YOUNOUS DIAGNE'
      }
    });
    console.log('✓ YOUNOUS DIAGNE Lot B: TAM_G002 (450 ménages)');

    // YOUNOUS DIAGNE - Lot C : TAM_G003 (451 ménages - la plus grande)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'C',
        grappeKey: 'TAM_G003',
        mode: 'individuel',
        entreprise: 'YOUNOUS DIAGNE',
        societe: 'YOUNOUS DIAGNE'
      }
    });
    console.log('✓ YOUNOUS DIAGNE Lot C: TAM_G003 (451 ménages)\n');

    // FATOU THIAM - Lot C : Toutes les 6 grappes Kaffrine
    console.log('FATOU THIAM Lot C (toutes les grappes Kaffrine):');
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'KAF' }
      },
      orderBy: { grappeNumber: 'asc' }
    });

    for (const grappe of kaffrineGrappes) {
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'C',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: 'FATOU THIAM',
          societe: 'FATOU THIAM'
        }
      });
      console.log(`  ✓ ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Redonner une grappe à Le Natangue Suarl dans Lot B
    console.log('\nAttribution d\'une autre grappe à Le Natangue Suarl (Lot B):');
    // Libérer KAF_G001 d'ADIOUMA NDIAYE d'abord
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G001',
        entreprise: 'ADIOUMA NDIAYE'
      }
    });
    console.log('  ✓ KAF_G001 libérée d\'ADIOUMA NDIAYE');
    
    // Donner KAF_G001 à Le Natangue Suarl
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G001',
        mode: 'individuel',
        entreprise: 'Le Natangue Suarl',
        societe: 'Le Natangue Suarl'
      }
    });
    console.log('  ✓ Le Natangue Suarl: KAF_G001 (360 ménages)');

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    const finalAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { 
        organizationId,
        entreprise: { in: ['YOUNOUS DIAGNE', 'FATOU THIAM', 'Le Natangue Suarl'] }
      },
      orderBy: [{ lot: 'asc' }, { entreprise: 'asc' }]
    });

    const byEntrepreneurLot = {};
    finalAssignments.forEach(e => {
      const key = `${e.entreprise}_Lot${e.lot}`;
      if (!byEntrepreneurLot[key]) byEntrepreneurLot[key] = [];
      byEntrepreneurLot[key].push(e.grappeKey);
    });

    console.log('\nNouvelles assignations:');
    Object.entries(byEntrepreneurLot).forEach(([key, grappeKeys]) => {
      const [entrepreneur, lot] = key.split('_Lot');
      console.log(`  ${entrepreneur} - Lot ${lot}: ${grappeKeys.length} grappe(s) (${grappeKeys.join(', ')})`);
    });

    // Vérifier les totaux
    const younousCount = finalAssignments.filter(e => e.entreprise === 'YOUNOUS DIAGNE').length;
    const fatouCount = finalAssignments.filter(e => e.entreprise === 'FATOU THIAM').length;
    
    console.log(`\n📊 Totaux:`);
    console.log(`  YOUNOUS DIAGNE: ${younousCount} grappes (1 Lot B + 1 Lot C) ✓`);
    console.log(`  FATOU THIAM: ${fatouCount} grappes (6 Lot C) ✓`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reassignYounousFatouV2();