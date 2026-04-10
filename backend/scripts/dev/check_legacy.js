
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Legacy Projects ---');
    const projects = await prisma.$queryRaw`SELECT * FROM projects`;
    console.log(JSON.stringify(projects, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    console.log('\n--- Legacy Zones Sample ---');
    const zones = await prisma.$queryRaw`SELECT * FROM zones LIMIT 5`;
    console.log(JSON.stringify(zones, null, 2));
}

main().finally(() => prisma.$disconnect());
