import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.household.count();
    const withGis = await prisma.household.count({
        where: { location_gis: { not: null } }
    });
    console.log(`Total Households: ${count}`);
    console.log(`Households with GIS: ${withGis}`);

    if (count > 0) {
        const samples = await prisma.household.findMany({ take: 3 });
        console.log('Sample IDs:', samples.map(s => s.id));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
