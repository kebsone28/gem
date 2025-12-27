/**
 * Entité Project (Projet)
 * Agrégat racine pour un projet d'électrification
 */
(function () {
    // Resolve dependencies in Node (tests) and browser
    let _Entity, _ValidationError, _DuplicateEntityError, _EntityNotFoundError, _Cost, _ProjectStatus, _Zone, _InvalidStateError, _ConstraintViolationError;
    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Entity = require('./Entity');
            const errs = require('../../shared/errors/DomainErrors');
            _ValidationError = errs.ValidationError;
            _DuplicateEntityError = errs.DuplicateEntityError;
            _EntityNotFoundError = errs.EntityNotFoundError;
            _InvalidStateError = errs.InvalidStateError;
            _ConstraintViolationError = errs.ConstraintViolationError;
            _Zone = require('./Zone');
            _Cost = require('../value-objects/Cost');
            _ProjectStatus = require('../../shared/constants/enums').ProjectStatus;
        }
    } catch (e) {
        _Entity = typeof window !== 'undefined' ? window.Entity : _Entity;
        _ValidationError = typeof window !== 'undefined' ? window.ValidationError : _ValidationError;
        _DuplicateEntityError = typeof window !== 'undefined' ? window.DuplicateEntityError : _DuplicateEntityError;
        _EntityNotFoundError = typeof window !== 'undefined' ? window.EntityNotFoundError : _EntityNotFoundError;
        _Zone = typeof window !== 'undefined' ? window.Zone : _Zone;
        _Cost = typeof window !== 'undefined' ? window.Cost : _Cost;
        _ProjectStatus = typeof window !== 'undefined' ? window.ProjectStatus : _ProjectStatus;
        _InvalidStateError = typeof window !== 'undefined' ? window.InvalidStateError : _InvalidStateError;
        _ConstraintViolationError = typeof window !== 'undefined' ? window.ConstraintViolationError : _ConstraintViolationError;
    }

    const EntityLocal = _Entity?.default || _Entity?.Entity || _Entity;
    const ValidationErrorLocal = _ValidationError;
    const DuplicateEntityErrorLocal = _DuplicateEntityError;
    const EntityNotFoundErrorLocal = _EntityNotFoundError;
    const CostLocal = _Cost?.default || _Cost?.Cost || _Cost;
    const ProjectStatusLocal = _ProjectStatus;
    const ZoneLocal = _Zone?.default || _Zone?.Zone || _Zone;
    const InvalidStateErrorLocal = _InvalidStateError;
    const ConstraintViolationErrorLocal = _ConstraintViolationError;

    // Utility function to emit events (works in both browser and Node.js environments)
    function emitEvent(eventName, data) {
        // Try window.eventBus first (browser environment)
        if (typeof window !== 'undefined' && window.eventBus) {
            window.eventBus.emit(eventName, data);
        }
        // In Node.js/test environment, we could use a local event emitter or just skip
        // For now, we'll skip event emission in test environments
    }

    class Project extends (EntityLocal || window.Entity) {
        constructor(id, name, totalHouses, startDate, zones = []) {
            super(id);

            if (!name || name.trim() === '') {
                throw new (ValidationErrorLocal || window.ValidationError)('Project name is required');
            }
            if (typeof totalHouses !== 'number' || totalHouses <= 0) {
                throw new (ValidationErrorLocal || window.ValidationError)('Total houses must be a positive number');
            }
            if (!(startDate instanceof Date)) {
                throw new (ValidationErrorLocal || window.ValidationError)('Start date must be a Date instance');
            }

            this._name = name;
            this._totalHouses = totalHouses;
            this._startDate = startDate;
            this._endDate = null;
            this._zones = zones;
            this._status = (ProjectStatusLocal || window.ProjectStatus).PLANNING;
            this._budget = null;
            this._parameters = {};
        }

        // Getters
        get name() {
            return this._name;
        }

        get totalHouses() {
            return this._totalHouses;
        }

        get startDate() {
            return this._startDate;
        }

        get endDate() {
            return this._endDate;
        }

        get zones() {
            return [...this._zones];
        }

        get status() {
            return this._status;
        }

        get budget() {
            return this._budget;
        }

        get parameters() {
            return { ...this._parameters };
        }

        /**
         * Ajoute une zone au projet
         */
        addZone(zone) {
            if (!(zone instanceof (ZoneLocal || window.Zone))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Zone instance');
            }

            if (this._zones.some(z => z.id === zone.id)) {
                throw new (DuplicateEntityErrorLocal || window.DuplicateEntityError)('Zone', zone.id);
            }

            this._zones.push(zone);
            this.touch();

            // TODO: Implement event emission via EventBus
            // this.emit('project.zone.added', {
            //     projectId: this.id,
            //     zoneId: zone.id
            // });

            return this;
        }

        /**
         * Retire une zone du projet
         */
        removeZone(zoneId) {
            const index = this._zones.findIndex(z => z.id === zoneId);
            if (index === -1) {
                throw new (EntityNotFoundErrorLocal || window.EntityNotFoundError)('Zone', zoneId);
            }

            this._zones.splice(index, 1);
            this.touch();

            emitEvent('project.zone.removed', {
                projectId: this.id,
                zoneId
            });

            return this;
        }

        /**
         * Obtient une zone par son ID
         */
        getZone(zoneId) {
            return this._zones.find(z => z.id === zoneId);
        }

        /**
         * Définit le budget du projet
         */
        setBudget(budget) {
            if (!(budget instanceof (CostLocal || window.Cost))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Budget must be a Cost instance');
            }

            this._budget = budget;
            this.touch();

            return this;
        }

        /**
         * Définit les paramètres du projet
         */
        setParameters(parameters) {
            this._parameters = { ...parameters };
            this.touch();

            return this;
        }

        /**
         * Démarre le projet
         */
        start() {
            if (this._status !== (ProjectStatusLocal || window.ProjectStatus).PLANNING) {
                throw new (InvalidStateErrorLocal || window.InvalidStateError)(
                    'Project can only be started from PLANNING status',
                    this._status
                );
            }

            if (!this.canStart()) {
                throw new (ConstraintViolationErrorLocal || window.ConstraintViolationError)(
                    'Project cannot start: missing required teams or zones'
                );
            }

            this._status = (ProjectStatusLocal || window.ProjectStatus).IN_PROGRESS;
            this.touch();

            emitEvent('project.started', {
                projectId: this.id,
                startDate: this._startDate
            });

            return this;
        }

        /**
         * Vérifie si le projet peut démarrer
         */
        canStart() {
            // Au moins une zone
            if (this._zones.length === 0) return false;

            // Toutes les zones doivent avoir des équipes assignées
            return this._zones.every(zone => zone.hasAllRequiredTeams());
        }

        /**
         * Termine le projet
         */
        complete() {
            if (this._status !== (ProjectStatusLocal || window.ProjectStatus).IN_PROGRESS) {
                throw new (InvalidStateErrorLocal || window.InvalidStateError)(
                    'Project can only be completed from IN_PROGRESS status',
                    this._status
                );
            }

            this._status = (ProjectStatusLocal || window.ProjectStatus).COMPLETED;
            this._endDate = new Date();
            this.touch();

            emitEvent('project.completed', {
                projectId: this.id,
                endDate: this._endDate,
                duration: this.getDuration()
            });

            return this;
        }

        /**
         * Met le projet en pause
         */
        pause() {
            if (this._status !== (ProjectStatusLocal || window.ProjectStatus).IN_PROGRESS) {
                throw new (InvalidStateErrorLocal || window.InvalidStateError)(
                    'Only in-progress projects can be paused',
                    this._status
                );
            }

            this._status = (ProjectStatusLocal || window.ProjectStatus).PAUSED;
            this.touch();

            emitEvent('project.paused', {
                projectId: this.id
            });

            return this;
        }

        /**
         * Reprend le projet
         */
        resume() {
            if (this._status !== (ProjectStatusLocal || window.ProjectStatus).PAUSED) {
                throw new (InvalidStateErrorLocal || window.InvalidStateError)(
                    'Only paused projects can be resumed',
                    this._status
                );
            }

            this._status = (ProjectStatusLocal || window.ProjectStatus).IN_PROGRESS;
            this.touch();

            emitEvent('project.resumed', {
                projectId: this.id
            });

            return this;
        }

        /**
         * Annule le projet
         */
        cancel() {
            if (this._status === (ProjectStatusLocal || window.ProjectStatus).COMPLETED) {
                throw new (InvalidStateErrorLocal || window.InvalidStateError)(
                    'Completed projects cannot be cancelled',
                    this._status
                );
            }

            this._status = (ProjectStatusLocal || window.ProjectStatus).CANCELLED;
            this.touch();

            emitEvent('project.cancelled', {
                projectId: this.id
            });

            return this;
        }

        /**
         * Calcule la progression globale du projet
         */
        calculateProgress() {
            if (this._zones.length === 0) return 0;

            const totalCompleted = this._zones.reduce(
                (sum, zone) => sum + zone.completedHouses,
                0
            );

            return (totalCompleted / this._totalHouses) * 100;
        }

        /**
         * Obtient le nombre total de ménages complétés
         */
        getCompletedHouses() {
            return this._zones.reduce(
                (sum, zone) => sum + zone.completedHouses,
                0
            );
        }

        /**
         * Calcule la durée du projet (en jours)
         */
        getDuration() {
            if (!this._endDate) return null;

            const diffTime = this._endDate - this._startDate;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        /**
         * Obtient toutes les équipes du projet
         */
        getAllTeams() {
            const allTeams = [];
            for (const zone of this._zones) {
                for (const teams of zone.teams.values()) {
                    allTeams.push(...teams);
                }
            }
            return allTeams;
        }

        /**
         * Obtient des statistiques globales
         */
        getStats() {
            return {
                name: this._name,
                status: this._status,
                totalHouses: this._totalHouses,
                completedHouses: this.getCompletedHouses(),
                progress: this.calculateProgress(),
                zonesCount: this._zones.length,
                teamsCount: this.getAllTeams().length,
                startDate: this._startDate,
                endDate: this._endDate,
                duration: this.getDuration(),
                budget: this._budget ? this._budget.toJSON() : null
            };
        }

        /**
         * Sérialisation JSON
         */
        toJSON() {
            return {
                ...super.toJSON(),
                name: this._name,
                totalHouses: this._totalHouses,
                startDate: this._startDate.toISOString(),
                endDate: this._endDate ? this._endDate.toISOString() : null,
                zones: this._zones.map(z => z.toJSON()),
                status: this._status,
                budget: this._budget ? this._budget.toJSON() : null,
                parameters: this._parameters
            };
        }

        /**
         * Désérialisation JSON
         */
        static fromJSON(data) {
            const project = new Project(
                data.id,
                data.name,
                data.totalHouses,
                new Date(data.startDate),
                data.zones ? data.zones.map(z => (ZoneLocal || window.Zone).fromJSON(z)) : []
            );

            project._endDate = data.endDate ? new Date(data.endDate) : null;
            project._status = data.status || (ProjectStatusLocal || window.ProjectStatus).PLANNING;
            project._budget = data.budget ? (CostLocal || window.Cost).fromJSON(data.budget) : null;
            project._parameters = data.parameters || {};
            project._createdAt = new Date(data.createdAt);
            project._updatedAt = new Date(data.updatedAt);

            return project;
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.Project = Project;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Project;
    }
})();
