import prisma from './src/core/utils/prisma.js';

async function test() {
    try {
        console.log('=== Current DB State ===\n');
        
        // Check current households
        const households = await prisma.household.findMany({
            select: {
                id: true,
                phone: true,
                region: true,
                source: true,
                name: true,
                status: true,
                koboData: true
            }
        });

        console.log(`Total households: ${households.length}\n`);
        households.forEach(h => {
            console.log(`ID: ${h.id.substring(0, 8)}...`);
            console.log(`  Phone: ${h.phone}`);
            console.log(`  Region: ${h.region}`);
            console.log(`  Source: ${h.source || 'null'}`);
            console.log(`  Name: ${h.name || 'null'}`);
            console.log(`  Status: ${h.status || 'null'}`);
            console.log(`  Has koboData: ${!!h.koboData}\n`);
        });

        // Now simulate a Kobo submission for the first household
        if (households.length > 0) {
            const target = households[0];
            console.log(`\n=== Simulating Kobo Update ===`);
            console.log(`Target: phone=${target.phone}, region=${target.region}`);
            
            const result = await prisma.household.upsert({
                where: { 
                    id: '99999999-9999-9999-9999-999999999999'  // Non-existent Kobo id
                },
                update: {
                    status: 'UPDATED BY KOBO TEST',
                    source: 'Kobo',
                    koboData: { 
                        _id: 'test_kobo_123',
                        _submission_time: new Date().toISOString()
                    },
                    updatedAt: new Date()
                },
                create: {
                    id: '99999999-9999-9999-9999-999999999999',
                    phone: target.phone,
                    region: target.region,
                    status: 'CREATED BY KOBO TEST',
                    source: 'Kobo',
                    koboData: { 
                        _id: 'test_kobo_123',
                        _submission_time: new Date().toISOString()
                    },
                    organizationId: 'test-org',
                    zoneId: 'test-zone',
                    version: 1
                }
            });

            console.log(`\nResult: ${result.id === target.id ? '✅ MATCHED & UPDATED' : '❌ CREATED NEW'}`);

            // Verify final state
            const finalCount = await prisma.household.count();
            console.log(`Final household count: ${finalCount}`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
