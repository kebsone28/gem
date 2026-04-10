import prisma from './src/core/utils/prisma.js';

async function cleanupAll() {
    try {
        console.log('🧹 Nettoyage complet de la BD...\n');

        // Delete all households
        const householdsDeleted = await prisma.household.deleteMany({});
        console.log(`✅ Supprimé ${householdsDeleted.count} ménages`);

        // Delete all grappes
        const grappesDeleted = await prisma.grappe.deleteMany({});
        console.log(`✅ Supprimé ${grappesDeleted.count} grappes`);

        // Delete all zones (except those in use)
        // Keep at least one zone
        const zones = await prisma.zone.findMany();
        console.log(`📊 ${zones.length} zones trouvées`);

        // Verify
        const householdCount = await prisma.household.count();
        const grappeCount = await prisma.grappe.count();

        console.log(`\n✨ État final:`);
        console.log(`  - Ménages: ${householdCount}`);
        console.log(`  - Grappes: ${grappeCount}`);

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAll();
