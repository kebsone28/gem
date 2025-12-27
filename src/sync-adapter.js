/**
 * Adaptateur pour SyncManager (Legacy -> DDD)
 * Maintient la compatibilité avec l'ancien système de synchro
 * et gère l'interface utilisateur liée à la synchro
 */

(function () {
    'use strict';

    console.log('🔄 Loading sync adapter...');

    // Attendre l'initialisation
    window.addEventListener('load', () => {
        if (!window.syncService) {
            console.warn('⚠️ SyncService not found, using fallback');
            // Fallback si nécessaire, mais init.js devrait l'avoir chargé
            if (typeof SyncService !== 'undefined') {
                window.syncService = new SyncService(window.db, window.eventBus, window.logger);
            }
        }

        // Initialiser l'UI
        initSyncUI();

        // Créer l'objet legacy pour compatibilité
        window.syncManager = {
            syncKoboData: async () => {
                try {
                    const result = await window.syncService.syncFromApi();
                    alert('Synchronisation terminée avec succès !');
                    updateSyncUI();
                    return result;
                } catch (error) {
                    alert('Erreur de synchronisation');
                    throw error;
                }
            },
            handleJsonFile: async (file) => {
                try {
                    const result = await window.syncService.importJsonFile(file);
                    alert(`${result.count} entrées importées avec succès`);
                    updateSyncUI();
                    return result;
                } catch (error) {
                    alert('Erreur lecture JSON: ' + error.message);
                    throw error;
                }
            }
        };

        // Fonction globale legacy
        window.syncKoboData = window.syncManager.syncKoboData;

        console.log('✅ Sync adapter ready');
    });

    function initSyncUI() {
        // Écouteur pour l'input fichier
        const koboInput = document.getElementById('koboFileInput');
        if (koboInput) {
            koboInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    await window.syncManager.handleJsonFile(e.target.files[0]);
                    // Reset input
                    e.target.value = '';
                }
            });
        }

        // Bouton de synchro (si présent)
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => window.syncKoboData());
        }

        // Mise à jour initiale
        updateSyncUI();

        // Écouter les événements de synchro
        if (window.eventBus) {
            window.eventBus.on('sync.completed', () => updateSyncUI());
        }
    }

    async function updateSyncUI() {
        if (!window.syncService) return;

        try {
            // Mettre à jour la date de dernière synchro
            const lastLog = await window.syncService.getLastSyncLog();
            if (lastLog) {
                const el = document.getElementById('lastSyncTime');
                if (el) el.textContent = lastLog.date.toLocaleString();
            }

            // Mettre à jour le compteur d'activités (si l'élément existe)
            const pendingEl = document.getElementById('pendingActivitiesCount');
            if (pendingEl && window.db && window.db.activites_terrain) {
                const count = await window.db.activites_terrain.count();
                pendingEl.textContent = count;
            }
        } catch (err) {
            console.warn('Error updating sync UI:', err);
        }
    }

})();
