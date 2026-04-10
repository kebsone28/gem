import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const households = await prisma.household.findMany({
      take: 5,
      include: { zone: true }
    });
    console.log('Sample Households and their Zones:');
    households.forEach(h => {
      console.log(`H ID: ${h.id}, Zone Name: ${h.zone.name}, Zone ID: ${h.zoneId}`);
    });
    
    const zones = await prisma.zone.findMany({ take: 5 });
    console.log('\nSample Zones in DB:');
    zones.forEach(z => {
      console.log(`Zone: ${z.name}, ID: ${z.id}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

check();
