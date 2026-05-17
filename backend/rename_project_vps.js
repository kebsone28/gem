import { basePrisma as prisma } from './src/core/utils/prisma.js';

async function main() {
  const result = await prisma.project.updateMany({
    where: {
      name: 'Projet Kobo Global'
    },
    data: {
      name: 'Projet LSE - Électrification'
    }
  });
  console.log('Renamed projects:', result.count);
  process.exit(0);
}
main();
