import { basePrisma as prisma } from './src/core/utils/prisma.js';

async function main() {
  const localProjects = await prisma.project.findMany();
  console.log('--- LOCAL PROJECTS ---');
  console.log(JSON.stringify(localProjects, null, 2));

  const zonesCount = await prisma.zone.count();
  const householdsCount = await prisma.household.count();
  const teamsCount = await prisma.team.count();
  const missionsCount = await prisma.mission.count();

  console.log('Counts:', { zonesCount, householdsCount, teamsCount, missionsCount });
  process.exit(0);
}
main();
