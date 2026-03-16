const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const h = await prisma.household.findFirst({});
  console.log(JSON.stringify(h, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
