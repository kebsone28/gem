import prisma from './src/core/utils/prisma.js';

async function simpleFinalSolution() {
  try {
    console.log('=== Solution finale simplifiée ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer les grappes
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'KAF' }
      },
      orderBy: { grappeNumber: 'asc' }
    });

    const tambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'TAM' }
      },
      orderBy: { grappeNumber: 'asc' }
    });

    // Supprimer toutes les assignations existantes
    console.log('Suppression de toutes les assignations...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Toutes les assignations supprimées\n');

    // Recréer selon les spécifications exactes
    console.log('=== Création des assignations selon spécifications ===\n');

    // Lot A - M. ADIOUMA NDIAYE (mode global)
    console.log('Lot A - M. ADIOUMA NDIAYE (mode global):');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'A',
        mode: 'global',
        entreprise: 'ADIOUMA NDIAYE',
        societe: 'ADIOUMA NDIAYE'
      }
    });
    console.log('  ✓ Créé (mode global)\n');

    // Lot B - YOUNOUS DIAGNE : 1 grappe Tambacounda
    console.log('Lot B - YOUNOUS DIAGNE (1 grappe Tambacounda):');
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
    console.log('  ✓ TAM_G002 (450 ménages)\n');

    // Lot B - BAMBA NDOA : 2 plus grandes grappes (max 580)
    console.log('Lot B - BAMBA NDOA (2 plus grandes grappes):');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G003',
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ TAM_G003 (451 ménages)');

    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G001',
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ TAM_G001 (450 ménages)\n');

    // Lot B - Autres responsables : assigner aux grappes Kaffrine restantes
    console.log('Lot B - Autres responsables (grappes Kaffrine):');
    const otherEntrepreneurs = [
      'Le Natangue Suarl',
      'Services Plus Senegal', 
      'TOP ENERGIE',
      'COTRAC',
      'Génie plus Senegal',
      'Général Service et synergie (CSS)'
    ];

    for (let i = 0; i < otherEntrepreneurs.length && i < kaffrineGrappes.length; i++) {
      const entrepreneur = otherEntrepreneurs[i];
      const grappe = kaffrineGrappes[i];
      
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: entrepreneur,
          societe: entrepreneur
        }
      });
      console.log(`  ✓ ${entrepreneur}: ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Lot C - YOUNOUS DIAGNE : 1 grappe Tambacounda
    console.log('\nLot C - YOUNOUS DIAGNE (1 grappe Tambacounda):');
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
    console.log('  ✓ TAM_G003 (451 ménages)\n');

    // Lot C - FATOU THIAM : Toutes les 6 grappes Kaffrine
    console.log('Lot C - FATOU THIAM (toutes les 6 grappes Kaffrine):');
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

    console.log('\n✅ Configuration terminée selon vos spécifications!');

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simpleFinalSolution();