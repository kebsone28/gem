import { basePrisma as prisma } from './core/utils/prisma.js';

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      name: {
        contains: 'GED OS',
        mode: 'insensitive'
      }
    }
  });

  const projects = await prisma.project.findMany({
    where: {
      name: {
        contains: 'GED OS',
        mode: 'insensitive'
      }
    }
  });

  console.log('Orgs with GED OS:', JSON.stringify(orgs.map(o => ({ id: o.id, name: o.name })), null, 2));
  console.log('Projects with GED OS:', JSON.stringify(projects.map(p => ({ id: p.id, name: p.name })), null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
