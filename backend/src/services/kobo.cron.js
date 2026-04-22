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
            config: true,
            projects: {
                where: { status: 'active', deletedAt: null },
                select: { id: true, name: true, config: true }
            }
        }
    });

    if (orgs.length === 0) {
        return console.log('[KOBO-CRON] ⚠️ Aucune organisation trouvée.');
    }

    // On parcourt chaque organisation
    for (const org of orgs) {
        if (!org.projects || org.projects.length === 0) continue;

        // Sync TOUS les projets actifs (pas juste le premier)
        for (const project of org.projects) {
            // Détermine si ce projet ou l'org a une config Kobo
            const hasKoboConfig = project.config?.kobo?.token || org.config?.kobo?.token || 
                                  process.env.KOBO_TOKEN;
            
            if (!hasKoboConfig) {
                console.log(`[KOBO-CRON] ⏭️ Pas de config Kobo pour ${org.name} / ${project.name}`);
                continue;
            }

            try {
                console.log(`[KOBO-CRON] 📡 Sync pour l'organisation ${org.name} (Projet: ${project.name})...`);
                
                // Appel de la logique de service avec le projectId spécifique
                const result = await syncKoboToDatabase(org.id, null, null, project.id);
                
                // Log en BDD avec un utilisateur de l'organisation
                const firstUser = await prisma.user.findFirst({ where: { organizationId: org.id } });
                
                if (firstUser) {
                    await prisma.syncLog.create({
                        data: {
                            userId: firstUser.id,
                            organizationId: org.id,
                            deviceId: 'cron-daemon',
                            action: 'KOBO_SYNC_AUTO',
                            details: {
                                source: 'kobo-cron',
                                applied: result.applied,
                                skipped: result.skipped,
                                errors: result.errors,
                                total: result.total,
                                projectId: project.id,
                                syncedAt: new Date()
                            },
                            timestamp: new Date()
                        }
                    }).catch(e => console.error('[KOBO-CRON] ❌ Log fail:', e.message));
                }

                if (result.applied > 0) {
                    console.log(`[KOBO-CRON] ✅ Succès pour ${org.name}/${project.name}: ${result.applied} ménages importés/mis à jour.`);
                    
                    // NOTIFICATION TEMPS RÉEL (Socket.IO)
                    const { socketService } = await import('./socket.service.js');
                    socketService.emit('notification', {
                        id: Date.now().toString(),
                        type: 'SYNC',
                        message: 'Synchronisation Kobo réussie',
                        detail: `${result.applied} formulaires intégrés avec succès (${project.name}).`,
                        sender: 'SERVEUR GEM'
                    });
                } else {
                    console.log(`[KOBO-CRON] ℹ️ Rien de nouveau pour ${org.name}/${project.name}.`);
                }

            } catch (projectError) {
                console.error(`[KOBO-CRON] ❌ Échec pour ${org.name}/${project.name}:`, projectError.message);
            }
        }
    }
}

