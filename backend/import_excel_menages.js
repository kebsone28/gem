import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import prisma from './src/core/utils/prisma.js';

async function importExcelMenages() {
  try {
    console.log('=== Importation des ménages depuis Liste-LSE.xlsx ===\n');

    const excelPath = 'C:\\Mes-Sites-Web\\GED_SAAS\\docs\\Liste-LSE.xlsx';
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Fichier non trouvé: ${excelPath}`);
      return;
    }

    console.log(`Lecture du fichier: ${excelPath}`);
    
    // Lire le fichier Excel
    const workbook = xlsx.readFile(excelPath);
    const sheetNames = workbook.SheetNames;
    
    console.log(`Feuilles trouvées: ${sheetNames.join(', ')}`);
    
    // Lire la première feuille
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(firstSheet);
    
    console.log(`Total enregistrements dans Excel: ${jsonData.length}`);
    
    // Afficher les premiers enregistrements pour comprendre la structure
    console.log('\nStructure des données (5 premiers enregistrements):');
    jsonData.slice(0, 5).forEach((row, index) => {
      console.log(`\nEnregistrement ${index + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
    });

    // Chercher des colonnes qui pourraient contenir des informations de grappe
    console.log('\nColonnes disponibles:');
    const allColumns = new Set();
    jsonData.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });
    console.log(Array.from(allColumns).join(', '));

    // Regarder les données par région si disponibles
    if (jsonData.length > 0) {
      console.log('\n=== Analyse des données ===');
      
      // Chercher des colonnes potentielles pour région, grappe, village
      const regionColumn = Array.from(allColumns).find(col => 
        col.toLowerCase().includes('region') || 
        col.toLowerCase().includes('région')
      );
      
      const grappeColumn = Array.from(allColumns).find(col => 
        col.toLowerCase().includes('grappe')
      );
      
      const villageColumn = Array.from(allColumns).find(col => 
        col.toLowerCase().includes('village')
      );
      
      const numeroColumn = Array.from(allColumns).find(col => 
        col.toLowerCase().includes('numero') || 
        col.toLowerCase().includes('numéro') ||
        col.toLowerCase().includes('ordre')
      );

      console.log(`Colonne région: ${regionColumn || 'Non trouvée'}`);
      console.log(`Colonne grappe: ${grappeColumn || 'Non trouvée'}`);
      console.log(`Colonne village: ${villageColumn || 'Non trouvée'}`);
      console.log(`Colonne numéro: ${numeroColumn || 'Non trouvée'}`);

      // Si on trouve une colonne région, faire une analyse
      if (regionColumn) {
        const byRegion = {};
        jsonData.forEach(row => {
          const region = row[regionColumn];
          if (region) {
            byRegion[region] = (byRegion[region] || 0) + 1;
          }
        });
        console.log('\nRépartition par région:');
        Object.entries(byRegion).forEach(([region, count]) => {
          console.log(`  ${region}: ${count} ménages`);
        });
      }

      // Si on trouve une colonne grappe, faire une analyse
      if (grappeColumn) {
        const byGrappe = {};
        jsonData.forEach(row => {
          const grappe = row[grappeColumn];
          if (grappe) {
            byGrappe[grappe] = (byGrappe[grappe] || 0) + 1;
          }
        });
        console.log('\nRépartition par grappe:');
        Object.entries(byGrappe).forEach(([grappe, count]) => {
          console.log(`  ${grappe}: ${count} ménages`);
        });
      }
    }

    console.log(`\n📊 Total: ${jsonData.length} ménages dans le fichier Excel`);
    console.log(`📊 Actuel dans grappes.json: 3535 ménages`);
    console.log(`📊 Différence: ${jsonData.length - 3535} ménages`);

  } catch (error) {
    console.error('Erreur lors de l\'importation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importExcelMenages();