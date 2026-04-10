import prisma from './src/core/utils/prisma.js';

async function check() {
    const households = await prisma.household.findMany({
        where: { source: 'Kobo' },
        select: {
            id: true,
            name: true,
            phone: true,
            latitude: true,
            longitude: true,
            region: true,
            koboSubmissionId: true,
            koboData: true
        }
    });
    
    console.log('=== Ménages Kobo ===\n');
    households.forEach(h => {
        console.log(`ID: ${h.id.substring(0, 8)}...`);
        console.log(`  Name: ${h.name}`);
        console.log(`  Coords: [${h.latitude}, ${h.longitude}]`);
        console.log(`  Region: ${h.region}`);
        if (h.koboData && h.koboData._geolocation) {
            console.log(`  Kobo geo: ${h.koboData._geolocation}`);
        }
        console.log();
    });
    
    await prisma.$disconnect();
}

check();
