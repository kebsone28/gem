import prisma from './src/core/utils/prisma.js';
import { syncKoboToDatabase } from './src/services/kobo.service.js';

async function test() {
    try {
        console.log('=== Testing Kobo UPSERT Strategy ===\n');

        // Get initial state
        const initialCount = await prisma.household.count();
        console.log(`Initial household count: ${initialCount}`);

        // Get existing households to understand ID structure
        const existingHouseholds = await prisma.household.findMany({
            select: { id: true, phone: true, region: true, source: true }
        });

        if (existingHouseholds.length > 0) {
            console.log(`\nExisting households:`);
            existingHouseholds.forEach(h => {
                console.log(`  - phone=${h.phone}, region=${h.region}, source=${h.source || 'null'}`);
            });
        }

        // Now try syncing from Kobo
        console.log('\n--- Starting Kobo Sync ---');
        // Assuming we have an organizationId and fallbackZoneId from somewhere
        // For testing, we'd need to provide valid values
        const orgId = process.env.TEST_ORG_ID || 'default-org';
        const zoneId = process.env.TEST_ZONE_ID || null;

        // Check if zone exists
        let zone = null;
        if (zoneId) {
            zone = await prisma.zone.findUnique({ where: { id: zoneId } });
        }

        if (!zone) {
            // Use first available zone
            zone = await prisma.zone.findFirst();
            if (!zone) {
                console.log('No zones found - creating test zone...');
                zone = await prisma.zone.create({
                    data: {
                        name: 'Test Zone',
                        projectId: 'test-project'
                    }
                });
            }
        }

        console.log(`Using zone: ${zone.id} (${zone.name})`);

        // Call the actual sync function
        try {
            const result = await syncKoboToDatabase(orgId, zone.id);
            console.log(`\nSync result:`, result);
        } catch (e) {
            console.log(`Sync error (may be expected if Kobo not configured): ${e.message}`);
        }

        // Check final state
        const finalCount = await prisma.household.count();
        console.log(`\nFinal household count: ${finalCount}`);
        console.log(`Change: ${finalCount - initialCount > 0 ? '+' : ''}${finalCount - initialCount}`);

        // Show updated households
        const updatedHouseholds = await prisma.household.findMany({
            where: { source: 'Kobo' },
            select: { id: true, phone: true, region: true, status: true, updatedAt: true }
        });

        if (updatedHouseholds.length > 0) {
            console.log(`\nKobo-synced households (${updatedHouseholds.length}):`);
            updatedHouseholds.forEach(h => {
                console.log(`  - phone=${h.phone}, region=${h.region}, status=${h.status}`);
                console.log(`    Updated: ${h.updatedAt}`);
            });
        } else {
            console.log(`\nNo households with source='Kobo' found`);
        }

    } catch (e) {
        console.error('Test error:', e.message);
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
