/**
 * Fichier d'initialisation principal pour la nouvelle architecture
 * Charge tous les modules dans le bon ordre
 * 
 * À inclure dans les pages HTML AVANT les autres scripts
 */

(function () {
    'use strict';

    console.log('🚀 Initializing new architecture...');

    // Vérifier que Dexie est chargé
    if (typeof Dexie === 'undefined') {
        console.error('❌ Dexie.js is required but not loaded');
        return;
    }

    // Configuration de la base de données améliorée
    const db = new Dexie('ElectrificationDB');

    // Schéma version 3303 (Ajout index teamId sur households)
    db.version(3303).stores({
        // Nouvelle architecture
        projects: '++id, name, status, startDate, endDate',
        zones: '++id, projectId, name, [projectId+name]',
        households: '++id, zoneId, teamId, status, [zoneId+status], gpsLat, gpsLon',
        teams: '++id, type, zoneId, [type+zoneId]',
        activities: '++id, date, teamId, householdId, type, [date+teamId]',
        costs: '++id, projectId, category, date',
        sync_queue: '++id, entity, action, timestamp, synced',
        audit_log: '++id, entity, entityId, action, userId, timestamp',
        settings: 'key', // Table Key-Value pour stockage persistant (ex: FileSystemHandle)
        // Legacy tables support
        progression: '++id, date, equipe, statut, timestamp'
    }).upgrade(async tx => {
        console.log('📦 Running database migration to v3...');

        // Migration des anciennes données si elles existent
        try {
            const oldMenages = await tx.table('menages').toArray();
            console.log(`Found ${oldMenages.length} old menages to migrate`);

            for (const menage of oldMenages) {
                await tx.table('households').add({
                    id: menage.id,
                    zoneId: menage.zone || 'default-zone',
                    status: menage.statut || 'En attente',
                    location: {
                        region: menage.region,
                        department: menage.departement,
                        commune: menage.commune,
                        village: menage.quartier_village,
                        coordinates: menage.gps_lat && menage.gps_lon ? {
                            latitude: menage.gps_lat,
                            longitude: menage.gps_lon,
                            precision: menage.gps_precision
                        } : null
                    },
                    owner: {
                        name: menage.nom_prenom_chef,
                        phone: menage.telephone,
                        cin: menage.cin
                    },
                    statusHistory: [],
                    assignedTeams: menage.equipe ? [{ type: 'principale', name: menage.equipe }] : [],
                    scheduledDates: {},
                    actualDates: {},
                    notes: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            console.log('✅ Migration completed');
        } catch (error) {
            console.warn('⚠️ No old data to migrate or migration failed:', error.message);
        }
    });

    // Ouvrir la base de données
    db.open().then(() => {
        console.log('✅ Database opened successfully');

        // Exposer la base de données globalement
        window.db = db;

        // Initialiser les repositories
        window.projectRepository = new ProjectRepository(db);
        window.householdRepository = new HouseholdRepository(db);
        window.teamRepository = new TeamRepository(db);
        window.zoneRepository = new ZoneRepository(db);

        console.log('✅ Repositories initialized');

        // Initialiser le logger avec transport IndexedDB
        if (window.logger) {
            window.logger.addTransport(new IndexedDBTransport(db));
        }

        // Initialiser le gestionnaire d'erreurs
        window.errorHandler = new ErrorHandler(window.logger, window.eventBus);

        // Initialiser le service de métriques
        // Initialiser le service de synchronisation
        window.syncService = new SyncService(db, window.eventBus, window.logger);

        // Initialiser le service de migration
        window.migrationService = new MigrationService(db, window.logger);

        // Initialiser les services de backup et restauration
        window.backupService = new BackupService(db, window.eventBus, window.logger);
        window.backupService.initialize(); // Restore directory handle
        window.restoreService = new RestoreService(db, window.eventBus, window.logger);

        console.log('✅ Infrastructure services initialized');

        // Initialiser les services de domaine (pour le calculateur)
        try {
            window.resourceAllocationService = (typeof ResourceAllocationService !== 'undefined') ? new ResourceAllocationService() : (window.resourceAllocationService || {
                calculateAllocation: () => { return new Map(); },
                calculateRequiredTeams: () => { return {}; },
                balanceWorkload: () => { return []; }
            });
        } catch (e) {
            console.warn('ResourceAllocationService init failed, using fallback', e);
            window.resourceAllocationService = window.resourceAllocationService || { calculateAllocation: () => new Map(), calculateRequiredTeams: () => ({}), balanceWorkload: () => [] };
        }

        try {
            window.costCalculationService = (typeof CostCalculationService !== 'undefined') ? new CostCalculationService() : (window.costCalculationService || { calculateTotalCost: () => 0 });
        } catch (e) {
            console.warn('CostCalculationService init failed, using fallback', e);
            window.costCalculationService = window.costCalculationService || { calculateTotalCost: () => 0 };
        }

        console.log('✅ Domain services initialized');

        // Initialiser les services applicatifs
        window.projectService = new ProjectService(
            window.projectRepository,
            window.zoneRepository,
            window.teamRepository,
            window.eventBus
        );

        window.householdService = new HouseholdService(
            window.householdRepository,
            window.eventBus
        );

        console.log('✅ Application services initialized');

        // Initialiser les stores
        window.projectStore = new ProjectStore(window.projectService);
        window.storeRegistry.register('project', window.projectStore);

        console.log('✅ Stores initialized');

        // Émettre un événement d'initialisation
        if (window.eventBus) {
            window.eventBus.emit('app.initialized', {
                timestamp: new Date()
            });
        }

        console.log('🎉 Architecture initialization complete!');
    }).catch(error => {
        console.error('❌ Failed to open database:', error);
    });

    // Exposer la base de données globalement
    window.db = db;

    // Fonction utilitaire pour charger un projet
    window.loadProject = async function (projectId) {
        try {
            const project = await window.projectRepository.findById(projectId);
            if (!project) {
                console.warn(`Project ${projectId} not found`);
                return null;
            }

            console.log('📂 Project loaded:', project.name);
            return project;
        } catch (error) {
            console.error('Error loading project:', error);
            throw error;
        }
    };

    // Fonction utilitaire pour créer un projet de démonstration
    window.createDemoProject = async function () {
        try {
            // Créer le projet
            const project = new (window.Project || Project)({
                id: 'demo-project',
                name: 'Projet Démonstration',
                totalHouses: 1000,
                startDate: new Date()
            });

            // Créer des zones et les ajouter au projet
            const zone1 = new (window.Zone || Zone)({
                id: 'zone-1',
                name: 'Zone Nord',
                totalHouses: 500,
                projectId: project.id
            });
            const zone2 = new (window.Zone || Zone)({
                id: 'zone-2',
                name: 'Zone Sud',
                totalHouses: 500,
                projectId: project.id
            });

            project.addZone(zone1);
            project.addZone(zone2);

            // Sauvegarder (Repositories should handle the rest)
            await window.projectRepository.save(project);
            await window.zoneRepository.saveBatch([zone1, zone2]);

            console.log('✅ Demo project created:', project.name);
            return project;
        } catch (error) {
            console.error('Error creating demo project:', error);
            throw error;
        }
    };

    // Fonction utilitaire pour obtenir des statistiques
    window.getAppStats = async function () {
        try {
            const stats = {
                projects: await window.projectRepository.count(),
                households: await window.householdRepository.count(),
                householdsByStatus: await window.householdRepository.getStats()
            };

            console.table(stats);
            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    };

})();
