import prisma from './src/core/utils/prisma.js';

async function checkData() {
    const householdCount = await prisma.household.count();
    const projects = await prisma.project.findMany({
        select: { id: true, name: true, totalHouses: true }
    });
    console.log(`\n--- DATA STATS ---`);
    console.log(`Total Households: ${householdCount}`);
    console.log(`Projects:`, JSON.stringify(projects, null, 2));
}

checkData().catch(console.error);
