import { basePrisma as prisma } from './src/core/utils/prisma.js';

async function main() {
  const result = await prisma.project.updateMany({
    where: {
      OR: [
        { name: 'Projet LSE - Électrification' },
        { name: 'Projet Kobo Global' },
        { id: 'project_lse' }
      ]
    },
    data: {
      name: 'GEM SAAS - LSE'
    }
  });
  console.log('Renamed LSE projects to GEM SAAS - LSE:', result.count);
  process.exit(0);
}
main();
