// (function (global) {
//    if (global.SyncService) return;

export class SyncService {
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
            // 1. Récupération Config sécurisée (IndexedDB settings ou champs UI)
            const { token, uid } = await this._getKoboConfig();

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

            const log = await this.logSync('API', 'success', `${count} entries synchronized`);

            if (this.eventBus) {
                this.eventBus.emit('sync.completed', { source: 'API', count, log });
            }

            return { success: true, count };

        } catch (error) {
            this.logger?.error('Sync error:', error);
            if (window.Swal) Swal.fire('Erreur Synchro', error.message, 'error');
            const log = await this.logSync('API', 'error', error.message);
            if (this.eventBus) {
                this.eventBus.emit('sync.failed', { source: 'API', error, log });
            }
            throw error;
        }
    }

    async _getKoboConfig() {
        let token = null;
        let uid = null;

        try {
            const stored = this.db?.settings ? await this.db.settings.get('kobo_config') : null;
            uid = stored?.assetUid || null;
        } catch (e) {
            this.logger?.warn('Settings table not available or unreadable for Kobo config', e);
        }

        // Token via stockage sécurisé (Electron) si dispo
        if (typeof window !== 'undefined' && window.koboProxy?.getToken) {
            token = await window.koboProxy.getToken();
        }

        // Fallback UI (sans valeur par défaut en dur)
        token = token || document.getElementById('koboApiToken')?.value;
        uid = uid || document.getElementById('koboAssetUid')?.value;

        if (!token || !uid) {
            throw new Error('Configuration Kobo manquante (token ou asset UID). Ouvrez la config et enregistrez.');
        }

        return { token, uid };
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

            const log = await this.logSync('FILE', 'success', `${count} entries imported from ${file.name}`);

            if (this.eventBus) {
                this.eventBus.emit('sync.completed', { source: 'FILE', count, filename: file.name, log });
            }

            return { success: true, count };
        } catch (error) {
            this.logger?.error('JSON import error:', error);
            const log = await this.logSync('FILE', 'error', error.message);
            if (this.eventBus) {
                this.eventBus.emit('sync.failed', { source: 'FILE', error, log });
            }
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
                            household.status = (window.HouseholdStatus?.RECEPTION_VALIDEE) || 'Réception: Validée';
                            // TODO: Ajouter détails installation
                            await window.householdRepository.save(household);
                        }
                    }

                    // Fallback Legacy
                    if (this.db.menages) {
                        await this.db.menages.where('id').equals(activity.householdId).modify({
                            statut: (window.HouseholdStatus?.RECEPTION_VALIDEE) || 'Réception: Validée',
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
                statut: (window.HouseholdStatus?.RECEPTION_VALIDEE) || 'Réception: Validée'
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

// Export pour utilisation globale (compatibilité)
if (typeof window !== 'undefined') {
    window.SyncService = SyncService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncService;
}

// })(typeof window !== 'undefined' ? window : this);
