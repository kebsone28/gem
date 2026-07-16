import prisma from './src/core/utils/prisma.js';

async function reassignEntrepreneursFinal() {
  try {
    console.log('=== Réassignation finale des entrepreneurs ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer toutes les grappes
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true },
      orderBy: { menageCount: 'desc' }
    });

    console.log('Grappes disponibles (triées par nombre de ménages):');
    grappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages (${g.region.name})`);
    });

    // Identifier les plus grandes grappes (max 580)
    const largestGrappes = grappes.filter(g => g.menageCount <= 580);
    console.log(`\nGrappes éligibles pour BAMBA NDOA (max 580): ${largestGrappes.length}`);

    // BAMBA NDOA aura les 2 plus grandes grappes
    const bambaGrappes = largestGrappes.slice(0, 2);
    console.log(`Grappes pour BAMBA NDOA:`);
    bambaGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    // Grappes restantes pour les autres responsables
    const remainingGrappes = grappes.filter(g => 
      !bambaGrappes.find(bg => bg.id === g.id)
    );
    console.log(`\nGrappes restantes pour les autres: ${remainingGrappes.length}`);

    // Autres responsables (à partir des entrepreneurs existants)
    const otherResponsibles = [
      'Le Natangue Suarl',
      'Services Plus Senegal', 
      'TOP ENERGIE',
      'COTRAC',
      'Génie plus Senegal',
      'Général Service et synergie (CSS)',
      'Lebougui all works services (LAWS)',
      'Global service plus'
    ];

    // Supprimer tous les entrepreneurs existants
    console.log('\nSuppression des entrepreneurs existants...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Entrepreneurs supprimés\n');

    // Recréer les entrepreneurs selon les spécifications
    console.log('=== Création des entrepreneurs ===\n');

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
    console.log('  ✓ Créé (mode global, toutes les grappes)\n');

    // Lot B - M. ADIOUMA NDIAYE (une petite grappe)
    const smallestGrappe = remainingGrappes.reduce((min, g) => 
      g.menageCount < min.menageCount ? g : min
    );
    console.log('Lot B - M. ADIOUMA NDIAYE (plus petite grappe):');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: smallestGrappe.grappeKey,
        mode: 'individuel',
        entreprise: 'ADIOUMA NDIAYE',
        societe: 'ADIOUMA NDIAYE'
      }
    });
    console.log(`  ✓ Assigné à ${smallestGrappe.grappeKey} (${smallestGrappe.menageCount} ménages)\n`);

    // Lot B - M. BAMBA NDOA (les plus grandes grappes, max 580)
    console.log('Lot B - M. BAMBA NDOA (plus grandes grappes):');
    for (const grappe of bambaGrappes) {
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: 'BAMBA NDOA',
          societe: 'BAMBA NDOA'
        }
      });
      console.log(`  ✓ Assigné à ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Grappes restantes après assignation de BAMBA NDOA et ADIOUMA NDIAYE
    const stillRemaining = remainingGrappes.filter(g => 
      g.id !== smallestGrappe.id
    );
    console.log(`\nGrappes restantes pour autres responsables: ${stillRemaining.length}`);

    // Distribuer les grappes restantes aux autres responsables dans le Lot B
    console.log('\nLot B - Autres responsables:');
    for (let i = 0; i < stillRemaining.length && i < otherResponsibles.length; i++) {
      const grappe = stillRemaining[i];
      const responsible = otherResponsibles[i];
      
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: responsible,
          societe: responsible
        }
      });
      console.log(`  ✓ ${responsible} → ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Lot C - Mme FATOU THIAM (tout Kaffrine)
    console.log('\nLot C - Mme FATOU THIAM (tout Kaffrine):');
    const kaffrineGrappes = grappes.filter(g => g.region.code === 'KAF');
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
      console.log(`  ✓ Assigné à ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Lot C - M. YOUNOUS DIAGNE (tout Tambacounda)
    console.log('\nLot C - M. YOUNOUS DIAGNE (tout Tambacounda):');
    const tambacoundaGrappes = grappes.filter(g => g.region.code === 'TAM');
    for (const grappe of tambacoundaGrappes) {
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'C',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: 'YOUNOUS DIAGNE',
          societe: 'YOUNOUS DIAGNE'
        }
      });
      console.log(`  ✓ Assigné à ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId },
      orderBy: [{ lot: 'asc' }, { entreprise: 'asc' }]
    });

    console.log(`\nTotal entrepreneurs créés: ${entrepreneurs.length}`);

    const byLot = {};
    entrepreneurs.forEach(e => {
      if (!byLot[e.lot]) byLot[e.lot] = [];
      byLot[e.lot].push(e);
    });

    ['A', 'B', 'C'].forEach(lot => {
      console.log(`\nLot ${lot}:`);
      byLot[lot]?.forEach(e => {
        if (e.mode === 'global') {
          console.log(`  ${e.entreprise}: mode global (toutes les grappes)`);
        } else {
          const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
          console.log(`  ${e.entreprise}: ${e.grappeKey} (${grappe?.menageCount || 0} ménages)`);
        }
      });
    });

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reassignEntrepreneursFinal();