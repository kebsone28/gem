const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const res = await prisma.household.groupBy({
      by: ['grappeId', 'status'],
      where: { organizationId: '123' },
      _count: {
        _all: true
      }
    });
    console.log('SUCCESS', res);
  } catch(e) {
    console.log('ERROR', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
