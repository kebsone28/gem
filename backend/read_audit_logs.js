import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { 
        OR: [
          { action: { contains: 'ERROR' } },
          { action: { contains: 'sync' } },
          { action: { contains: 'Sync' } }
        ]
      },
      take: 20,
      orderBy: { timestamp: 'desc' }
    });
    console.log('--- RECENT AUDIT LOGS ---');
    logs.forEach(l => {
      console.log(`[${l.timestamp.toISOString()}] ${l.action} on ${l.resource}: ${JSON.stringify(l.details)}`);
    });
    
    const count = await prisma.household.count();
    console.log(`\nTotal Households in DB: ${count}`);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

check();
