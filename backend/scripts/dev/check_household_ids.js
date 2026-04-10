import prisma from './src/core/utils/prisma.js';

async function check() {
    try {
        // Get a mix of manual and Kobo households
        const households = await prisma.household.findMany({
            take: 10,
            select: {
                id: true,
                phone: true,
                name: true,
                source: true,
                region: true,
                koboData: true
            }
        });

        console.log('=== Sample Households ===');
        households.forEach(h => {
            console.log('\n--- Household ---');
            console.log('ID:', h.id);
            console.log('Phone:', h.phone);
            console.log('Name:', h.name);
            console.log('Source:', h.source);
            console.log('Region:', h.region);
            if (h.koboData && h.koboData._id) {
                console.log('Kobo _id:', h.koboData._id);
            }
        });

        // Group by source to understand patterns
        const bySource = await prisma.household.groupBy({
            by: ['source'],
            _count: true
        });

        console.log('\n=== Households by Source ===');
        bySource.forEach(g => {
            console.log(`${g.source}: ${g._count}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
