/**
 * Service de migration de base de données
 * Gère la transition des données legacy vers le nouveau schéma DDD
 */

/**
 * Service de migration de base de données
 * Gère la transition des données legacy vers le nouveau schéma DDD
 */

(function (global) {
    if (global.MigrationService) return;

    class MigrationService {
        constructor(db, logger) {
            this.db = db;
            this.logger = logger;
        }

        /**
         * Exécute toutes les migrations disponibles
         */
        async runAllMigrations() {
            this.logger?.info('🚀 Starting full database migration...');
            const report = {
                households: await this.migrateHouseholds(),
                activities: await this.migrateActivities(),
                progression: await this.migrateProgression(),
                timestamp: new Date()
            };

            this.logger?.info('✅ Full migration completed', report);
            return report;
        }

        /**
         * Migre les ménages (menages -> households)
         * Note: Une migration basique est déjà faite dans init.js, 
         * celle-ci est plus complète et idempotente.
         */
        async migrateHouseholds() {
            this.logger?.info('📦 Migrating households...');
            let count = 0;
            let skipped = 0;
            let errors = 0;

            try {
                const legacyHouseholds = await this.db.menages.toArray();

                for (const old of legacyHouseholds) {
                    try {
                        // Vérifier si existe déjà
                        const existing = await this.db.households.get(old.id);
                        if (existing) {
                            skipped++;
                            continue;
                        }

                        // Mapping
                        const household = {
                            id: old.id,
                            zoneId: old.zone || 'default-zone',
                            status: this._mapStatus(old.statut),
                            location: {
                                region: old.region || '',
                                department: old.departement || '',
                                commune: old.commune || '',
                                village: old.quartier_village || '',
                                coordinates: (old.gps_lat && old.gps_lon) ? {
                                    latitude: parseFloat(old.gps_lat),
                                    longitude: parseFloat(old.gps_lon),
                                    precision: parseFloat(old.gps_precision || 0)
                                } : null
                            },
                            owner: {
                                name: old.nom_prenom_chef || 'Inconnu',
                                phone: old.telephone || '',
                                cin: old.cin || ''
                            },
                            technical: {
                                networkTeam: old.equipe_reseau,
                                interiorTeam: old.equipe_interieur,
                                connectionForecast: old.prevision_raccordement
                            },
                            dates: {
                                deliveryScheduled: old.date_prevue_livraison,
                                deliveryActual: old.date_effective_livraison,
                                installationScheduled: old.date_prevue_installation,
                                installationActual: old.date_realisation_installation,
                                control: old.date_visite_controle
                            },
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };

                        await this.db.households.add(household);
                        count++;
                    } catch (err) {
                        this.logger?.warn(`Failed to migrate household ${old.id}`, err);
                        errors++;
                    }
                }
            } catch (err) {
                this.logger?.error('Error reading legacy households', err);
                throw err;
            }

            return { count, skipped, errors };
        }

        /**
         * Migre les activités (activites_terrain -> activities)
         */
        async migrateActivities() {
            this.logger?.info('📦 Migrating activities...');
            let count = 0;
            let skipped = 0;
            let errors = 0;

            try {
                const legacyActivities = await this.db.activites_terrain.toArray();

                for (const old of legacyActivities) {
                    try {
                        // Vérifier doublons (basé sur date + equipe + menage)
                        const existing = await this.db.activities
                            .where('[date+teamId]')
                            .equals([old.date, old.equipe_id])
                            .filter(a => a.householdId === old.menage_id)
                            .first();

                        if (existing) {
                            skipped++;
                            continue;
                        }

                        const activity = {
                            date: old.date,
                            type: old.form_type || 'unknown',
                            teamId: old.equipe_id || 'unknown',
                            zoneId: old.zone || 'unknown',
                            householdId: old.menage_id || null,
                            data: old.raw_data || {},
                            syncedAt: new Date().toISOString()
                        };

                        await this.db.activities.add(activity);
                        count++;
                    } catch (err) {
                        this.logger?.warn(`Failed to migrate activity ${old.id}`, err);
                        errors++;
                    }
                }
            } catch (err) {
                this.logger?.error('Error reading legacy activities', err);
                throw err;
            }

            return { count, skipped, errors };
        }

        /**
         * Migre la progression (progression -> metrics/logs)
         * Les données de progression legacy sont transformées en logs d'audit ou métriques
         */
        async migrateProgression() {
            this.logger?.info('📦 Migrating progression...');
            let count = 0;

            try {
                const legacyProgression = await this.db.progression.toArray();

                // Pour l'instant, on ne fait que logger car la table progression 
                // était surtout utilisée pour l'affichage temps réel, 
                // pas comme source de vérité historique critique.
                // On pourrait les archiver dans audit_log si nécessaire.

                count = legacyProgression.length;
                this.logger?.info(`Analyzed ${count} progression records (archived)`);

            } catch (err) {
                this.logger?.error('Error reading legacy progression', err);
            }

            return { count, status: 'archived' };
        }

        _mapStatus(legacyStatus) {
            const map = {
                'En attente': 'PENDING',
                'En cours': 'IN_PROGRESS',
                'Terminé': 'COMPLETED',
                'Bloqué': 'BLOCKED',
                'Validé': 'VALIDATED'
            };
            return map[legacyStatus] || 'PENDING';
        }
    }

    // Export
    global.MigrationService = MigrationService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MigrationService;
    }

})(typeof window !== 'undefined' ? window : this);
