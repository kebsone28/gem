
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const columns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Zone'
    `;
    console.log('Columns in table Zone:', columns);
}

main().finally(() => prisma.$disconnect());
