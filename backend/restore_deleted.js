import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreDeleted() {
  try {
    const restored = await prisma.household.updateMany({
      where: { deletedAt: { not: null } },
      data: { deletedAt: null }
    });
    
    console.log('✓ Restauré ' + restored.count + ' ménages');
    
    const count = await prisma.household.count({ where: { deletedAt: null } });
    console.log('Total ménages: ' + count);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDeleted();
