import prisma from '../core/utils/prisma.js';
import { syncKoboToDatabase } from './kobo.service.js';

/**
 * Service de synchronisation automatique (Cron)
 * Scanne toutes les organisations actives et déclenche la synchro Kobo
 * sans intervention humaine.
 */

// Intervalle en minutes
const SYNC_INTERVAL_MINUTES = 15;

let autoSyncInterval = null;
let initialTimeout = null;

export function startKoboAutoSync() {
    console.log(`[KOBO-CRON] ⏱️ Démarrage de l'auto-sync Kobo (Toutes les ${SYNC_INTERVAL_MINUTES} min)`);
    
    // On exécute immédiatement au (re)démarrage (optionnel, mais utile)
    initialTimeout = setTimeout(() => {
        runGlobalSync()
            .catch(err => console.error('[KOBO-CRON] ❌ Erreur critique initiale:', err));
    }, 10000); // Wait 10s after boot

    // Puis toutes les X minutes
    autoSyncInterval = setInterval(async () => {
        try {
            await runGlobalSync();
        } catch (error) {
            console.error('[KOBO-CRON] ❌ Erreur lors de la boucle de synchronisation:', error);
        }
    }, SYNC_INTERVAL_MINUTES * 60 * 1000);

    // Return cleanup function
    return () => {
        console.log('[KOBO-CRON] 🛑 Arrêt de l\'auto-sync Kobo...');
        if (autoSyncInterval) {
            clearInterval(autoSyncInterval);
            autoSyncInterval = null;
        }
        if (initialTimeout) {
            clearTimeout(initialTimeout);
            initialTimeout = null;
        }
    };
}

async function runGlobalSync() {
    console.log(`[KOBO-CRON] 🔄 Début de la boucle serveur de synchronisation Kobo...`);
    
    // Récupérer toutes les organisations avec des projets actifs ayant potentiellement des paramètres Kobo
    const orgs = await prisma.organization.findMany({
        where: {
            // Optionnel : tu pourrais filtrer sur "isActive: true" si ce champ existe
        },
        select: {
            id: true,
            name: true,
            projects: {
                where: { status: 'active' },
                select: { id: true, name: true }
            }
        }
    });

    if (orgs.length === 0) {
        return console.log('[KOBO-CRON] ⚠️ Aucune organisation trouvée.');
    }

    // On parcourt chaque organisation
    for (const org of orgs) {
        if (!org.projects || org.projects.length === 0) continue;

        // Pour simplifier, on prend le premier projet actif (ou on pourrait itérer sur tous)
        const targetProjectId = org.projects[0].id;

        try {
            console.log(`[KOBO-CRON] 📡 Sync pour l'organisation ${org.name} (Projet: ${org.projects[0].name})...`);
            
            // Appel de la logique de service
            const result = await syncKoboToDatabase(org.id, targetProjectId);
            
            // Log en BDD si possible
            await prisma.syncLog.create({
                data: {
                    organizationId: org.id,
                    source: 'kobo-cron',
                    applied: result.applied,
                    skipped: result.skipped,
                    errors: result.errors,
                    total: result.total,
                    syncedAt: new Date()
                }
            }).catch(() => {}); // Si la table n'existe pas, non bloquant

            if (result.applied > 0) {
                console.log(`[KOBO-CRON] ✅ Succès pour ${org.name}: ${result.applied} ménages importés/mis à jour.`);
                
                // NOTIFICATION TEMPS RÉEL (Socket.IO)
                const { socketService } = await import('./socket.service.js');
                socketService.emit('notification', {
                    id: Date.now().toString(),
                    type: 'SYNC',
                    message: 'Synchronisation Kobo réussie',
                    detail: `${result.applied} formulaires intégrés avec succès.`,
                    sender: 'SERVEUR GEM'
                });
            } else {
                console.log(`[KOBO-CRON] ℹ️ Rien de nouveau pour ${org.name}.`);
            }

        } catch (orgError) {
            console.error(`[KOBO-CRON] ❌ Échec pour l'organisation ${org.name}:`, orgError.message);
        }
    }
}
