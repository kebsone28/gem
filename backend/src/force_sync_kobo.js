import { syncKoboToDatabase } from './services/kobo.service.js';
import prisma from './core/utils/prisma.js';

async function forceFullSync() {
    console.log('🚀 DÉMARRAGE DE LA SYNCHRONISATION TOTALE (FORCE)...');
    
    try {
        // Obtenir l'organisation et une zone par défaut
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error('Aucune organisation trouvée.');

        const zone = await prisma.zone.findFirst({ where: { organizationId: org.id } });
        if (!zone) throw new Error('Aucune zone trouvée pour l\'organisation.');

        // On passe 'new Date(0)' pour forcer Kobo à renvoyer TOUTES les données depuis 1970
        const results = await syncKoboToDatabase(org.id, zone.id, new Date(0));

        console.log('✅ SYNCHRONISATION TERMINÉE !');
        console.log(`Résultats : ${results.applied} appliqués, ${results.skipped} ignorés, ${results.errors} erreurs.`);
        
    } catch (error) {
        console.error('❌ ERREUR SYNC:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

forceFullSync();
