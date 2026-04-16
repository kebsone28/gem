/**
 * prisma/seed_households.js
 * 
 * ONE-TIME IMPORT: Reads Liste-LSE.xlsx and populates the Household table.
 * Designed to run once during initial setup.
 * After this, the DATABASE is the SINGLE SOURCE OF TRUTH.
 */

import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Excel file is located in the root archive folder, not in backend
const EXCEL_PATH = path.resolve(__dirname, '../../archive/Liste/Liste-LSE.xlsx');

async function seedHouseholds() {
  try {
    console.log('🌱 Starting household seed from Excel...');

    // Check if households already exist
    const existingCount = await prisma.household.count();
    if (existingCount > 10) {
      console.log('✅ Database already populated with households. Skipping import.');
      return;
    }

    // Find or create PROQUELEC organization
    let org = await prisma.organization.findFirst({
      where: { name: 'PROQUELEC' }
    });
    
    if (!org) {
      org = await prisma.organization.create({
        data: { name: 'PROQUELEC' }
      });
    }
    console.log(`✅ Organization: ${org.id}`);

    // Find or create default project
    let project = await prisma.project.findUnique({
      where: { id: 'project_lse' }
    });
    
    if (!project) {
      project = await prisma.project.create({
        data: {
          id: 'project_lse',
          name: 'Projet LSE - Électrification',
          organizationId: org.id,
          status: 'ACTIVE',
          budget: 10000000,
          duration: 24,
          totalHouses: 10000,
          config: {}
        }
      });
    }
    console.log(`✅ Project: ${project.id}`);

    // Read Excel file
    console.log(`📂 Reading Excel: ${EXCEL_PATH}`);
    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`📊 Found ${data.length} households in Excel`);

    const zoneMap = new Map();
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Extract zone/commune info
        const zoneName = row['commune'] || row['village'] || row['region'] || 'Zone Inconnue';
        const zoneKey = `zone_${zoneName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}`;

        let zoneId;
        if (zoneMap.has(zoneKey)) {
          zoneId = zoneMap.get(zoneKey);
        } else {
          const zone = await prisma.zone.upsert({
            where: { id: zoneKey },
            update: { name: zoneName },
            create: {
              id: zoneKey,
              name: zoneName,
              projectId: project.id,
              organizationId: org.id
            }
          });
          zoneId = zone.id;
          zoneMap.set(zoneKey, zoneId);
        }

        // Extract household data
        const numeroOrdre = String(row['Numero_ordre'] || row['Numero ordem'] || '').trim();
        if (!numeroOrdre) continue;

        const householdId = `HHOLD-${numeroOrdre.padStart(5, '0')}`;
        const latitude = parseFloat(row['latitude']) || null;
        const longitude = parseFloat(row['longitude']) || null;

        const owner = {
          name: row['Prénom et Nom'] || row['Nom'] || 'Unknown',
          phone: String(row['Telephone'] || row['Phone'] || '').trim() || null
        };

        const location = latitude && longitude
          ? { type: 'Point', coordinates: [longitude, latitude] }
          : null;

        // UPSERT household (idempotent - won't duplicate if exists)
        await prisma.household.upsert({
          where: { id: householdId },
          update: {
            zoneId,
            owner,
            location,
            koboData: {
              region: row['region'] || null,
              departement: row['departement'] || null,
              commune: row['commune'] || null,
              village: row['village'] || null
            },
            updatedAt: new Date()
          },
          create: {
            id: householdId,
            zoneId,
            organizationId: org.id,
            status: 'Non débuté',
            owner,
            location,
            version: 1,
            koboData: {
              region: row['region'] || null,
              departement: row['departement'] || null,
              commune: row['commune'] || null,
              village: row['village'] || null
            }
          }
        });

        successCount++;
        if (successCount % 500 === 0) {
          console.log(`  ✅ Processed ${successCount} households...`);
        }
      } catch (err) {
        errorCount++;
        if (errorCount <= 5) {
          console.error(`  ❌ Error on row ${successCount + 1}:`, err.message);
        }
      }
    }

    console.log(`\n🎉 Seed Complete!`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ⚠️  Errors: ${errorCount}`);

    // Final verification
    const finalCount = await prisma.household.count();
    console.log(`\n📊 Database now contains ${finalCount} households`);
    console.log('✅ Database is now the SINGLE SOURCE OF TRUTH for households');

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedHouseholds();
