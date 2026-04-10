
import 'dotenv/config';
import prisma from './src/core/utils/prisma.js';
import { syncKoboData } from './kobo_specialized_sync_agent.js';

async function testVisualSync() {
    const numeroOrdre = '45260';
    
    const before = await prisma.household.findUnique({ where: { numeroordre: numeroOrdre } });
    console.log(`[TEST-VISUEL] AVANT SYNC: ${before?.name} (ID: ${numeroOrdre})`);
    console.log(`  - LAT: ${before?.latitude}`);
    console.log(`  - LON: ${before?.longitude}`);
    console.log(`  - UPDATED_AT: ${before?.updatedAt}`);

    console.log("\n🚀 Lancement de la synchronisation Kobo...");
    // Force agent internal trace
    process.env.DEBUG_SYNC = 'true'; 
    const results = await syncKoboData();
    console.log(`\n✅ Synchro terminée: ${results.applied} appliqués`);

    const after = await prisma.household.findUnique({ where: { numeroordre: numeroOrdre } });
    console.log(`\n[TEST-VISUEL] APRES SYNC: ${after?.name} (ID: ${numeroOrdre})`);
    console.log(`  - LAT: ${after?.latitude}`);
    console.log(`  - LON: ${after?.longitude}`);
    console.log(`  - UPDATED_AT: ${after?.updatedAt}`);
    
    if (before?.updatedAt.getTime() === after?.updatedAt.getTime()) {
        console.log("\n⚠️ ATTENTION: Le record n'a pas été mis à jour dans la DB!");
    } else {
        console.log("\n✨ SUCCÈS: Le record a été mis à jour!");
        if (before?.latitude !== after?.latitude || before?.longitude !== after?.longitude) {
            console.log(`📍 DÉPLACEMENT DÉTECTÉ: [${before?.latitude}, ${before?.longitude}] -> [${after?.latitude}, ${after?.longitude}]`);
        } else {
            console.log("📍 Coordonnées identiques sur Kobo.");
        }
    }
}

testVisualSync().catch(console.error).finally(() => prisma.$disconnect());
