import prisma from './src/core/utils/prisma.js';

async function check() {
  try {
    const households = await prisma.household.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' }
    });
    console.log('Last 5 households:', JSON.stringify(households, null, 2));
    
    const errors = await prisma.auditLog.findMany({
      where: { action: { contains: 'ERROR' } },
      take: 5,
      orderBy: { timestamp: 'desc' }
    });
    console.log('Recent errors:', JSON.stringify(errors, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
