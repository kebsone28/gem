import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const projects = await prisma.project.findMany();
  if (projects.length === 0) {
    const org = await prisma.organization.findFirst();
    const p = await prisma.project.create({
      data: { id: 'test-project', name: 'PROJET TEST GEM', organizationId: org.id, status: 'active', budget: 1000000, duration: 12, totalHouses: 1000, config: {} }
    });
    console.log('Project ID:', p.id);
  } else {
    console.log('Project ID:', projects[0].id);
  }
}
main().finally(() => prisma.$disconnect());
