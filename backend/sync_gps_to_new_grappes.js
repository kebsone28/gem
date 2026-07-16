import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import prisma from './src/core/utils/prisma.js';

async function syncGpsToNewGrappes() {
  try {
    console.log('=== Synchronisation GPS avec nouvelles grappes ===\n');

    const excelPath = 'C:\\Mes-Sites-Web\\GED_SAAS\\docs\\Liste-LSE.xlsx';
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Fichier non trouvé: ${excelPath}`);
      return;
    }

    console.log(`Lecture du fichier: ${excelPath}`);
    
    // Lire le fichier Excel
    const workbook = xlsx.readFile(excelPath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(firstSheet);
    
    console.log(`Total enregistrements dans Excel: ${jsonData.length}`);

    // Organiser les données par région et grappe
    const regionGrappeMap = {
      'Kaffrine': {},
      'Tambacounda': {}
    };

    // Configuration des grappes selon la nouvelle structure
    const grappeConfig = {
      'Kaffrine': [
        { key: 'KAF_G001', minOrdre: 1, maxOrdre: 360 },
        { key: 'KAF_G002', minOrdre: 361, maxOrdre: 725 },
        { key: 'KAF_G003', minOrdre: 726, maxOrdre: 1090 },
        { key: 'KAF_G004', minOrdre: 1091, maxOrdre: 1455 },
        { key: 'KAF_G005', minOrdre: 1456, maxOrdre: 1820 },
        { key: 'KAF_G006', minOrdre: 1821, maxOrdre: 2185 }
      ],
      'Tambacounda': [
        { key: 'TAM_G001', minOrdre: 1, maxOrdre: 450 },
        { key: 'TAM_G002', minOrdre: 451, maxOrdre: 900 },
        { key: 'TAM_G003', minOrdre: 901, maxOrdre: 1351 }
      ]
    };

    // Initialiser les maps
    Object.keys(grappeConfig).forEach(region => {
      grappeConfig[region].forEach(grappe => {
        regionGrappeMap[region][grappe.key] = [];
      });
    });

    // Assigner chaque ménage à une grappe selon son numéro d'ordre
    let assignedCount = 0;
    jsonData.forEach((row) => {
      const ordre = parseInt(row.Numero_ordre);
      const region = row.region;
      
      if (!region || isNaN(ordre)) return;

      const regionKey = region === 'Kaffrine' ? 'Kaffrine' : 
                     region === 'Tambacounda' ? 'Tambacounda' : null;
      
      if (!regionKey) return;

      // Trouver la grappe appropriée
      const grappes = grappeConfig[regionKey];
      const targetGrappe = grappes.find(g => ordre >= g.minOrdre && ordre <= g.maxOrdre);
      
      if (targetGrappe) {
        regionGrappeMap[regionKey][targetGrappe.key].push({
          ordre,
          grappeKey: targetGrappe.key,
          latitude: row.latitude,
          longitude: row.longitude,
          village: row.village
        });
        assignedCount++;
      }
    });

    console.log(`\nMénages assignés: ${assignedCount}/${jsonData.length}`);

    // Afficher la distribution
    console.log('\nDistribution par grappe:');
    Object.keys(regionGrappeMap).forEach(region => {
      console.log(`\n${region}:`);
      Object.entries(regionGrappeMap[region]).forEach(([grappeKey, menages]) => {
        console.log(`  ${grappeKey}: ${menages.length} ménages`);
      });
    });

    // Maintenant, créer les enregistrements GPS pour chaque grappe
    console.log('\n=== Création des enregistrements GPS ===');
    
    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836';
    
    // Récupérer les grappes existantes
    const existingGrappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    console.log(`Grappes existantes dans la base: ${existingGrappes.length}`);

    // Pour chaque grappe, créer les données GPS
    for (const grappe of existingGrappes) {
      const regionName = grappe.region.name;
      const regionKey = regionName === 'Kaffrine' ? 'Kaffrine' : 
                        regionName === 'Tambacounda' ? 'Tambacounda' : null;
      
      if (!regionKey) continue;

      const menagesForGrappe = regionGrappeMap[regionKey][grappe.grappeKey] || [];
      
      if (menagesForGrappe.length > 0) {
        console.log(`\n${grappe.grappeKey} (${regionName}): ${menagesForGrappe.length} ménages`);
        
        // Calculer le centroïde GPS pour cette grappe
        const validCoords = menagesForGrappe
          .filter(m => m.latitude && m.longitude)
          .map(m => [parseFloat(m.latitude), parseFloat(m.longitude)]);
        
        if (validCoords.length > 0) {
          const centroidLat = validCoords.reduce((sum, coord) => sum + coord[0], 0) / validCoords.length;
          const centroidLon = validCoords.reduce((sum, coord) => sum + coord[1], 0) / validCoords.length;
          
          console.log(`  Centroïde GPS: ${centroidLat.toFixed(6)}, ${centroidLon.toFixed(6)}`);
          
          // Ici, on pourrait mettre à jour les coordonnées GPS de la grappe si nécessaire
          // ou créer des enregistrements de ménages avec les coordonnées GPS
        }
      }
    }

    console.log('\n✅ Synchronisation GPS terminée');

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncGpsToNewGrappes();