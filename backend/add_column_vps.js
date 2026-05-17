import { basePrisma as prisma } from './src/core/utils/prisma.js';

async function main() {
  try {
    const result = await prisma.$executeRawUnsafe(
      `ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "excludeFromFinance" BOOLEAN NOT NULL DEFAULT false;`
    );
    console.log('Successfully added excludeFromFinance column:', result);
  } catch (error) {
    console.error('Error adding column:', error);
  }
  process.exit(0);
}
main();
