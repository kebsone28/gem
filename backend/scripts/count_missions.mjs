import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERREUR: la variable d\'environnement DATABASE_URL est introuvable.');
    console.error('Définissez DATABASE_URL dans .env ou exportez-la avant d\'exécuter le script.');
    process.exit(2);
  }

  try {
    const count = await prisma.mission.count();
    console.log(`MISSIONS_COUNT:${count}`);
  } catch (err) {
    console.error('Erreur lors du comptage des missions:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
