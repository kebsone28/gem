import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const teams = await prisma.team.count();
    const households = await prisma.household.count();
    const logs = await prisma.performanceLog.count();
    console.log(`Teams: ${teams}, Households: ${households}, Logs: ${logs}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
