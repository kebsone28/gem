import prisma from './src/core/utils/prisma.js';

async function correctYounousFatouAssignment() {
  try {
    console.log('=== Correction de l\'assignation YOUNOUS DIAGNE et FATOU THIAM ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer les grappes
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'KAF' }
      },
      include: { region: true },
      orderBy: { grappeNumber: 'asc' }
    });

    const tambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'TAM' }
      },
      include: { region: true },
      orderBy: { grappeNumber: 'asc' }
    });

    console.log('Grappes Kaffrine:');
    kaffrineGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    console.log('\nGrappes Tambacounda:');
    tambacoundaGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    // État actuel des assignations
    console.log('\n=== Assignations actuelles ===');
    const currentAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { 
        organizationId,
        entreprise: { in: ['YOUNOUS DIAGNE', 'FATOU THIAM', 'Lebougui all works services (LAWS)'] }
      },
      orderBy: [{ lot: 'asc' }, { entreprise: 'asc' }]
    });

    currentAssignments.forEach(e => {
      console.log(`  Lot ${e.lot} - ${e.entreprise}: ${e.grappeKey} (${e.mode})`);
    });

    // 1. Supprimer toutes les assignations de YOUNOUS DIAGNE
    console.log('\n=== Suppression des assignations actuelles ===');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'YOUNOUS DIAGNE'
      }
    });
    console.log('✓ Assignations YOUNOUS DIAGNE supprimées');

    // 2. Supprimer l'assignation de LAWS (pour redonner KAF_G006 à FATOU THIAM)
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'Lebougui all works services (LAWS)'
      }
    });
    console.log('✓ Assignation LAWS supprimée');

    // 3. Supprimer les assignations actuelles de FATOU THIAM pour les recréer
    await prisma.cartoEntrepreneur.deleteMany({
      where: { 
        organizationId,
        entreprise: 'FATOU THIAM'
      }
    });
    console.log('✓ Assignations FATOU THIAM supprimées');

    // 4. Créer les nouvelles assignations
    console.log('\n=== Création des nouvelles assignations ===');

    // YOUNOUS DIAGNE - Lot B : 1 grappe Tambacounda (la plus petite)
    const smallestTamba = tambacoundaGrappes.reduce((min, g) => 
      g.menageCount < min.menageCount ? g : min
    );
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: smallestTamba.grappeKey,
        mode: 'individuel',
        entreprise: 'YOUNOUS DIAGNE',
        societe: 'YOUNOUS DIAGNE'
      }
    });
    console.log(`✓ YOUNOUS DIAGNE Lot B: ${smallestTamba.grappeKey} (${smallestTamba.menageCount} ménages)`);

    // YOUNOUS DIAGNE - Lot C : 1 grappe Tambacounda (la plus grande restante)
    const largestTamba = tambacoundaGrappes
      .filter(g => g.grappeKey !== smallestTamba.grappeKey)
      .reduce((max, g) => g.menageCount > max.menageCount ? g : max);
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'C',
        grappeKey: largestTamba.grappeKey,
        mode: 'individuel',
        entreprise: 'YOUNOUS DIAGNE',
        societe: 'YOUNOUS DIAGNE'
      }
    });
    console.log(`✓ YOUNOUS DIAGNE Lot C: ${largestTamba.grappeKey} (${largestTamba.menageCount} ménages)`);

    // FATOU THIAM - Lot C : Toutes les 6 grappes Kaffrine
    console.log('\nFATOU THIAM Lot C (toutes les grappes Kaffrine):');
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

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    const finalAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { 
        organizationId,
        entreprise: { in: ['YOUNOUS DIAGNE', 'FATOU THIAM'] }
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

correctYounousFatouAssignment();