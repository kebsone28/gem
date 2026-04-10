import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllData() {
  try {
    console.log('🔄 SUPPRESSION COMPLÈTE DES DONNÉES\n');

    // Delete in correct order (foreign key constraints)
    const households = await prisma.household.deleteMany({});
    const grappes = await prisma.grappe.deleteMany({});
    
    console.log(`✅ Résultat:`);
    console.log(`   • Ménages supprimés: ${households.count}`);
    console.log(`   • Grappes supprimées: ${grappes.count}`);

    // Verify
    const countH = await prisma.household.count();
    const countG = await prisma.grappe.count();
    
    console.log(`\n📊 État après suppression:`);
    console.log(`   • Ménages: ${countH}`);
    console.log(`   • Grappes: ${countG}`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllData();
