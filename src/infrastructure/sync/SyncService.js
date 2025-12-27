(function (global) {
    if (global.SyncService) return;

    class SyncService {
        constructor(db, eventBus, logger) {
            this.db = db;
            this.eventBus = eventBus;
            this.logger = logger;
        }

        /**
         * Synchronise les données depuis l'API (Simulé)
         */
        /**
         * Synchronise les données depuis l'API KoboCollect
         */
        async syncFromApi() {
            this.logger?.info('🔄 Starting API synchronization...');

            try {
                // 1. Récupération Config
                const token = document.getElementById('koboApiToken')?.value || '2e3a09a8bff3fbb3a2510dbcba84486582897f3f';
                const uid = document.getElementById('koboAssetUid')?.value || 'aEYZwPujJiFBTNb6mxMGCB';

                if (!window.KoboApiService) throw new Error("Service Kobo API non disponible");

                // 2. Fetch Data
                if (window.Swal) {
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                    Toast.fire({ icon: 'info', title: 'Connexion Kobo...' });
                }

                const data = await window.KoboApiService.fetchData(token, uid);
                this.logger?.info(`📥 ${data.length} données reçues de Kobo`);

                // 3. Traitement via ImportManager (Réutilisation logique existante)
                let count = 0;
                if (window.importManager) {
                    // processMenages attend un tableau d'objets plat.
                    // Kobo retourne souvent des objets avec des préfixes "group/"
                    // ImportManager gère déjà la détection de colonnes, donc on passe brut.
                    await window.importManager.processMenages(data);

                    // Finalize import to update UI and stats
                    window.importManager.finalizeImport();
                    count = data.length;
                } else {
                    // Fallback si pas d'ImportManager (peu probable maintenant)
                    count = await this.processSubmissions(data);
                }

                await this.logSync('API', 'success', `${count} entries synchronized`);

                if (this.eventBus) {
                    this.eventBus.emit('sync.completed', { source: 'API', count });
                }

                return { success: true, count };

            } catch (error) {
                this.logger?.error('Sync error:', error);
                if (window.Swal) Swal.fire('Erreur Synchro', error.message, 'error');
                await this.logSync('API', 'error', error.message);
                throw error;
            }
        }

        /**
         * Traite un fichier JSON importé
         */
        async importJsonFile(file) {
            this.logger?.info(`📂 Importing JSON file: ${file.name}`);

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!Array.isArray(data)) {
                    throw new Error('Invalid format: must be a JSON array');
                }

                const count = await this.processSubmissions(data);

                await this.logSync('FILE', 'success', `${count} entries imported from ${file.name}`);

                if (this.eventBus) {
                    this.eventBus.emit('sync.completed', { source: 'FILE', count, filename: file.name });
                }

                return { success: true, count };
            } catch (error) {
                this.logger?.error('JSON import error:', error);
                await this.logSync('FILE', 'error', error.message);
                throw error;
            }
        }

        /**
         * Traite une liste de soumissions
         */
        async processSubmissions(submissions) {
            let count = 0;

            for (const sub of submissions) {
                try {
                    // Créer l'activité
                    const activity = {
                        date: sub.date || new Date().toISOString().split('T')[0],
                        type: sub.form_type || 'unknown',
                        teamId: sub.equipe_id || 'unknown',
                        zoneId: sub.zone || 'unknown',
                        householdId: sub.menage_id || null,
                        data: sub,
                        syncedAt: new Date()
                    };

                    // Sauvegarder l'activité (Nouvelle table activities)
                    if (this.db.activities) {
                        await this.db.activities.add(activity);
                    }

                    // Compatibilité Legacy (Table activites_terrain)
                    if (this.db.activites_terrain) {
                        await this.db.activites_terrain.add({
                            date: activity.date,
                            form_type: activity.type,
                            equipe_id: activity.teamId,
                            zone: activity.zoneId,
                            menage_id: activity.householdId,
                            raw_data: sub
                        });
                    }

                    // Mise à jour du statut ménage si applicable
                    if (activity.householdId && activity.type === 'electricien_interieur') {
                        // Via Repository si disponible
                        if (window.householdRepository) {
                            const household = await window.householdRepository.findById(activity.householdId);
                            if (household) {
                                household.status = 'Terminé'; // HouseholdStatus.COMPLETED
                                // TODO: Ajouter détails installation
                                await window.householdRepository.save(household);
                            }
                        }

                        // Fallback Legacy
                        if (this.db.menages) {
                            await this.db.menages.where('id').equals(activity.householdId).modify({
                                statut: 'Terminé',
                                date_installation: activity.date,
                                equipe_installation: activity.teamId
                            });
                        }
                    }

                    count++;
                } catch (err) {
                    this.logger?.warn('Error processing submission:', err, sub);
                }
            }

            return count;
        }

        /**
         * Génère des données de test
         */
        generateMockData() {
            return [
                {
                    date: new Date().toISOString().split('T')[0],
                    form_type: 'electricien_interieur',
                    equipe_id: 'INT-001',
                    zone: 'Zone A',
                    menage_id: 'MEN-000001',
                    statut: 'Terminé'
                },
                {
                    date: new Date().toISOString().split('T')[0],
                    form_type: 'electricien_reseau',
                    equipe_id: 'RES-001',
                    zone: 'Zone B',
                    poteaux: 3
                }
            ];
        }

        /**
         * Enregistre un log de synchronisation
         */
        async logSync(type, status, message) {
            const log = {
                date: new Date(),
                type,
                status,
                message
            };

            // Nouvelle table
            if (this.db.sync_logs) {
                await this.db.sync_logs.add(log);
            }

            return log;
        }

        /**
         * Récupère le dernier log
         */
        async getLastSyncLog() {
            if (this.db.sync_logs) {
                return await this.db.sync_logs.orderBy('date').last();
            }
            return null;
        }
    }

    // Export pour utilisation globale
    global.SyncService = SyncService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SyncService;
    }

})(typeof window !== 'undefined' ? window : this);
