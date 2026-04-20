import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  try {
    const org = await prisma.organization.findFirst();
    const projectId = "project_lse";
    console.log("Org ID:", org.id);
    const unclassifiedRegions = await prisma.household.groupBy({
        by: ['region'],
        where: {
            organizationId: org.id,
            zone: { projectId },
            grappeId: null,
            deletedAt: null
        },
        _count: true
    });
    console.log('SUCCESS Result:', unclassifiedRegions);
  } catch(e) {
    console.log('ERROR:', e.stack);
  } finally {
    await prisma.$disconnect();
  }
}
test();
