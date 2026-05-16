import { basePrisma as prisma } from './core/utils/prisma.js';

async function main() {
  const projects = await prisma.project.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      config: true
    }
  });

  console.log(JSON.stringify(projects, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
