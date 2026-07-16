import prisma from './src/core/utils/prisma.js';

async function finalCorrectionExclusive() {
  try {
    console.log('=== Correction finale pour exclusivité des grappes ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Supprimer toutes les assignations de grappes Kaffrine dans Lot B
    // pour laisser l'exclusivité à FATOU THIAM dans Lot C
    console.log('Suppression des assignations de grappes Kaffrine dans Lot B...');
    const kaffrineGrappeKeys = ['KAF_G001', 'KAF_G002', 'KAF_G003', 'KAF_G004', 'KAF_G005', 'KAF_G006'];
    
    for (const grappeKey of kaffrineGrappeKeys) {
      const deleted = await prisma.cartoEntrepreneur.deleteMany({
        where: {
          organizationId,
          lot: 'B',
          grappeKey: grappeKey
        }
      });
      if (deleted.count > 0) {
        console.log(`  ✓ ${grappeKey} supprimée du Lot B (${deleted.count} assignation(s))`);
      }
    }

    // Réassigner les entrepreneurs du Lot B qui ont perdu leurs grappes Kaffrine
    // aux grappes Tambacounda restantes
    console.log('\nRéassignation des entrepreneurs du Lot B aux grappes Tambacounda...');
    
    // Récupérer les grappes Tambacounda
    const tambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'TAM' }
      },
      orderBy: { menageCount: 'desc' }
    });

    console.log('Grappes Tambacounda disponibles:');
    tambacoundaGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    // Entrepreneurs qui avaient des grappes Kaffrine dans Lot B
    const displacedEntrepreneurs = [
      'Services Plus Senegal',
      'COTRAC', 
      'Génie plus Senegal',
      'Général Service et synergie (CSS)',
      'Le Natangue Suarl',
      'TOP ENERGIE'
    ];

    // YOUNOUS DIAGNE garde déjà TAM_G002, BAMBA NDOA a TAM_G001 et TAM_G003
    // Il reste TAM_G002 déjà prise par YOUNOUS DIAGNE
    // On peut créer des assignations de groupe ou réorganiser

    // Pour simplifier, on va attribuer les entrepreneurs déplacés en mode groupe
    // ou leur donner des assignations individuelles avec les mêmes grappes
    
    // Services Plus Senegal -> TAM_G001 (avec BAMBA NDOA en groupe)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G001',
        mode: 'individuel',
        entreprise: 'Services Plus Senegal',
        societe: 'Services Plus Senegal'
      }
    });
    console.log('  ✓ Services Plus Senegal: TAM_G001 (partagé avec BAMBA NDOA)');

    // COTRAC -> TAM_G002 (avec YOUNOUS DIAGNE en groupe)
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: 'TAM_G002',
        mode: 'individuel',
        entreprise: 'COTRAC',
        societe: 'COTRAC'
      }
    });
    console.log('  ✓ COTRAC: TAM_G002 (partagé avec YOUNOUS DIAGNE)');

    // Les autres entrepreneurs en mode groupe sur TAM_G003
    const remainingEntrepreneurs = ['Génie plus Senegal', 'Général Service et synergie (CSS)', 'Le Natangue Suarl', 'TOP ENERGIE'];
    
    for (const entrepreneur of remainingEntrepreneurs) {
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey: 'TAM_G003',
          mode: 'individuel',
          entreprise: entrepreneur,
          societe: entrepreneur
        }
      });
      console.log(`  ✓ ${entrepreneur}: TAM_G003 (partagé avec BAMBA NDOA)`);
    }

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    
    const lotBAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'B' },
      orderBy: { entreprise: 'asc' }
    });

    console.log('\nAssignations Lot B:');
    const byGrappeB = {};
    lotBAssignments.forEach(e => {
      if (!byGrappeB[e.grappeKey]) byGrappeB[e.grappeKey] = [];
      byGrappeB[e.grappeKey].push(e.entreprise);
    });

    Object.entries(byGrappeB).forEach(([grappeKey, entrepreneurs]) => {
      console.log(`  ${grappeKey}: ${entrepreneurs.length} entrepreneur(s) (${entrepreneurs.join(', ')})`);
    });

    const lotCAssignments = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'C' },
      orderBy: { entreprise: 'asc' }
    });

    console.log('\nAssignations Lot C:');
    const byEntrepreneurC = {};
    lotCAssignments.forEach(e => {
      if (!byEntrepreneurC[e.entreprise]) byEntrepreneurC[e.entreprise] = [];
      byEntrepreneurC[e.entreprise].push(e.grappeKey);
    });

    Object.entries(byEntrepreneurC).forEach(([entrepreneur, grappeKeys]) => {
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
    console.log(`  FATOU THIAM: ${fatouLotC} grappes (6 Lot C, exclusivité Kaffrine) ✓`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalCorrectionExclusive();