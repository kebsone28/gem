import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fullReset() {
  try {
    console.log('=== RÉINITIALISATION COMPLÈTE DE LA BASE ===\n');

    // Supprimer TOUS les ménages
    const deletedHouseholds = await prisma.household.deleteMany({});
    console.log(`✓ Supprimé ${deletedHouseholds.count} ménages`);

    // Supprimer TOUTES les grappes
    const deletedGrappes = await prisma.grappe.deleteMany({});
    console.log(`✓ Supprimé ${deletedGrappes.count} grappes`);

    // Supprimer LES RÉGIONS si nécessaire
    const deletedRegions = await prisma.region.deleteMany({});
    console.log(`✓ Supprimé ${deletedRegions.count} régions`);

    // Vérifier que tout est vide
    const householdCount = await prisma.household.count();
    const grappeCount = await prisma.grappe.count();
    const regionCount = await prisma.region.count();

    console.log(`\n✓ Vérification après suppression:`);
    console.log(`  - Ménages: ${householdCount}`);
    console.log(`  - Grappes: ${grappeCount}`);
    console.log(`  - Régions: ${regionCount}`);

    if (householdCount === 0 && grappeCount === 0) {
      console.log('\n✅ BASE DE DONNÉES COMPLÈTEMENT VIDÉE');
      console.log('\n📌 MAINTENANCE FRONTEND:');
      console.log('   1. Ouvrir DevTools (F12)');
      console.log('   2. Onglet "Application" → "Storage"');
      console.log('   3. Supprimer IndexedDB et localStorage');
      console.log('   4. Recharger la page (Ctrl+Shift+R)');
    }

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fullReset();
