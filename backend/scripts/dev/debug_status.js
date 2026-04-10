
import 'dotenv/config';
import prisma from './src/core/utils/prisma.js';
import { syncKoboData } from './kobo_specialized_sync_agent.js';

// We need to import the internal functions for testing
// Since they are not exported, we'll re-define them or use a trick if possible.
// Actually, I'll just run the sync and check the DB's `constructionData` field!

async function debugStatus() {
    const numeroOrdre = '45260';
    
    console.log("🚀 Lancement de la synchronisation Kobo pour Maodo...");
    await syncKoboData();

    const h = await prisma.household.findUnique({ where: { numeroordre: numeroOrdre } });
    console.log(`\n[DEBUG-STATUS] Maodo Diallo:`);
    console.log(`  - Status final: ${h.status}`);
    console.log(`  - ConstructionData: ${JSON.stringify(h.constructionData, null, 2)}`);
    console.log(`  - Kobo Situation field raw: ${h.koboData['group_wu8kv54/Situation_du_M_nage']}`);
}

debugStatus().catch(console.error).finally(() => prisma.$disconnect());
