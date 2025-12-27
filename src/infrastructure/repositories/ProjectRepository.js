/**
 * Repository pour les projets
 * Gère la persistance des entités Project
 */
(function () {
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

    class ProjectRepository {
        constructor(database) {
            if (!database) {
                throw new Error('Database is required');
            }
            this.db = database;
        }

        // --- MÉTHODES STATIQUES AMÉLIORÉES ---
        static async getCurrent() {
            if (!window.db) throw new Error('Database (db) not initialized');
            const projects = await window.db.projects.toArray();
            const defaultProject = {
                id: 'default',
                name: 'Projet Sénégal Électrification',
                budget: 500000000, // 500M FCFA
                startDate: new Date().toISOString(),
                duration: 180, // jours
                regions: this._getSenegalRegions(),
                costs: this._getDefaultCosts(),
                logistics: this._getDefaultLogistics(),
                teamCapabilities: this._getDefaultTeamCapabilities(),
                materialUnitCosts: this._getDefaultMaterialCosts(),
                supervisionRatios: this._getDefaultSupervisionRatios()
            };

            if (projects.length === 0) return defaultProject;

            const data = projects[0];
            // Fusion profonde pour garantir la présence des nouveaux champs
            return {
                ...defaultProject,
                ...data,
                costs: { ...defaultProject.costs, ...(data.costs || {}) },
                logistics: {
                    ...defaultProject.logistics,
                    ...(data.logistics || {}),
                    vehicles: { ...defaultProject.logistics.vehicles, ...(data.logistics?.vehicles || {}) }
                },
                teamCapabilities: { ...defaultProject.teamCapabilities, ...(data.teamCapabilities || {}) },
                materialUnitCosts: { ...defaultProject.materialUnitCosts, ...(data.materialUnitCosts || {}) },
                supervisionRatios: { ...defaultProject.supervisionRatios, ...(data.supervisionRatios || {}) }
            };
        }

        /**
         * Met à jour les paramètres globaux du projet.
         */
        static async updateProjectParameters(updates) {
            if (!window.db) throw new Error('Database (db) not initialized');
            const project = await this.getCurrent();

            // Identifier les changements pour l'historique
            const changes = [];
            const timestamp = new Date().toISOString();

            // Fonction récursive simple pour tracer les changements
            const traceChanges = (obj, source, path = '') => {
                for (const key in obj) {
                    const currentPath = path ? `${path}.${key}` : key;
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                        traceChanges(obj[key], source?.[key] || {}, currentPath);
                    } else if (source && source[key] !== obj[key]) {
                        changes.push({ field: currentPath, old: source[key], new: obj[key] });
                    }
                }
            };

            traceChanges(updates, project);

            // Appliquer les mises à jour (avec support optionnel d'écrasement au lieu de fusion)
            const updatedProject = {
                ...project,
                ...updates,
                costs: updates.costs ? (updates.costs._overwrite ? updates.costs : { ...project.costs, ...updates.costs }) : project.costs,
                logistics: updates.logistics ? (updates.logistics._overwrite ? updates.logistics : { ...project.logistics, ...updates.logistics }) : project.logistics,
                teamCapabilities: updates.teamCapabilities ? (updates.teamCapabilities._overwrite ? updates.teamCapabilities : { ...project.teamCapabilities, ...updates.teamCapabilities }) : project.teamCapabilities,
                materialUnitCosts: updates.materialUnitCosts ? (updates.materialUnitCosts._overwrite ? updates.materialUnitCosts : { ...project.materialUnitCosts, ...updates.materialUnitCosts }) : project.materialUnitCosts,
                supervisionRatios: updates.supervisionRatios ? (updates.supervisionRatios._overwrite ? updates.supervisionRatios : { ...project.supervisionRatios, ...updates.supervisionRatios }) : project.supervisionRatios
            };

            // Nettoyer les drapeaux techniques
            if (updatedProject.costs && updatedProject.costs._overwrite) delete updatedProject.costs._overwrite;
            if (updatedProject.logistics && updatedProject.logistics._overwrite) delete updatedProject.logistics._overwrite;
            if (updatedProject.teamCapabilities && updatedProject.teamCapabilities._overwrite) delete updatedProject.teamCapabilities._overwrite;
            if (updatedProject.materialUnitCosts && updatedProject.materialUnitCosts._overwrite) delete updatedProject.materialUnitCosts._overwrite;
            if (updatedProject.supervisionRatios && updatedProject.supervisionRatios._overwrite) delete updatedProject.supervisionRatios._overwrite;

            // Ajouter à l'historique si des changements ont été détectés
            if (changes.length > 0) {
                updatedProject.modificationHistory = updatedProject.modificationHistory || [];
                updatedProject.modificationHistory.unshift({
                    date: timestamp,
                    user: 'Admin', // Valeur par défaut
                    changes: changes
                });

                // Limiter l'historique aux 50 derniers changements
                if (updatedProject.modificationHistory.length > 50) {
                    updatedProject.modificationHistory = updatedProject.modificationHistory.slice(0, 50);
                }
            }

            if (project.id && project.id !== 'default') {
                await window.db.projects.update(project.id, updatedProject);
            } else {
                updatedProject.id = `project-${Date.now()}`;
                await window.db.projects.add(updatedProject);
            }

            if (window.eventBus) {
                window.eventBus.emit('projectUpdated', updatedProject);
            }
            return updatedProject;
        }

        static async addTeamTypeCosts(type, cost, capacity, equipment = []) {
            return this.updateProjectParameters({
                costs: { [`per${type}Team`]: cost },
                teamCapabilities: { [type.toLowerCase()]: { daily: capacity, equipment: equipment } }
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
            return {
                mason: { daily: 2, equipment: ["Truelle", "Niveau", "EPI"] },
                network: { daily: 10, equipment: ["Échelle", "Outil de câblage", "Testeur"] },
                interior: { daily: 8, equipment: ["Perceuse", "Tournevis", "Multimètre"] },
                controller: { daily: 15, equipment: ["Testeur de terre", "Tablette"] },
                preparateur: { daily: 50, equipment: ["Chariot", "Scanneur", "Étiqueteuse"] },
                livreur: { daily: 30, equipment: ["Chariot", "GPS", "Outils de manutention"] },
                supervisor: { daily: 5, equipment: ["Tablette", "Téléphone", "Véhicule"] }
            };
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

        /**
         * Trouve un projet par son ID
         */
        async findById(id) {
            try {
                const data = await this.db.projects.get(id);
                if (!data) return null;
                return this.hydrate(data);
            } catch (error) {
                console.error('Error finding project by ID:', error);
                throw error;
            }
        }

        /**
         * Trouve tous les projets
         */
        async findAll() {
            try {
                const data = await this.db.projects.toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding all projects:', error);
                throw error;
            }
        }

        /**
         * Trouve les projets par statut
         */
        async findByStatus(status) {
            try {
                const data = await this.db.projects
                    .where('status')
                    .equals(status)
                    .toArray();
                return data.map(d => this.hydrate(d));
            } catch (error) {
                console.error('Error finding projects by status:', error);
                throw error;
            }
        }

        /**
         * Sauvegarde un projet
         */
        async save(project) {
            if (!(project instanceof (ProjectLocal || window.Project))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Project instance');
            }

            try {
                const data = this.dehydrate(project);
                await this.db.projects.put(data);

                // Émettre un événement
                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('project.saved', {
                        projectId: project.id
                    });
                }

                return project;
            } catch (error) {
                console.error('Error saving project:', error);
                throw error;
            }
        }

        /**
         * Supprime un projet
         */
        async delete(id) {
            try {
                await this.db.projects.delete(id);

                if (typeof window !== 'undefined' && window.eventBus) {
                    window.eventBus.emit('project.deleted', {
                        projectId: id
                    });
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                throw error;
            }
        }

        /**
         * Compte le nombre de projets
         */
        async count() {
            try {
                return await this.db.projects.count();
            } catch (error) {
                console.error('Error counting projects:', error);
                throw error;
            }
        }

        /**
         * Vérifie si un projet existe
         */
        async exists(id) {
            try {
                const project = await this.db.projects.get(id);
                return !!project;
            } catch (error) {
                console.error('Error checking project existence:', error);
                throw error;
            }
        }

        /**
         * Convertit les données de la DB en entité Project
         */
        hydrate(data) {
            try {
                return (ProjectLocal || window.Project).fromJSON(data);
            } catch (error) {
                console.error('Error hydrating project:', error);
                throw error;
            }
        }

        /**
         * Convertit une entité Project en données pour la DB
         */
        dehydrate(project) {
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
        async search(criteria) {
            try {
                let collection = this.db.projects;

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
                return data.map(d => this.hydrate(d));
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
})();
