import prisma from './src/core/utils/prisma.js';

async function correctBambaNdoaAssignment() {
  try {
    console.log('=== Correction de l\'assignation BAMBA NDOA ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer les assignations actuelles de BAMBA NDOA
    const currentAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { 
        organizationId,
        entreprise: 'BAMBA NDOA'
      }
    });

    console.log('Assignations actuelles de BAMBA NDOA:');
    currentAssignments.forEach(e => {
      console.log(`  Lot ${e.lot}: ${e.grappeKey} (${e.mode})`);
    });

    // Supprimer les assignations actuelles de BAMBA NDOA
    console.log('\nSuppression des assignations actuelles...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'BAMBA NDOA'
      }
    });
    console.log('✓ Assignations supprimées\n');

    // Créer les nouvelles assignations selon les spécifications
    console.log('Création des nouvelles assignations:');

    // Lot B - BAMBA NDOA : 1 grappe Kaffrine + 1 grappe Tambacounda
    console.log('Lot B - BAMBA NDOA (1 Kaffrine + 1 Tambacounda):');
    
    // Libérer KAF_G002 d'abord (assignée à Services Plus Senegal)
    console.log('Libération de KAF_G002...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G002'
      }
    });
    console.log('✓ KAF_G002 libérée');
    
    // Grappe Kaffrine (la plus grande)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G002', // Une grappe Kaffrine de 365 ménages
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ KAF_G002 (365 ménages, Kaffrine)');

    // Grappe Tambacounda (la plus grande)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G003', // La plus grande grappe Tambacounda
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ TAM_G003 (451 ménages, Tambacounda)\n');

    // Donner KAF_G001 à Services Plus Senegal
    console.log('Réattribution de KAF_G001 à Services Plus Senegal...');
    
    // Libérer KAF_G001 d'abord
    await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'B',
        grappeKey: 'KAF_G001'
      }
    });
    console.log('  ✓ KAF_G001 libérée');
    
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
    console.log('  ✓ KAF_G001 attribuée à Services Plus Senegal\n');

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    
    const bambaAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, entreprise: 'BAMBA NDOA' }
    });

    console.log('\nNouvelles assignations BAMBA NDOA:');
    for (const assignment of bambaAssignments) {
      if (assignment.grappeKey) {
        const grappeInfo = await prisma.cartoGrappe.findFirst({
          where: { grappeKey: assignment.grappeKey },
          include: { region: true }
        });
        console.log(`  Lot ${assignment.lot}: ${assignment.grappeKey} (${grappeInfo?.menageCount} ménages, ${grappeInfo?.region.name})`);
      } else {
        console.log(`  Lot ${assignment.lot}: mode ${assignment.mode}`);
      }
    }

    const lotBAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'B' },
      orderBy: { entreprise: 'asc' }
    });

    console.log('\nToutes les assignations Lot B:');
    const byGrappe = {};
    for (const e of lotBAssignments) {
      if (!byGrappe[e.grappeKey]) byGrappe[e.grappeKey] = [];
      byGrappe[e.grappeKey].push(e.entreprise);
    }

    for (const [grappeKey, entrepreneurs] of Object.entries(byGrappe)) {
      const grappe = await prisma.cartoGrappe.findFirst({
        where: { grappeKey },
        include: { region: true }
      });
      console.log(`  ${grappeKey} (${grappe?.menageCount} ménages, ${grappe?.region.name}): ${entrepreneurs.join(', ')}`);
    }

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

correctBambaNdoaAssignment();