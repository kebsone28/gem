
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.$queryRaw`SELECT count(*) FROM households`;
        console.log('Legacy households count:', count);
    } catch (e) {
        console.log('Legacy households table MISSING:', e.message);
    }
}

main().finally(() => prisma.$disconnect());
