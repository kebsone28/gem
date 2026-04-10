import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'Household';
    `);
        console.log(JSON.stringify(indexes, null, 2));
    } catch (error) {
        console.error('Error fetching indexes:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
