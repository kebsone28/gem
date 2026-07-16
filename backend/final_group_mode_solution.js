import prisma from './src/core/utils/prisma.js';

async function finalGroupModeSolution() {
  try {
    console.log('=== Solution finale avec mode groupe ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Supprimer toutes les assignations Lot B actuelles
    console.log('Suppression de toutes les assignations Lot B...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId, lot: 'B' }
    });
    console.log('✓ Lot B vidé\n');

    // Créer les assignations Lot B avec mode groupe
    console.log('Création des assignations Lot B (mode groupe):');

    // YOUNOUS DIAGNE - Lot B : TAM_G002 (mode groupe)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G002',
        mode: 'groupe',
        entreprise: 'YOUNOUS DIAGNE',
        societe: 'YOUNOUS DIAGNE'
      }
    });
    console.log('  ✓ YOUNOUS DIAGNE: TAM_G002 (groupe)');

    // BAMBA NDOA - Lot B : TAM_G001 et TAM_G003 (les plus grandes)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G001',
        mode: 'groupe',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ BAMBA NDOA: TAM_G001 (groupe)');

    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G003',
        mode: 'groupe',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log('  ✓ BAMBA NDOA: TAM_G003 (groupe)');

    // Les autres entrepreneurs sur les mêmes grappes en mode groupe
    const otherEntrepreneurs = [
      'Services Plus Senegal',
      'COTRAC',
      'Génie plus Senegal',
      'Général Service et synergie (CSS)',
      'Le Natangue Suarl',
      'TOP ENERGIE'
    ];

    // Répartir sur les 3 grappes Tambacounda
    const tambacoundaGrappes = ['TAM_G001', 'TAM_G002', 'TAM_G003'];
    
    for (let i = 0; i < otherEntrepreneurs.length; i++) {
      const entrepreneur = otherEntrepreneurs[i];
      const grappeKey = tambacoundaGrappes[i % 3];
      
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey,
          mode: 'groupe',
          entreprise: entrepreneur,
          societe: entrepreneur
        }
      });
      console.log(`  ✓ ${entrepreneur}: ${grappeKey} (groupe)`);
    }

    // Vérifier que Lot C est correct (FATOU THIAM avec 6 grappes Kaffrine, YOUNOUS DIAGNE avec 1 grappe Tambacounda)
    console.log('\nVérification Lot C...');
    const lotCAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'C' },
      orderBy: { entreprise: 'asc' }
    });

    const byEntrepreneurC = {};
    lotCAssignments.forEach(e => {
      if (!byEntrepreneurC[e.entreprise]) byEntrepreneurC[e.entreprise] = [];
      byEntrepreneurC[e.entreprise].push(e.grappeKey);
    });

    console.log('Assignations Lot C:');
    Object.entries(byEntrepreneurC).forEach(([entrepreneur, grappeKeys]) => {
      console.log(`  ${entrepreneur}: ${grappeKeys.length} grappe(s) (${grappeKeys.join(', ')})`);
    });

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    
    const lotBAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'B' },
      orderBy: { entreprise: 'asc' }
    });

    console.log(`\nAssignations Lot B (${lotBAssignments.length} entrepreneurs):`);
    const byGrappeB = {};
    lotBAssignments.forEach(e => {
      if (!byGrappeB[e.grappeKey]) byGrappeB[e.grappeKey] = [];
      byGrappeB[e.grappeKey].push(e.entreprise);
    });

    Object.entries(byGrappeB).forEach(([grappeKey, entrepreneurs]) => {
      console.log(`  ${grappeKey}: ${entrepreneurs.length} entrepreneur(s) (${entrepreneurs.join(', ')})`);
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
    console.log(`  FATOU THIAM: ${fatouLotC} grappes (6 Lot C, exclusivité Kaffrine) ✓`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalGroupModeSolution();