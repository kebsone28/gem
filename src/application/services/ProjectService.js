// (function () {
'use strict';



/**
 * Service applicatif pour la gestion des projets
 * Orchestre les opérations sur les projets
 */
export class ProjectService {
    constructor(projectRepository, zoneRepository, teamRepository, eventBus) {
        this.projectRepo = projectRepository;
        this.zoneRepo = zoneRepository;
        this.teamRepo = teamRepository;
        this.eventBus = eventBus;
        this._assignmentsIndex = null;
    }

    /**
     * Enumération officielle des types de métiers pour les affectations
     */
    static get TEAM_TYPES() {
        if (typeof window !== 'undefined' && window.TeamType) {
            return window.TeamType;
        }
        return Object.freeze({
            MACONS: 'macons',
            RESEAU: 'reseau',
            INTERIEUR_TYPE1: 'interieur_type1',
            INTERIEUR_TYPE2: 'interieur_type2',
            CONTROLE: 'controle',
            LIVRAISON: 'livraison',   // ← ajout
            SUPERVISEUR: 'superviseur'  // ← ajout
        });
    }

    get TEAM_TYPES() {
        return ProjectService.TEAM_TYPES;
    }

    /**
     * Migre le projet vers la version 2 (format d'affectation SaaS)
     * @param {Object} project 
     */
    async migrateToV2(project) {
        if (!project.config) project.config = {};

        // Si déjà en V2, rien à faire (Vérification au niveau racine comme défini en Phase 11)
        if (project.version >= 2 || project.config.version >= 2) return;

        console.info(`[Migration] Migrating project ${project.id} to V2...`);

        const oldAssignments = project.config.grappe_assignments || {};
        const newAssignments = {};
        const allTeams = await this.teamRepo.findAll();

        for (const [sgId, value] of Object.entries(oldAssignments)) {
            // Initialiser la structure vide normalisée
            newAssignments[sgId] = {
                macons: [],
                reseau: [],
                interieur_type1: [],
                interieur_type2: [],
                controle: [],
                livraison: [],    // ← ajout
                superviseur: []   // ← ajout
            };

            const legacyMap = {
                // Legacy keys from old index.html frontend
                'mason': 'macons',
                'network': 'reseau',
                'interior': 'interieur_type1',
                'control': 'controle',
                // New SaaS frontend teamId keys
                'team_macons': 'macons',
                'team_reseau': 'reseau',
                'team_interieur': 'interieur_type1',
                'team_livraison': 'livraison',
                'team_controle': 'controle',
            };

            // Cas 1: C'est déjà une structure d'objet (partielle ou totale)
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                for (const [rawKey, teamIds] of Object.entries(value)) {
                    const targetKey = legacyMap[rawKey] || rawKey;
                    const val = Array.isArray(teamIds) ? teamIds : [teamIds];

                    if (newAssignments[sgId][targetKey] !== undefined) {
                        newAssignments[sgId][targetKey] = val.map(idOrName => {
                            const team = allTeams.find(t => String(t.id) === String(idOrName) || t.name === idOrName);
                            return team ? team.id : idOrName;
                        });
                    }
                }
            }
            // Cas 2: C'est un format legacy "sg-id": "Nom Équipe" -> par défaut métier INTERIEUR_TYPE1
            else if (typeof value === 'string' && value.trim() !== '') {
                const team = allTeams.find(t => String(t.id) === String(value) || t.name === value);
                if (team) {
                    newAssignments[sgId].interieur_type1 = [team.id];
                } else {
                    // On garde la chaîne brute (vraisemblablement un nom d'équipe)
                    newAssignments[sgId].interieur_type1 = [value];
                }
            }
        }

        project.config.grappe_assignments = newAssignments;
        project.version = 2;
        project.config.migrated_at = new Date().toISOString();

        await this.projectRepo.save(project);
        console.info(`[Migration] Project ${project.id} successfully migrated to V2.`);
        this.rebuildIndex(project);
    }

    /**
     * Crée un nouveau projet
     */
    async createProject(data) {
        try {
            // Valider les données
            this.validateProjectData(data);

            // Créer le projet
            const project = new Project(
                data.id || `project-${Date.now()}`,
                data.name,
                data.totalHouses,
                data.startDate instanceof Date ? data.startDate : new Date(data.startDate)
            );

            // Ajouter les zones si fournies
            if (data.zones && Array.isArray(data.zones)) {
                for (const zoneData of data.zones) {
                    const zone = new Zone(
                        zoneData.id || `zone-${Date.now()}-${Math.random()}`,
                        zoneData.name,
                        zoneData.totalHouses,
                        project.id
                    );
                    project.addZone(zone);
                }
            }

            // Définir le budget si fourni
            if (data.budget) {
                const budget = data.budget instanceof Cost
                    ? data.budget
                    : new Cost(data.budget.amount, data.budget.currency);
                project.setBudget(budget);
            }

            // Définir les paramètres
            if (data.parameters) {
                project.setParameters(data.parameters);
            }

            // Sauvegarder
            await this.projectRepo.save(project);

            // Sauvegarder les zones
            for (const zone of project.zones) {
                await this.zoneRepo.save(zone);
            }

            this.eventBus.emit('project.created', {
                projectId: project.id,
                name: project.name
            });

            return project;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    /**
     * Met à jour un projet
     */
    async updateProject(projectId, updates) {
        try {
            const project = await this.projectRepo.findById(projectId);
            if (!project) {
                throw new Error(`Project ${projectId} not found`);
            }

            // Appliquer les mises à jour
            if (updates.name) project._name = updates.name;
            if (updates.budget) project.setBudget(updates.budget);
            if (updates.parameters) project.setParameters(updates.parameters);

            // Sauvegarder
            await this.projectRepo.save(project);

            this.eventBus.emit('project.updated', {
                projectId: project.id
            });

            return project;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    /**
     * Démarre un projet
     */
    async startProject(projectId) {
        try {
            const project = await this.projectRepo.findById(projectId);
            if (!project) {
                throw new Error(`Project ${projectId} not found`);
            }

            // Démarrer le projet (validation automatique)
            project.start();

            // Sauvegarder
            await this.projectRepo.save(project);

            return project;
        } catch (error) {
            console.error('Error starting project:', error);
            throw error;
        }
    }

    /**
     * Termine un projet
     */
    async completeProject(projectId) {
        try {
            const project = await this.projectRepo.findById(projectId);
            if (!project) {
                throw new Error(`Project ${projectId} not found`);
            }

            project.complete();
            await this.projectRepo.save(project);

            return project;
        } catch (error) {
            console.error('Error completing project:', error);
            throw error;
        }
    }

    /**
     * Obtient un projet avec toutes ses données
     */
    async getProjectWithDetails(projectId) {
        try {
            const project = await this.projectRepo.findById(projectId);
            if (!project) {
                throw new Error(`Project ${projectId} not found`);
            }

            // Charger les zones
            const zones = await this.zoneRepo.findByProject(projectId);

            // Charger les équipes pour chaque zone
            for (const zone of zones) {
                const teams = await this.teamRepo.findByZone(zone.id);
                for (const team of teams) {
                    zone.assignTeam(team.type, team);
                }
            }

            return {
                project,
                zones,
                stats: project.getStats()
            };
        } catch (error) {
            console.error('Error getting project details:', error);
            throw error;
        }
    }

    /**
     * Liste tous les projets
     */
    async listProjects(filters = {}) {
        try {
            let projects;

            if (filters.status) {
                projects = await this.projectRepo.findByStatus(filters.status);
            } else {
                projects = await this.projectRepo.findAll();
            }

            return projects;
        } catch (error) {
            console.error('Error listing projects:', error);
            throw error;
        }
    }

    /**
     * Supprime un projet
     */
    async deleteProject(projectId) {
        try {
            // Supprimer les zones associées
            const zones = await this.zoneRepo.findByProject(projectId);
            for (const zone of zones) {
                await this.zoneRepo.delete(zone.id);
            }

            // Supprimer le projet
            await this.projectRepo.delete(projectId);

            this.eventBus.emit('project.deleted', {
                projectId
            });
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    /**
     * Reconstruit l'index de performance pour les affectations
     */
    /**
     * Construit l'index de recherche pour les affectations.
     * SaaS-Grade: Gère la migration, le nettoyage et l'organisation sous project.index.
     */
    rebuildIndex(project, options = { migrate: false }) {
        const proj = project || this.project;
        if (!proj) return;
        const assignments = proj.config?.grappe_assignments || {};
        const registry = typeof window !== 'undefined' ? window.TeamRegistry : null;

        let hasLegacyKeys = false;
        const index = {
            bySubGrappe: {},
            byTeam: {},
            byType: {}
        };

        // Initialize types from registry or fallback
        const typeIds = registry ? registry.getIds() : ['mason', 'network', 'interior', 'control'];
        typeIds.forEach(id => index.byType[id] = []);

        for (const [sgId, types] of Object.entries(assignments)) {
            if (!types || typeof types !== 'object') continue;

            const normalizedSg = {};
            for (const [rawType, teamIds] of Object.entries(types)) {
                if (!Array.isArray(teamIds)) continue;

                const mappedKey = registry ? registry.normalizeId(rawType) : rawType.toLowerCase();

                // Detection of legacy keys (plural, lowercase mismatches, etc.)
                if (mappedKey !== rawType) {
                    hasLegacyKeys = true;
                }

                if (!normalizedSg[mappedKey]) normalizedSg[mappedKey] = [];

                teamIds.forEach(id => {
                    if (!normalizedSg[mappedKey].some(ex => String(ex) === String(id))) {
                        normalizedSg[mappedKey].push(id);
                    }
                    if (!index.byTeam[id]) index.byTeam[id] = [];
                    if (!index.byTeam[id].some(exSg => String(exSg) === String(sgId))) {
                        index.byTeam[id].push(sgId);
                    }
                });

                if (index.byType[mappedKey] && !index.byType[mappedKey].includes(sgId)) {
                    index.byType[mappedKey].push(sgId);
                }
            }
            index.bySubGrappe[sgId] = normalizedSg;
        }

        // Persistence decision (CTO rule: no side-effects unless explicit)
        if (options.migrate && hasLegacyKeys) {
            console.log("💾 Definitive Migration: Cleaning legacy assignment keys...");
            proj.config.grappe_assignments = index.bySubGrappe;

            if (typeof window !== 'undefined' && window.ProjectRepository) {
                window.ProjectRepository.save(proj).catch(err => {
                    console.error("Migration save failed:", err);
                });
            }
        }

        // Organization under project.index (CTO requirement)
        proj.index = index;
        this._assignmentsIndex = index;
        if (proj.config) proj.config.assignments_updated_at = new Date().toISOString();
    }



    /**
     * Valide la structure des affectations
     */
    validateAssignments(project) {
        const assignments = project.config?.grappe_assignments;
        if (!assignments || typeof assignments !== 'object') {
            return false;
        }

        const validTypes = Object.values(ProjectService.TEAM_TYPES);
        for (const [sgId, types] of Object.entries(assignments)) {
            if (typeof types !== 'object') return false;

            for (const type of validTypes) {
                if (!Array.isArray(types[type])) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Helpers Métier (API officielle)
     * Supporte le polymorphisme : 
     * - getAssignments(project) -> Retourne tout l'objet grappe_assignments
     * - getAssignments(sgId) -> Retourne les affectations spécifiques d'une sous-grappe (via index ou config)
     */
    getAssignments(arg) {
        // Cas 1: C'est un objet (probablement un Projet)
        if (arg && typeof arg === 'object' && arg.config) {
            return arg.config.grappe_assignments || {};
        }

        // Cas 2: C'est un ID de sous-grappe (String)
        if (typeof arg === 'string') {
            // Priority to Manual Configuration (Override)
            if (this.project?.config?.grappe_assignments?.[arg]) {
                return this.project.config.grappe_assignments[arg];
            }

            // Fallback to Index (Performance/Calculated)
            if (this._assignmentsIndex?.bySubGrappe?.[arg]) {
                return this._assignmentsIndex.bySubGrappe[arg];
            }
        }

        return {};
    }

    getTeamsForSubGrappe(projectOrSgId, sgId, type) {
        let teamIds = [];
        // Si appelé avec (sgId, type) -> utilise le projet interne
        if (arguments.length === 2) {
            const id = projectOrSgId;
            const t = sgId;
            teamIds = this.getAssignments(id)?.[t] || [];
        } else {
            // Si appelé avec (project, sgId, type)
            teamIds = projectOrSgId?.config?.grappe_assignments?.[sgId]?.[type] || [];
        }

        // Résolution des noms si possible via le repo
        if (this.teamRepo && teamIds.length > 0) {
            // IMPORTANT: On ne peut pas faire de sync call sur un repo async (IndexedDB), 
            // mais on peut utiliser l'index ou fallback sur l'ID brut dans l'immédiat.
            // L'IA devra hydrater ces noms si besoin.
            return teamIds;
        }

        return teamIds;
    }

    /**
     * Met à jour une affectation spécifique
     */
    updateAssignment(project, sgId, type, teamIds) {
        if (!project) return;
        if (!project.config) project.config = {};
        if (!project.config.grappe_assignments) project.config.grappe_assignments = {};
        if (!project.config.grappe_assignments[sgId]) {
            project.config.grappe_assignments[sgId] = {
                macons: [],
                reseau: [],
                interieur_type1: [],
                interieur_type2: [],
                controle: [],
                livraison: [],
                superviseur: []
            };
        }
        project.config.grappe_assignments[sgId][type] = Array.isArray(teamIds) ? teamIds : [teamIds];
    }

    /**
     * Retire une équipe de toutes les affectations (ex: suite à suppression)
     * Gère la récursivité sur tous les types de métiers officiels
     */
    async removeTeamFromAssignments(project, teamId) {
        const assignments = project.config?.grappe_assignments || {};
        let modified = false;

        const validTypes = Object.values(ProjectService.TEAM_TYPES);

        for (const [sgId, types] of Object.entries(assignments)) {
            if (!types || typeof types !== 'object') continue;

            for (const type of validTypes) {
                if (Array.isArray(types[type])) {
                    const initialLen = types[type].length;
                    types[type] = types[type].filter(id => String(id) !== String(teamId));
                    if (types[type].length !== initialLen) modified = true;
                }
            }
        }

        if (modified) {
            console.info(`[ProjectService] Removed team ${teamId} from all assignments.`);
            await this.projectRepo.save(project);
            this.rebuildIndex(project);
        }
        return modified;
    }

    /**
     * Scan d'intégrité : Détecte les assignations vers des équipes inexistantes
     */
    async validateIntegrity(project) {
        const assignments = project.config?.grappe_assignments || {};
        const allTeams = await this.teamRepo.findAll();
        const validTeamIds = new Set(allTeams.map(t => t.id));
        const orphans = [];

        for (const [sgId, types] of Object.entries(assignments)) {
            for (const [type, ids] of Object.entries(types)) {
                if (!Array.isArray(ids)) continue;
                ids.forEach(id => {
                    // Resilience check: String vs Number comparison
                    const exists = Array.from(validTeamIds).some(validId => String(validId) === String(id));
                    if (!exists) {
                        orphans.push({ sgId, type, teamId: id });
                    }
                });
            }
        }
        return {
            isValid: orphans.length === 0,
            orphanCount: orphans.length,
            orphans: orphans,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Nettoyage automatique des orphelins
     */
    async cleanupOrphans(project) {
        const { orphans } = await this.validateIntegrity(project);
        if (orphans.length === 0) return 0;

        const assignments = project.config?.grappe_assignments || {};
        let count = 0;

        orphans.forEach(o => {
            if (assignments[o.sgId] && Array.isArray(assignments[o.sgId][o.type])) {
                assignments[o.sgId][o.type] = assignments[o.sgId][o.type].filter(id => String(id) !== String(o.teamId));
                count++;
            }
        });

        if (count > 0) {
            await this.projectRepo.save(project);
            this.rebuildIndex(project);
        }
        return count;
    }

    /**
     * Valide les données d'un projet
     */
    validateProjectData(data) {
        if (!data.name || data.name.trim() === '') {
            throw new Error('Project name is required');
        }

        if (!data.totalHouses || data.totalHouses <= 0) {
            throw new Error('Total houses must be positive');
        }

        if (!data.startDate) {
            throw new Error('Start date is required');
        }
    }

    /**
     * Calcule les statistiques globales
     */
    async getGlobalStats() {
        try {
            const projects = await this.projectRepo.findAll();

            const stats = {
                totalProjects: projects.length,
                byStatus: {},
                totalHouses: 0,
                completedHouses: 0
            };

            // Assume ProjectStatus is global or imported
            for (const project of projects) {
                stats.totalHouses += project.totalHouses;
                stats.completedHouses += (project.getCompletedHouses ? project.getCompletedHouses() : 0);
                if (project.status) {
                    stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;
                }
            }

            stats.globalProgress = stats.totalHouses > 0
                ? (stats.completedHouses / stats.totalHouses) * 100
                : 0;

            return stats;
        } catch (error) {
            console.error('Error getting global stats:', error);
            throw error;
        }
    }

    /**
     * calculateWorkshopStats — Transforme les données brutes du projet en statistiques
     * lisibles pour l'interface "Atelier & Chargement".
     *
     * @param {Object} project - L'entité projet.
     * @returns {Object} { global: {prepared, loaded, progress}, regions: { Name: {prepared, loaded, progress, remaining} } }
     */
    calculateWorkshopStats(project) {
        if (!project) return null;
        const workshopData = project.config?.logistics_workshop || {};
        const regionalData = workshopData.regions || {};

        const stats = {
            global: {
                kitsPrepared: workshopData.kitsPrepared || 0,
                kitsLoaded: workshopData.kitsLoaded || 0,
                progress: 0
            },
            regions: {}
        };

        if (stats.global.kitsPrepared > 0) {
            stats.global.progress = Math.round((stats.global.kitsLoaded / stats.global.kitsPrepared) * 100);
        }

        for (const [regionName, data] of Object.entries(regionalData)) {
            const prepared = data.kitsPrepared || 0;
            const loaded = data.kitsLoaded || 0;
            stats.regions[regionName] = {
                kitsPrepared: prepared,
                kitsLoaded: loaded,
                progress: prepared > 0 ? Math.round((loaded / prepared) * 100) : 0,
                remaining: Math.max(0, prepared - loaded)
            };
        }

        return stats;
    }

    /**
     * updateRegionalWorkshop — Incrémente les compteurs de kits pour une région.
     * Gère automatiquement la mise à jour parallèle des totaux globaux.
     *
     * @param {Object} project       - L'entité projet à modifier.
     * @param {string} regionName    - Nom de la région (ex: 'Kaffrine') ou 'global'.
     * @param {number} addedPrepared - Nb de nouveaux kits assemblés.
     * @param {number} addedLoaded   - Nb de nouveaux kits chargés en véhicule.
     * @returns {Object} Le projet mis à jour.
     */
    updateRegionalWorkshop(project, regionName, addedPrepared, addedLoaded) {
        if (!project.config) project.config = {};
        if (!project.config.logistics_workshop) {
            project.config.logistics_workshop = { kitsPrepared: 0, kitsLoaded: 0, regions: {} };
        }

        const workshop = project.config.logistics_workshop;
        if (!workshop.regions) workshop.regions = {};

        if (regionName === 'global') {
            workshop.kitsPrepared += addedPrepared;
            workshop.kitsLoaded += addedLoaded;
        } else {
            if (!workshop.regions[regionName]) {
                workshop.regions[regionName] = { kitsPrepared: 0, kitsLoaded: 0 };
            }

            workshop.regions[regionName].kitsPrepared += addedPrepared;
            workshop.regions[regionName].kitsLoaded += addedLoaded;

            // Mettre à jour les totaux globaux
            workshop.kitsPrepared += addedPrepared;
            workshop.kitsLoaded += addedLoaded;
        }

        return project;
    }

    /**
     * getWorkshopPredictions — Interroge le moteur IA pour obtenir les prévisions.
     * Basé sur les kits PRÉPARÉS (production atelier) par rapport au total de maisons.
     *
     * @param {Object} project     - L'entité projet.
     * @param {Object} globalStats - Stats courantes issues de calculateWorkshopStats.
     * @returns {Object} { dailyRate, estimatedEndDate, remainingDays }
     */
    getWorkshopPredictions(project, globalStats) {
        if (typeof window === 'undefined' || !window.PredictiveEngine) {
            return { dailyRate: 0, estimatedEndDate: null, remainingDays: Infinity };
        }

        const history = project.config?.logistics_workshop?.history || [];
        // On estime la préparation par rapport au total de maisons
        return window.PredictiveEngine.estimateCompletion(
            project.totalHouses,
            globalStats.kitsPrepared,
            history
        );
    }
}

// Exportation globale
window.ProjectService = ProjectService;

// Export module si possible
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectService;
}
// })();

