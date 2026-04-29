
import { PrismaClient } from '@prisma/client';
import { readFirstSheetJson } from './src/utils/safeExcel.js';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting XLS Import from Liste-LSE.xlsx...');

    const ORG_ID = 'a607ff88-e28d-4194-b42a-77f364050e5e';
    const PROJECT_ID = 'project_lse';
    const filePath = 'c:/Mes-Sites-Web/GEM_SAAS/archive/Liste/Liste-LSE.xlsx';

    // 1. Clear existing households to start fresh with the correct list
    console.log('🧹 Clearing old households...');
    await prisma.household.deleteMany({
        where: { organizationId: ORG_ID }
    });

    // 2. Read Excel
    const data = await readFirstSheetJson(filePath);
    console.log(`📊 Found ${data.length} households in Excel.`);

    const zoneMap = new Map();
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
        try {
            // Zone mapping logic
            const zoneName = row['village'] || row['commune'] || row['region'] || 'Zone Inconnue';
            let zoneId;
            const zoneKey = zoneName.toLowerCase().replace(/[^a-z0-9]/g, '_');

            if (zoneMap.has(zoneKey)) {
                zoneId = zoneMap.get(zoneKey);
            } else {
                const zone = await prisma.zone.upsert({
                    where: { id: `zone_${zoneKey}` },
                    update: { name: zoneName },
                    create: {
                        id: `zone_${zoneKey}`,
                        name: zoneName,
                        projectId: PROJECT_ID,
                        organizationId: ORG_ID
                    }
                });
                zoneId = zone.id;
                zoneMap.set(zoneKey, zoneId);
            }

            const rawOrder = String(row['Numero_ordre']).trim();
            const householdId = rawOrder; // L'ID devient le numéro propre
            const latitude = parseFloat(row['latitude']);
            const longitude = parseFloat(row['longitude']);

            await prisma.household.upsert({
                where: { id: householdId },
                update: {
                    numeroordre: rawOrder,
                    name: row['Prénom et Nom'] || 'Inconnu',
                    phone: String(row['Telephone'] || ''),
                    region: row['region'] || null,
                    departement: row['departement'] || null,
                    village: row['village'] || row['commune'] || null,
                    status: 'Non encore installée',
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    owner: {
                        name: row['Prénom et Nom'] || 'Inconnu',
                        phone: String(row['Telephone'] || '')
                    },
                    koboData: {
                        region: row['region'],
                        departement: row['departement'],
                        commune: row['commune'],
                        village: row['village'],
                        photo: row['photo']
                    },
                    updatedAt: new Date()
                },
                create: {
                    id: householdId,
                    numeroordre: rawOrder,
                    name: row['Prénom et Nom'] || 'Inconnu',
                    phone: String(row['Telephone'] || ''),
                    region: row['region'] || null,
                    departement: row['departement'] || null,
                    village: row['village'] || row['commune'] || null,
                    zoneId: zoneId,
                    organizationId: ORG_ID,
                    status: 'Non encore installée',
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    owner: {
                        name: row['Prénom et Nom'] || 'Inconnu',
                        phone: String(row['Telephone'] || '')
                    },
                    version: 1,
                    koboData: {
                        region: row['region'],
                        departement: row['departement'],
                        commune: row['commune'],
                        village: row['village'],
                        photo: row['photo']
                    }
                }
            });

            successCount++;
            if (successCount % 500 === 0) console.log(`✅ Processed ${successCount} households...`);

        } catch (e) {
            console.error(`❌ Error logic:`, e.message);
            errorCount++;
        }
    }

    console.log(`\n🎉 XLS Import finished!`);
    console.log(`✨ Success: ${successCount}`);
    console.log(`⚠️ Errors: ${errorCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
