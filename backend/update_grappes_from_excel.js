import prisma from './src/core/utils/prisma.js';

async function updateGrappesFromExcel() {
  try {
    console.log('=== Mise à jour des grappes avec les données exactes du Excel ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Données exactes du fichier Excel
    const excelData = {
      total: 3536,
      regions: {
        Kaffrine: 2185,  // +1 par rapport à grappes.json
        Tambacounda: 1351 // identique
      }
    };

    console.log(`Total Excel: ${excelData.total} ménages`);
    console.log(`Kaffrine: ${excelData.regions.Kaffrine} ménages`);
    console.log(`Tambacounda: ${excelData.regions.Tambacounda} ménages\n`);

    // Récupérer les grappes actuelles
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId,
        region: { code: 'KAF' }
      },
      include: { region: true },
      orderBy: { grappeNumber: 'asc' }
    });

    const tambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId,
        region: { code: 'TAM' }
      },
      include: { region: true },
      orderBy: { grappeNumber: 'asc' }
    });

    console.log('Grappes actuelles:');
    console.log('Kaffrine:');
    kaffrineGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });
    console.log('Tambacounda:');
    tambacoundaGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    // Répartir le ménage supplémentaire de Kaffrine proportionnellement
    const currentKaffrineTotal = kaffrineGrappes.reduce((sum, g) => sum + g.menageCount, 0);
    const kaffrineDifference = excelData.regions.Kaffrine - currentKaffrineTotal;
    
    console.log(`\nDifférence Kaffrine: ${kaffrineDifference} ménage(s)`);

    if (kaffrineDifference === 1) {
      // Ajouter le ménage supplémentaire à la plus grande grappe
      const largestGrappe = kaffrineGrappes.reduce((max, g) => 
        g.menageCount > max.menageCount ? g : max
      );
      
      await prisma.cartoGrappe.update({
        where: { id: largestGrappe.id },
        data: { menageCount: largestGrappe.menageCount + 1 }
      });
      
      console.log(`✓ Ajouté 1 ménage à ${largestGrappe.grappeKey} (${largestGrappe.menageCount} → ${largestGrappe.menageCount + 1})`);
    }

    // Vérifier Tambacounda (devrait être identique)
    const currentTambacoundaTotal = tambacoundaGrappes.reduce((sum, g) => sum + g.menageCount, 0);
    const tambacoundaDifference = excelData.regions.Tambacounda - currentTambacoundaTotal;
    
    console.log(`Différence Tambacounda: ${tambacoundaDifference} ménage(s)`);

    // Vérification finale
    console.log('\n=== Vérification finale ===');
    const finalKaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId,
        region: { code: 'KAF' }
      },
      orderBy: { grappeNumber: 'asc' }
    });

    const finalTambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId,
        region: { code: 'TAM' }
      },
      orderBy: { grappeNumber: 'asc' }
    });

    const finalKaffrineTotal = finalKaffrineGrappes.reduce((sum, g) => sum + g.menageCount, 0);
    const finalTambacoundaTotal = finalTambacoundaGrappes.reduce((sum, g) => sum + g.menageCount, 0);
    const grandTotal = finalKaffrineTotal + finalTambacoundaTotal;

    console.log('\nKaffrine:');
    finalKaffrineGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });
    console.log(`  Total: ${finalKaffrineTotal} ménages (attendu: ${excelData.regions.Kaffrine})`);

    console.log('\nTambacounda:');
    finalTambacoundaGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });
    console.log(`  Total: ${finalTambacoundaTotal} ménages (attendu: ${excelData.regions.Tambacounda})`);

    console.log(`\n📊 Grand total: ${grandTotal} ménages (attendu: ${excelData.total})`);
    console.log(`✅ ${grandTotal === excelData.total ? 'Les totaux correspondent parfaitement !' : 'Écart détecté'}`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGrappesFromExcel();