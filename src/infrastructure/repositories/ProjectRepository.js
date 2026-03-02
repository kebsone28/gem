/**
 * Repository pour les projets
 * Gère la persistance des entités Project
 */
// (function () {
let _Project, _ValidationError;

try {
    if (typeof module !== 'undefined' && module.exports) {
        _Project = require('../../domain/entities/Project');
        _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
    }
} catch (e) {
    // ignore
}

if (!_Project && typeof window !== 'undefined') {
    _Project = window.Project;
}
if (!_ValidationError && typeof window !== 'undefined') {
    _ValidationError = window.ValidationError;
}

const ProjectLocal = _Project?.default || _Project?.Project || _Project;
const ValidationErrorLocal = _ValidationError;

// Deep merge utility for production-grade config management
function deepMerge(target, source) {
    if (!source) return target;
    for (const key in source) {
        if (source[key] instanceof Object && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

export class ProjectRepository {
    constructor() {
        // Instance compatibility wrapper (stateless)
    }

    // --- MÉTHODES D'INSTANCE (Wrappers pour compatibilité) ---
    async getCurrent() {
        return ProjectRepository.getCurrent();
    }

    async updateProjectParameters(updates) {
        return ProjectRepository.updateProjectParameters(updates);
    }

    async addTeamTypeCosts(teamType, costPerDay) {
        return ProjectRepository.addTeamTypeCosts(teamType, costPerDay);
    }

    static get db() {
        if (typeof window !== 'undefined' && window.db) return window.db;
        throw new Error('[ProjectRepository] Global database (window.db) not found');
    }

    // --- MÉTHODES STATIQUES AMÉLIORÉES ---
    static async getCurrent() {
        if (!window.db) throw new Error('Database (db) not initialized');
        const projects = await window.db.projects.toArray();

        const defaultProjectData = {
            id: 'default',
            name: 'Projet Sénégal Électrification',
            budget: 500000000, // 500M FCFA
            startDate: new Date().toISOString(),
            duration: 180, // jours
            totalHouses: 1000, // MANDATORY for Project validation
            total: 1000,
            regions: this._getSenegalRegions(),
            costs: this._getDefaultCosts(),
            logistics: this._getDefaultLogistics(),
            teamCapabilities: this._getDefaultTeamCapabilities(),
            materialUnitCosts: this._getDefaultMaterialCosts(),
            supervisionRatios: this._getDefaultSupervisionRatios(),
            staffConfig: this._getDefaultStaffConfig(),
            config: {
                grappe_assignments: {}
            }
        };

        if (projects.length === 0) {
            return ProjectRepository.hydrate(defaultProjectData);
        }

        // Prioritize the best project record:
        // 1. One with a numeric ID (Dexie managed)
        // 2. Latest updatedAt
        const sortedProjects = projects.sort((a, b) => {
            const aIdVal = typeof a.id === 'number' ? 1 : 0;
            const bIdVal = typeof b.id === 'number' ? 1 : 0;
            if (aIdVal !== bIdVal) return bIdVal - aIdVal;
            return (new Date(b.updatedAt || 0)) - (new Date(a.updatedAt || 0));
        });

        if (projects.length > 1) {
            console.warn(`[ProjectRepository] Multiple records found (${projects.length}). Cleaning up to ensure single source of truth...`);

            // KEEP ONLY THE BEST MATCH, DELETE OTHERS
            const bestMatch = sortedProjects[0];
            const others = sortedProjects.slice(1);

            // Fire and forget cleanup
            Promise.all(others.map(p => window.db.projects.delete(p.id)))
                .then(() => console.log(`[ProjectRepository] Cleaned up ${others.length} duplicate project records.`))
                .catch(err => console.error('[ProjectRepository] Cleanup failed:', err));

            const data = bestMatch;
            const mergedData = deepMerge({ ...defaultProjectData }, data);
            return ProjectRepository.hydrate(mergedData);
        }

        const data = sortedProjects[0];
        const mergedData = deepMerge({ ...defaultProjectData }, data);
        return ProjectRepository.hydrate(mergedData);
    }

    /**
     * Met à jour les paramètres globaux du projet via merge.
     */
    static async updateProjectParameters(updates) {
        const project = await ProjectRepository.getCurrent();
        const currentData = project.toJSON ? project.toJSON() : project;
        deepMerge(currentData, updates);
        const updatedProject = ProjectRepository.hydrate(currentData);
        await ProjectRepository.save(updatedProject);
    }

    static async addTeamTypeCosts(type, cost, capacity, equipmentCategories = { "Équipements": { icon: "🔧", items: [] } }) {
        return ProjectRepository.updateProjectParameters({
            costs: { [`per${type}Team`]: cost },
            teamCapabilities: { [type.toLowerCase()]: { daily: capacity, equipmentCategories } }
        });
    }

    // ===== STRUCTURES PAR DÉFAUT =====
    static _getSenegalRegions() {
        return [
            { id: 'dk', name: 'Dakar', households: 15000 },
            { id: 'th', name: 'Thiès', households: 12000 },
            { id: 'dl', name: 'Diourbel', households: 8000 },
            { id: 'sl', name: 'Saint-Louis', households: 9000 },
            { id: 'tc', name: 'Tambacounda', households: 5000 },
            { id: 'kl', name: 'Kaolack', households: 10000 },
            { id: 'zg', name: 'Ziguinchor', households: 7000 },
            { id: 'kd', name: 'Kolda', households: 6000 },
            { id: 'mt', name: 'Matam', households: 4000 },
            { id: 'kf', name: 'Kaffrine', households: 6000 },
            { id: 'kd', name: 'Kédougou', households: 3000 },
            { id: 'sd', name: 'Sédhiou', households: 5000 },
            { id: 'fr', name: 'Fatick', households: 7000 },
            { id: 'ln', name: 'Louga', households: 8000 }
        ];
    }

    static _getDefaultCosts() {
        return {
            perMasonTeam: 150000,
            perNetworkTeam: 200000,
            perInteriorTeam: 180000,
            perController: 120000,
            perPreparateurTeam: 100000,
            perLivreurTeam: 80000,
            perSupervisor: 200000,
            perHouseholdLogistics: 50000,
            fuelPerKm: 700,
            vehicleRental: {
                pickup: 50000,
                truck: 80000,
                motorcycle: 15000
            }
        };
    }

    static _getDefaultLogistics() {
        return {
            vehicles: {
                pickup: { count: 0, capacity: 4, fuelConsumption: 12 },
                truck: { count: 0, capacity: 10, fuelConsumption: 18 },
                motorcycle: { count: 0, capacity: 1, fuelConsumption: 3 }
            },
            fuelPrice: 750,
            materialTransportRatio: 0.1
        };
    }

    static _getDefaultTeamCapabilities() {
        return {};
    }

    static _getDefaultMaterialCosts() {
        return {
            potelet: 15000,
            cable16mm: 5000,
            coffret: 30000,
            kitInterieur: 180000
        };
    }

    static _getDefaultSupervisionRatios() {
        return {
            supervisorPerTeam: 0.1,
            controllerPerHousehold: 0.05
        };
    }

    static _getDefaultStaffConfig() {
        return {};
    }

    // --- MÉTHODES STATIQUES (SaaS-GRADE) ---
    static async findById(id) {
        try {
            const data = await ProjectRepository.db.projects.get(id);
            if (!data) return null;
            return ProjectRepository.hydrate(data);
        } catch (error) {
            console.error('Error finding project by ID:', error);
            throw error;
        }
    }

    static async findAll() {
        try {
            const data = await ProjectRepository.db.projects.toArray();
            return data.map(d => ProjectRepository.hydrate(d));
        } catch (error) {
            console.error('Error finding all projects:', error);
            throw error;
        }
    }

    static async findByStatus(status) {
        try {
            const data = await ProjectRepository.db.projects
                .where('status')
                .equals(status)
                .toArray();
            return data.map(d => ProjectRepository.hydrate(d));
        } catch (error) {
            console.error('Error finding projects by status:', error);
            throw error;
        }
    }

    static async save(project) {
        const isValidInstance = project instanceof (ProjectLocal || window.Project) ||
            (project && project.constructor && project.constructor.name === 'Project');

        if (!isValidInstance) {
            throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Project instance');
        }

        try {
            const data = ProjectRepository.dehydrate(project);
            await ProjectRepository.db.projects.put(data);
            if (typeof window !== 'undefined' && window.eventBus) {
                window.eventBus.emit('project.saved', { projectId: project.id });
            }
            return project;
        } catch (error) {
            console.error('Error saving project:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            await ProjectRepository.db.projects.delete(id);
            if (typeof window !== 'undefined' && window.eventBus) {
                window.eventBus.emit('project.deleted', { projectId: id });
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    static async count() {
        try {
            return await ProjectRepository.db.projects.count();
        } catch (error) {
            console.error('Error counting projects:', error);
            throw error;
        }
    }

    static async exists(id) {
        try {
            const project = await ProjectRepository.db.projects.get(id);
            return !!project;
        } catch (error) {
            console.error('Error checking project existence:', error);
            throw error;
        }
    }

    static async search(criteria) {
        try {
            let collection = ProjectRepository.db.projects;
            if (criteria.status) collection = collection.where('status').equals(criteria.status);
            if (criteria.startDateFrom) collection = collection.filter(p => new Date(p.startDate) >= criteria.startDateFrom);
            if (criteria.startDateTo) collection = collection.filter(p => new Date(p.startDate) <= criteria.startDateTo);
            if (criteria.name) collection = collection.filter(p => p.name.toLowerCase().includes(criteria.name.toLowerCase()));
            const data = await collection.toArray();
            return data.map(d => ProjectRepository.hydrate(d));
        } catch (error) {
            console.error('Error searching projects:', error);
            throw error;
        }
    }

    // --- INSTANCE WRAPPERS (Compatibility) ---
    findById(id) { return ProjectRepository.findById(id); }
    findAll() { return ProjectRepository.findAll(); }
    findByStatus(status) { return ProjectRepository.findByStatus(status); }
    save(project) { return ProjectRepository.save(project); }
    delete(id) { return ProjectRepository.delete(id); }
    count() { return ProjectRepository.count(); }
    exists(id) { return ProjectRepository.exists(id); }
    search(criteria) { return ProjectRepository.search(criteria); }
    getCurrent() { return ProjectRepository.getCurrent(); }
    updateProjectParameters(updates) { return ProjectRepository.updateProjectParameters(updates); }
    addTeamTypeCosts(type, cost, capacity, equipmentCategories) { return ProjectRepository.addTeamTypeCosts(type, cost, capacity, equipmentCategories); }

    /**
     * Convertit les données de la DB en entité Project
     */
    static hydrate(data) {
        try {
            const project = (window.Project || _Project).fromJSON(data);

            // On notifie le service global pour qu'il indexe immédiatement ce projet
            if (window.projectService && window.projectService.rebuildIndex) {
                window.projectService.rebuildIndex(project);
            }

            return project;
        } catch (error) {
            console.error('❌ ProjectRepository: Hydration failed');
            console.error('Data causing failure:', JSON.stringify(data, null, 2));
            console.error('Validation error:', error);
            throw error;
        }
    }

    /**
     * Convertit une entité Project en données pour la DB
     */
    static dehydrate(project) {
        try {
            return project.toJSON();
        } catch (error) {
            console.error('Error dehydrating project:', error);
            throw error;
        }
    }

    /**
     * Recherche de projets avec critères
     */
    static async search(criteria) {
        try {
            let collection = ProjectRepository.db.projects;

            if (criteria.status) {
                collection = collection.where('status').equals(criteria.status);
            }

            if (criteria.startDateFrom) {
                collection = collection.filter(p =>
                    new Date(p.startDate) >= criteria.startDateFrom
                );
            }

            if (criteria.startDateTo) {
                collection = collection.filter(p =>
                    new Date(p.startDate) <= criteria.startDateTo
                );
            }

            if (criteria.name) {
                collection = collection.filter(p =>
                    p.name.toLowerCase().includes(criteria.name.toLowerCase())
                );
            }

            const data = await collection.toArray();
            return data.map(d => ProjectRepository.hydrate(d));
        } catch (error) {
            console.error('Error searching projects:', error);
            throw error;
        }
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.ProjectRepository = ProjectRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectRepository;
}
// })();
