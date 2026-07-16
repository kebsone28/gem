import prisma from './src/core/utils/prisma.js';
import fs from 'fs';
import path from 'path';

async function importRealGrappesData() {
  try {
    console.log('=== Importation des données réelles de grappes depuis grappes.json ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Lire le fichier grappes.json
    const grappesJsonPath = path.join('..', 'frontend', 'public', 'assets', 'images', 'grappes.json');
    const grappesData = JSON.parse(fs.readFileSync(grappesJsonPath, 'utf8'));

    console.log(`Total ménages dans grappes.json: ${grappesData.total_menages}`);
    console.log(`Nombre de grappes: ${grappesData.grappes.length}\n`);

    // Récupérer les régions existantes
    const kaffrineRegion = await prisma.cartoRegion.findFirst({
      where: { organizationId, code: 'KAF' }
    });

    const tambacoundaRegion = await prisma.cartoRegion.findFirst({
      where: { organizationId, code: 'TAM' }
    });

    if (!kaffrineRegion || !tambacoundaRegion) {
      console.error('❌ Régions KAF ou TAM non trouvées');
      return;
    }

    console.log('Régions trouvées:');
    console.log(`  Kaffrine: ${kaffrineRegion.name} (ID: ${kaffrineRegion.id})`);
    console.log(`  Tambacounda: ${tambacoundaRegion.name} (ID: ${tambacoundaRegion.id})\n`);

    // Supprimer les grappes existantes
    console.log('Suppression des grappes existantes...');
    await prisma.cartoGrappe.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Grappes existantes supprimées\n');

    // Créer les nouvelles grappes avec les données réelles
    console.log('Création des grappes avec les données réelles:');
    
    for (const grappeInfo of grappesData.grappes) {
      const regionId = grappeInfo.region === 'Kaffrine' ? kaffrineRegion.id : 
                      grappeInfo.region === 'Tambacounda' ? tambacoundaRegion.id : null;
      
      if (!regionId) {
        console.log(`⚠️  Région non trouvée pour ${grappeInfo.nom}, skipping...`);
        continue;
      }

      const regionCode = grappeInfo.region === 'Kaffrine' ? 'KAF' : 
                        grappeInfo.region === 'Tambacounda' ? 'TAM' : 'XXX';
      
      const grappeKey = `${regionCode}_G${String(grappeInfo.numero).padStart(3, '0')}`;

      const newGrappe = await prisma.cartoGrappe.create({
        data: {
          organizationId,
          regionId,
          grappeNumber: grappeInfo.numero,
          grappeKey,
          menageCount: grappeInfo.nb_menages,
          active: true
        }
      });

      console.log(`✓ ${grappeInfo.nom} (${grappeKey}): ${grappeInfo.nb_menages} ménages`);
    }

    // Vérifier les résultats
    console.log('\n=== Vérification après importation ===');
    const updatedRegions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      include: {
        grappes: {
          orderBy: { grappeNumber: 'asc' }
        }
      }
    });

    let grandTotal = 0;
    for (const region of updatedRegions) {
      console.log(`\n${region.name}:`);
      let regionTotal = 0;
      for (const grappe of region.grappes) {
        console.log(`  ${grappe.grappeKey}: ${grappe.menageCount} ménages`);
        regionTotal += grappe.menageCount;
      }
      console.log(`  Total: ${regionTotal} ménages`);
      grandTotal += regionTotal;
    }
    
    console.log(`\n📊 Grand total: ${grandTotal} ménages`);
    console.log(`📊 Attendu: ${grappesData.total_menages} ménages`);
    console.log(`✅ ${grandTotal === grappesData.total_menages ? 'Les totaux correspondent !' : 'Écart détecté'}`);

  } catch (error) {
    console.error('Erreur lors de l\'importation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importRealGrappesData();