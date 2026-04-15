import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.household.findMany({
    where: {
      OR: [
        { numeroordre: { contains: '4526' } },
        { id: { contains: '4526' } }
      ]
    },
    select: {
      id: true,
      numeroordre: true,
      status: true,
      koboSync: true,
      constructionData: true,
      location: true
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
