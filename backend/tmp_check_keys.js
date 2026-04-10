import 'dotenv/config';
import prisma from './src/core/utils/prisma.js';

async function check() {
    const h = await prisma.household.findFirst({
        where: { source: 'Kobo' }
    });
    if (h) {
        console.log("KEYS FOUND IN KOBO DATA:");
        console.log(Object.keys(h.koboData).join('\n'));
        console.log("\nSAMPLE DATA:");
        console.log(JSON.stringify(h.koboData, null, 2));
    } else {
        console.log("No Kobo household found.");
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
