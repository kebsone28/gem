
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Legacy Households Sample ---');
    const households = await prisma.$queryRaw`SELECT * FROM households LIMIT 3`;
    console.log(JSON.stringify(households, null, 2));
}

main().finally(() => prisma.$disconnect());
