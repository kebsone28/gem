/**
 * Architecture de l'application - Initialisation Centrale (ES Module)
 * Gère le cycle de vie des repositories, services et stores.
 * Refactorisé en module ES pour garantir un ordre d'initialisation fiable.
 */

// 1. Imports des dépendances prioritaires (Infrastructure & Events)
import { eventBus } from './infrastructure/events/EventBus.js';
import { Logger, IndexedDBTransport } from './infrastructure/logging/Logger.js';
import { LogLevel } from './shared/constants/enums.js';
import { ErrorHandler } from './infrastructure/errors/ErrorHandler.js';
import { MetricsService } from './infrastructure/monitoring/MetricsService.js';
import { ValidationError, DomainError } from './shared/errors/DomainErrors.js';

// load grappe assignment module globally so it's included in every build
// (the module itself exports a controller but also attaches a legacy global)
import './modules/grappe-assignment/index.js';

// 2. Imports des Repositories
import { ProjectRepository } from './infrastructure/repositories/ProjectRepository.js';
import { HouseholdRepository } from './infrastructure/repositories/HouseholdRepository.js';
import { TeamRepository } from './infrastructure/repositories/TeamRepository.js';
import { ZoneRepository } from './infrastructure/repositories/ZoneRepository.js';

// 3. Imports des Services Infrastructure
import { SyncService } from './infrastructure/sync/SyncService.js';
import { BackupService } from './infrastructure/backup/BackupService.js';
import { RestoreService } from './infrastructure/backup/RestoreService.js';
import { MigrationService } from './infrastructure/migrations/MigrationService.js';

// 4. Imports des Services Domaine (Calculations & Simulation)
import { ResourceAllocationService } from './domain/services/ResourceAllocationService.js';
import { CostCalculationService } from './domain/services/CostCalculationService.js';
import { SimulationEngine } from './domain/services/SimulationEngine.js';
import { OptimizationStrategy, GreedyOptimizationStrategy, GeneticAlgorithmStrategy, CostMinimizationStrategy } from './domain/services/OptimizationStrategies.js';

// 5. Imports des Entités et Value Objects
import { Entity } from './domain/entities/Entity.js';
import { Coordinates, Location } from './domain/value-objects/Location.js';
import { Cost } from './domain/value-objects/Cost.js';
import { ProductivityRate } from './domain/value-objects/ProductivityRate.js';
import { Household } from './domain/entities/Household.js';
import { Team } from './domain/entities/Team.js';
import { Zone } from './domain/entities/Zone.js';
import { Project } from './domain/entities/Project.js';

// 6. Imports des Services Application
import { HouseholdService } from './application/services/HouseholdService.js';
import { ProjectService } from './application/services/ProjectService.js';

// 6.5. Imports des Services Stratégiques (Dashboard Institutionnel)
import { KPIService } from './services/KPIService.js';
import { ScoreEngine } from './services/scoreEngine.js';

// 7. Imports des Stores
import { ProjectStore } from './application/state/ProjectStore.js';
import { storeRegistry } from './application/state/StoreRegistry.js';

console.log('🚀 Initializing new architecture module...');

/**
 * Initialisation de la base de données Dexie
 */
async function initDatabase() {
    // Vérifier que Dexie est chargé (global via vendor/dexie/dexie.js)
    if (typeof Dexie === 'undefined') {
        throw new Error('❌ Dexie.js is required but not loaded. Check vendor/dexie/dexie.js');
    }

    const db = new Dexie('ElectrificationDB');

    // Définition des schémas (V4.6 compliant)
    db.version(40001).stores({
        projects: '++id, name, status',
        households: '++id, zoneId, status, owner.name, [location.region+location.department]',
        teams: '++id, name, type, status',
        zones: '++id, name, projectId',
        activities: '++id, date, teamId, zoneId, householdId, [date+teamId]',
        sync_logs: '++id, date, type, status',
        audit_log: '++id, timestamp, level, userId',
        settings: 'key',
        inventory: '++id, type, status',
        material_registry: '++id, category, status'
    });

    // Gestion des hooks de migration globale si besoin
    db.on('ready', () => {
        console.log('✅ Dexie database is ready');
    });

    return db;
}

/**
 * Bootstrap de l'application
 */
async function bootstrap() {
    try {
        // 1. Initialiser le Bus d'événements et le Logger
        window.eventBus = eventBus;

        const logger = new Logger('App', LogLevel.DEBUG);
        window.logger = logger;

        // 2. Ouvrir la base de données
        const db = await initDatabase();
        await db.open();
        window.db = db;
        console.log('✅ Database opened successfully');

        // 3. Initialiser les Repositories
        // Note: Les repositories utilisent window.db ou reçoivent db en argument
        const projectRepository = new ProjectRepository(db);
        const householdRepository = new HouseholdRepository(db);
        const teamRepository = new TeamRepository(db);
        const zoneRepository = new ZoneRepository(db);

        // Export global pour compatibilité avec le reste du code
        window.projectRepository = projectRepository;
        window.householdRepository = householdRepository;
        window.teamRepository = teamRepository;
        window.zoneRepository = zoneRepository;

        // Attacher les constructeurs à window pour les scripts non-modules qui en ont besoin
        window.ProjectRepository = ProjectRepository;
        window.HouseholdRepository = HouseholdRepository;
        window.TeamRepository = TeamRepository;
        window.ZoneRepository = ZoneRepository;

        console.log('✅ Repositories initialized');

        // 4. Configurer les transports persistants
        logger.addTransport(new IndexedDBTransport(db));

        // 5. Initialiser les services d'infrastructure
        const errorHandler = new ErrorHandler(logger, eventBus);
        const metricsService = new MetricsService(logger, eventBus);
        const syncService = new SyncService(db, eventBus, logger);
        const backupService = new BackupService(db, eventBus, logger);
        const restoreService = new RestoreService(db, eventBus, logger);
        const migrationService = new MigrationService(db, logger);

        window.errorHandler = errorHandler;
        window.metricsService = metricsService;
        window.syncService = syncService;
        window.backupService = backupService;
        window.restoreService = restoreService;
        window.migrationService = migrationService;

        // Attacher les classes
        window.ErrorHandler = ErrorHandler;
        window.MetricsService = MetricsService;
        window.SyncService = SyncService;
        window.BackupService = BackupService;
        window.RestoreService = RestoreService;
        window.MigrationService = MigrationService;

        await backupService.initialize();
        console.log('✅ Infrastructure services initialized');

        // 6. Initialiser les services de domaine
        window.resourceAllocationService = new ResourceAllocationService();
        window.costCalculationService = new CostCalculationService();

        window.ResourceAllocationService = ResourceAllocationService;
        window.CostCalculationService = CostCalculationService;

        console.log('✅ Domain services initialized');

        // 7. Initialiser les services applicatifs
        const projectService = new ProjectService(projectRepository, eventBus);
        const householdService = new HouseholdService(householdRepository, eventBus);

        window.projectService = projectService;
        window.householdService = householdService;

        window.ProjectService = ProjectService;
        window.HouseholdService = HouseholdService;

        console.log('✅ Application services initialized');

        // 8. Gestion de l'état (Stores)
        const projectStore = new ProjectStore(projectService, eventBus);
        storeRegistry.register('project', projectStore);

        window.projectStore = projectStore;
        window.storeRegistry = storeRegistry;

        window.ProjectStore = ProjectStore;

        console.log('✅ Stores initialized');

        // 9. Chargement initial des données
        await loadInitialData(projectRepository);

        const kpiService = new KPIService(
            projectRepository,
            householdRepository,
            teamRepository,
            logger
        );

        window.kpiService = kpiService;
        window.KPIService = KPIService;
        window.ScoreEngine = ScoreEngine;

        console.log('✅ Strategic KPI services initialized');

        // Charger les KPI initiaux pour le dashboard
        try {
            const initialKPIs = await kpiService.getAllKPIs();
            window.initialKPIs = initialKPIs;
            const score = ScoreEngine.calculateIGPP(initialKPIs);
            window.initialIGPP = score;
            console.log(`📊 Initial IGPP Score: ${score.score}/100 (${score.label})`);
        } catch (error) {
            logger.warn('⚠️ KPI initialization warning:', error);
        }

        console.log('🎉 Architecture initialization complete!');
        window.isAppReady = true;

        // Publier un événement de succès
        eventBus.emit('app.initialized', { timestamp: new Date() });

    } catch (error) {
        console.error('❌ Failed to initialize architecture:', error);
        if (window.logger) {
            window.logger.error('Critical initialization error', error);
        }
    }
}

/**
 * Charge les données essentielles au démarrage
 */
async function loadInitialData(projectRepo) {
    try {
        const project = await projectRepo.getCurrent();
        if (project) {
            window.currentProject = project;
            console.log(`📂 Project loaded: ${project.name}`);
        }
    } catch (err) {
        console.warn('⚠️ No active project found or error loading project', err);
    }
}

/**
 * Configuration PWA
 */
function initPWA() {
    // Ajouter le manifest.json s'il n'existe pas
    if (!document.querySelector('link[rel="manifest"]')) {
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = './manifest.json';
        document.head.appendChild(manifestLink);
        console.log('✅ PWA Manifest injecté');
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    console.log('👷 PWA Service Worker registered:', reg.scope);
                })
                .catch(err => {
                    console.log('⚠️ PWA Service Worker registration failed:', err);
                });
        });
    }
}

// Lancement automatique
initPWA();
bootstrap();
