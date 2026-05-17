import { basePrisma as prisma } from './src/core/utils/prisma.js';

async function main() {
  const missions = await prisma.mission.findMany({
    select: {
      orderNumber: true,
      title: true,
      status: true,
      budget: true,
      startDate: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  console.log('--- MISSIONS ON VPS DB ---');
  console.log(JSON.stringify(missions, null, 2));
  process.exit(0);
}
main();
