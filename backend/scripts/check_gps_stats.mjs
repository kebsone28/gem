import prisma from '../src/core/utils/prisma.js';

async function checkGpsStats() {
  const total = await prisma.household.count({ where: { deletedAt: null } });
  const withGps = await prisma.household.count({
    where: {
      deletedAt: null,
      latitude: { not: null },
      longitude: { not: null }
    }
  });
  const withoutGps = total - withGps;
  const percentage = total > 0 ? ((withGps / total) * 100).toFixed(2) : 0;

  console.log(JSON.stringify({
    total_households: total,
    households_with_gps: withGps,
    households_without_gps: withoutGps,
    gps_coverage_percentage: parseFloat(percentage)
  }, null, 2));

  await prisma.$disconnect();
}

checkGpsStats().catch(console.error);
