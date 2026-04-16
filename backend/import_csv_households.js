
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting CSV Import to modern Household model...');

    const ORG_ID = 'org_test_2026';
    const PROJECT_ID = 'proj_test_2026';
    const csvPath = 'c:/Mes-Sites-Web/GEM_SAAS/KOBO/liste_menages.csv';

    if (!fs.existsSync(csvPath)) {
        console.error('❌ CSV file not found:', csvPath);
        return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    console.log(`📊 Found ${lines.length} lines in CSV.`);

    const zoneMap = new Map();

    let successCount = 0;
    let errorCount = 0;

    // Skip header (code_key;nom;telephone;latitude;longitude;region)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(';');
        if (parts.length < 6) continue;

        const [code, name, phone, lat, lon, region] = parts;

        try {
            const zoneName = region || 'Tambacounda';
            let zoneId;
            if (zoneMap.has(zoneName)) {
                zoneId = zoneMap.get(zoneName);
            } else {
                const zone = await prisma.zone.upsert({
                    where: { id: `zone_${zoneName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` },
                    update: {},
                    create: {
                        id: `zone_${zoneName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                        name: zoneName,
                        projectId: PROJECT_ID,
                        organizationId: ORG_ID
                    }
                });
                zoneId = zone.id;
                zoneMap.set(zoneName, zoneId);
            }

            const rawOrder = code.trim();
            const householdId = rawOrder;
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);

            await prisma.household.upsert({
                where: { id: householdId },
                update: {
                    numeroordre: rawOrder,
                    status: 'Non débuté',
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    owner: { name: name || 'Propriétaire Inconnu', phone: phone || '' },
                    updatedAt: new Date()
                },
                create: {
                    id: householdId,
                    numeroordre: rawOrder,
                    zoneId: zoneId,
                    organizationId: ORG_ID,
                    status: 'Non débuté',
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    owner: { name: name || 'Propriétaire Inconnu', phone: phone || '' },
                    version: 1,
                    koboData: {
                        region: region,
                        original_code: code
                    }
                }
            });

            successCount++;
            if (successCount % 500 === 0) console.log(`✅ Imported ${successCount} households...`);

        } catch (e) {
            // console.error(`❌ Error line ${i}:`, e.message);
            errorCount++;
        }
    }

    console.log(`\n🎉 Import finished!`);
    console.log(`✨ Success: ${successCount}`);
    console.log(`⚠️ Errors: ${errorCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
