import prisma from './src/core/utils/prisma.js';

async function reconfigureGrappesEntrepreneurs() {
  try {
    console.log('=== Reconfiguration complète des grappes et entrepreneurs ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Données du fichier Excel
    const totalMenages = 3536;
    const kaffrineTotal = 2185;
    const tambacoundaTotal = 1351;

    console.log(`📊 Données cibles:`);
    console.log(`   Total: ${totalMenages} ménages`);
    console.log(`   Kaffrine: ${kaffrineTotal} ménages sur 6 grappes`);
    console.log(`   Tambacounda: ${tambacoundaTotal} ménages sur 3 grappes\n`);

    // Récupérer les régions
    const kaffrineRegion = await prisma.cartoRegion.findFirst({
      where: { organizationId, code: 'KAF' }
    });

    const tambacoundaRegion = await prisma.cartoRegion.findFirst({
      where: { organizationId, code: 'TAM' }
    });

    // Supprimer toutes les grappes existantes
    console.log('Suppression des grappes existantes...');
    await prisma.cartoGrappe.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Grappes supprimées\n');

    // Créer 6 grappes pour Kaffrine
    console.log('Création des 6 grappes pour Kaffrine:');
    const kaffrineGrappesData = [
      { number: 1, menages: 360 }, // ~1/6
      { number: 2, menages: 365 },
      { number: 3, menages: 365 },
      { number: 4, menages: 365 },
      { number: 5, menages: 365 },
      { number: 6, menages: 365 }  // Total: 2185
    ];

    const kaffrineGrappes = [];
    for (const g of kaffrineGrappesData) {
      const grappeKey = `KAF_G${String(g.number).padStart(3, '0')}`;
      const newGrappe = await prisma.cartoGrappe.create({
        data: {
          organizationId,
          regionId: kaffrineRegion.id,
          grappeNumber: g.number,
          grappeKey,
          menageCount: g.menages,
          active: true
        }
      });
      kaffrineGrappes.push(newGrappe);
      console.log(`  ✓ ${grappeKey}: ${g.menages} ménages`);
    }

    // Créer 3 grappes pour Tambacounda
    console.log('\nCréation des 3 grappes pour Tambacounda:');
    const tambacoundaGrappesData = [
      { number: 1, menages: 450 }, // ~1/3
      { number: 2, menages: 450 },
      { number: 3, menages: 451 }  // Total: 1351
    ];

    const tambacoundaGrappes = [];
    for (const g of tambacoundaGrappesData) {
      const grappeKey = `TAM_G${String(g.number).padStart(3, '0')}`;
      const newGrappe = await prisma.cartoGrappe.create({
        data: {
          organizationId,
          regionId: tambacoundaRegion.id,
          grappeNumber: g.number,
          grappeKey,
          menageCount: g.menages,
          active: true
        }
      });
      tambacoundaGrappes.push(newGrappe);
      console.log(`  ✓ ${grappeKey}: ${g.menages} ménages`);
    }

    // Identifier les grappes selon les critères
    console.log('\n=== Identification des grappes ===');
    
    // Grappe la plus faible (toutes régions confondues)
    const allGrappes = [...kaffrineGrappes, ...tambacoundaGrappes];
    const weakestGrappe = allGrappes.reduce((min, g) => 
      g.menageCount < min.menageCount ? g : min
    );
    console.log(`Grappe la plus faible: ${weakestGrappe.grappeKey} (${weakestGrappe.menageCount} ménages)`);

    // Grappes les plus grandes pour M. BAMBA NDOA (max 580)
    const largeGrappes = allGrappes
      .filter(g => g.menageCount <= 580)
      .sort((a, b) => b.menageCount - a.menageCount)
      .slice(0, 2);
    
    // S'assurer qu'on a une grappe de chaque région
    let bambaKaffrine = largeGrappes.find(g => g.grappeKey.startsWith('KAF'));
    let bambaTamba = largeGrappes.find(g => g.grappeKey.startsWith('TAM'));
    
    // Si pas trouvé, prendre les plus grandes de chaque région
    if (!bambaKaffrine) {
      bambaKaffrine = kaffrineGrappes.reduce((max, g) => 
        g.menageCount > max.menageCount ? g : max
      );
    }
    if (!bambaTamba) {
      bambaTamba = tambacoundaGrappes.reduce((max, g) => 
        g.menageCount > max.menageCount ? g : max
      );
    }
    
    console.log(`Grappes pour M. BAMBA NDOA:`);
    console.log(`  Kaffrine: ${bambaKaffrine.grappeKey} (${bambaKaffrine.menageCount} ménages)`);
    console.log(`  Tambacounda: ${bambaTamba.grappeKey} (${bambaTamba.menageCount} ménages)`);

    // Supprimer les entrepreneurs existants
    console.log('\nSuppression des entrepreneurs existants...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Entrepreneurs supprimés\n');

    // Créer les nouveaux entrepreneurs selon les spécifications
    console.log('=== Création des entrepreneurs ===\n');

    // Lot A - M. ADIOUMA NDIAYE (attribution globale)
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

    // Lot B - M. ADIOUMA NDIAYE (grappe la plus faible)
    console.log('Lot B - M. ADIOUMA NDIAYE (grappe la plus faible):');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: weakestGrappe.grappeKey,
        mode: 'individuel',
        entreprise: 'ADIOUMA NDIAYE',
        societe: 'ADIOUMA NDIAYE'
      }
    });
    console.log(`  ✓ Assigné à ${weakestGrappe.grappeKey} (${weakestGrappe.menageCount} ménages)\n`);

    // Lot B - M. BAMBA NDOA (une grappe Kaffrine + une grappe Tambacounda)
    console.log('Lot B - M. BAMBA NDOA:');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: bambaKaffrine.grappeKey,
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log(`  ✓ Assigné à ${bambaKaffrine.grappeKey} (${bambaKaffrine.menageCount} ménages)`);

    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'B',
        grappeKey: bambaTamba.grappeKey,
        mode: 'individuel',
        entreprise: 'BAMBA NDOA',
        societe: 'BAMBA NDOA'
      }
    });
    console.log(`  ✓ Assigné à ${bambaTamba.grappeKey} (${bambaTamba.menageCount} ménages)\n`);

    // Lot C - Mme FATOU THIAM (tout Kaffrine)
    console.log('Lot C - Mme FATOU THIAM (tout Kaffrine):');
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
    const finalGrappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true },
      orderBy: { grappeKey: 'asc' }
    });

    let finalKaffrineTotal = 0;
    let finalTambacoundaTotal = 0;

    console.log('\nGrappes finales:');
    finalGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages (${g.region.name})`);
      if (g.region.code === 'KAF') finalKaffrineTotal += g.menageCount;
      if (g.region.code === 'TAM') finalTambacoundaTotal += g.menageCount;
    });

    console.log(`\nTotaux par région:`);
    console.log(`  Kaffrine: ${finalKaffrineTotal} ménages (attendu: ${kaffrineTotal})`);
    console.log(`  Tambacounda: ${finalTambacoundaTotal} ménages (attendu: ${tambacoundaTotal})`);
    console.log(`  Grand total: ${finalKaffrineTotal + finalTambacoundaTotal} ménages (attendu: ${totalMenages})`);

    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId },
      orderBy: [{ lot: 'asc' }, { entreprise: 'asc' }]
    });

    console.log('\nEntrepreneurs créés:');
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
          console.log(`  ${e.entreprise}: ${e.grappeKey}`);
        }
      });
    });

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reconfigureGrappesEntrepreneurs();