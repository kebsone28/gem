/**
 * Entité Zone
 * Représente une zone géographique du projet
 */
(function () {
    // Resolve domain dependencies (Entity, TeamType, errors, Household, Team, statuses)
    let _Entity, _TeamType, _ValidationError, _DuplicateEntityError, _Household, _Team, _HouseholdStatus;
    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Entity = require('./Entity');
            _TeamType = require('../../shared/constants/enums').TeamType;
            const errs = require('../../shared/errors/DomainErrors');
            _ValidationError = errs.ValidationError;
            _DuplicateEntityError = errs.DuplicateEntityError;
            _Household = require('./Household');
            _Team = require('./Team');
            _HouseholdStatus = require('../../shared/constants/enums').HouseholdStatus;
        }
    } catch (e) {
        _Entity = typeof window !== 'undefined' ? window.Entity : _Entity;
        _TeamType = typeof window !== 'undefined' ? window.TeamType : _TeamType;
        _ValidationError = typeof window !== 'undefined' ? window.ValidationError : _ValidationError;
        _DuplicateEntityError = typeof window !== 'undefined' ? window.DuplicateEntityError : _DuplicateEntityError;
        _Household = typeof window !== 'undefined' ? window.Household : _Household;
        _Team = typeof window !== 'undefined' ? window.Team : _Team;
        _HouseholdStatus = typeof window !== 'undefined' ? window.HouseholdStatus : _HouseholdStatus;
    }

    const EntityLocal = _Entity?.default || _Entity?.Entity || _Entity;
    const TeamTypeLocal = _TeamType;

    // Utility function to emit events (works in both browser and Node.js environments)
    function emitEvent(eventName, data) {
        // Try window.eventBus first (browser environment)
        if (typeof window !== 'undefined' && window.eventBus) {
            window.eventBus.emit(eventName, data);
        }
        // In Node.js/test environment, we could use a local event emitter or just skip
        // For now, we'll skip event emission in test environments
    }
    const ValidationErrorLocal = _ValidationError;
    const DuplicateEntityErrorLocal = _DuplicateEntityError;
    const HouseholdLocal = _Household?.default || _Household?.Household || _Household;
    const TeamLocal = _Team?.default || _Team?.Team || _Team;
    const HouseholdStatusLocal = _HouseholdStatus;

    class Zone extends (EntityLocal || window.Entity) {

        constructor(id, name, totalHouses, projectId = null) {
            super(id);

            if (!name || name.trim() === '') {
                throw new (ValidationErrorLocal || window.ValidationError)('Zone name is required');
            }
            if (typeof totalHouses !== 'number' || totalHouses <= 0) {
                throw new (ValidationErrorLocal || window.ValidationError)('Total houses must be a positive number');
            }

            this._name = name;
            this._totalHouses = totalHouses;
            this._projectId = projectId;
            this._teams = new Map(); // Map<TeamType, Team[]>
            this._households = [];
            this._completedHouses = 0;
        }

        // Getters
        get name() {
            return this._name;
        }

        get totalHouses() {
            return this._totalHouses;
        }

        get projectId() {
            return this._projectId;
        }

        get completedHouses() {
            return this._completedHouses;
        }

        get teams() {
            return new Map(this._teams);
        }

        get households() {
            return [...this._households];
        }

        /**
         * Assigne une équipe à la zone
         */
        assignTeam(teamType, team) {
            if (!Object.values(TeamTypeLocal || window.TeamType).includes(teamType)) {
                throw new (ValidationErrorLocal || window.ValidationError)(`Invalid team type: ${teamType}`);
            }

            if (!this._teams.has(teamType)) {
                this._teams.set(teamType, []);
            }

            const teams = this._teams.get(teamType);
            if (teams.some(t => t.id === team.id)) {
                throw new (DuplicateEntityErrorLocal || window.DuplicateEntityError)('Team', team.id);
            }

            teams.push(team);
            this.touch();

            emitEvent('zone.team.assigned', {
                zoneId: this.id,
                teamType,
                teamId: team.id
            });

            return this;
        }

        /**
         * Retire une équipe de la zone
         */
        unassignTeam(teamType, teamId) {
            if (!this._teams.has(teamType)) {
                return this;
            }

            const teams = this._teams.get(teamType);
            const index = teams.findIndex(t => t.id === teamId);

            if (index > -1) {
                teams.splice(index, 1);
                this.touch();

                emitEvent('zone.team.unassigned', {
                    zoneId: this.id,
                    teamType,
                    teamId
                });
            }

            return this;
        }

        /**
         * Obtient toutes les équipes d'un type
         */
        getTeamsByType(teamType) {
            return this._teams.get(teamType) || [];
        }

        /**
         * Obtient le nombre total d'équipes
         */
        getTotalTeamCount() {
            let count = 0;
            for (const teams of this._teams.values()) {
                count += teams.length;
            }
            return count;
        }

        /**
         * Vérifie si toutes les équipes nécessaires sont assignées
         */
        hasAllRequiredTeams() {
            const TEAM = TeamTypeLocal || window.TeamType;
            const requiredTypes = [
                TEAM.PREPARATEURS,
                TEAM.LIVRAISON,
                TEAM.MACONS,
                TEAM.RESEAU,
                TEAM.INTERIEUR_TYPE1,
                TEAM.CONTROLE
            ];

            return requiredTypes.every(type =>
                this._teams.has(type) && this._teams.get(type).length > 0
            );
        }

        /**
         * Ajoute un ménage à la zone
         */
        addHousehold(household) {
            if (!(household instanceof (HouseholdLocal || window.Household))) {
                throw new (ValidationErrorLocal || window.ValidationError)('Parameter must be a Household instance');
            }

            if (this._households.some(h => h.id === household.id)) {
                throw new (DuplicateEntityErrorLocal || window.DuplicateEntityError)('Household', household.id);
            }

            this._households.push(household);
            this.touch();

            return this;
        }

        /**
         * Met à jour le nombre de ménages complétés
         */
        updateCompletedHouses(count) {
            if (count < 0 || count > this._totalHouses) {
                throw new (ValidationErrorLocal || window.ValidationError)('Invalid completed houses count');
            }

            this._completedHouses = count;
            this.touch();

            emitEvent('zone.progress.updated', {
                zoneId: this.id,
                completedHouses: count,
                progress: this.getProgress()
            });

            return this;
        }

        /**
         * Calcule le pourcentage de progression
         */
        getProgress() {
            return (this._completedHouses / this._totalHouses) * 100;
        }

        /**
         * Vérifie si la zone est terminée
         */
        isCompleted() {
            return this._completedHouses >= this._totalHouses;
        }

        /**
         * Calcule la durée estimée avec les équipes actuelles
         */
        calculateEstimatedDuration(productivityRates) {
            let maxDuration = 0;

            for (const [teamType, teams] of this._teams.entries()) {
                if (teams.length === 0) continue;

                const rate = productivityRates[teamType];
                if (!rate) continue;

                const duration = rate.calculateDuration(this._totalHouses, teams.length);
                maxDuration = Math.max(maxDuration, duration);
            }

            return maxDuration;
        }

        /**
         * Obtient les ménages par statut
         */
        getHouseholdsByStatus(status) {
            return this._households.filter(h => h.status === status);
        }

        /**
         * Obtient des statistiques sur la zone
         */
        getStats() {
            const statusCounts = {};
            for (const status of Object.values(HouseholdStatusLocal || window.HouseholdStatus)) {
                statusCounts[status] = this.getHouseholdsByStatus(status).length;
            }

            return {
                totalHouses: this._totalHouses,
                completedHouses: this._completedHouses,
                progress: this.getProgress(),
                totalTeams: this.getTotalTeamCount(),
                householdsByStatus: statusCounts,
                hasAllRequiredTeams: this.hasAllRequiredTeams()
            };
        }

        /**
         * Sérialisation JSON
         */
        toJSON() {
            const teamsArray = [];
            for (const [type, teams] of this._teams.entries()) {
                teamsArray.push({
                    type,
                    teams: teams.map(t => t.toJSON())
                });
            }

            return {
                ...super.toJSON(),
                name: this._name,
                totalHouses: this._totalHouses,
                projectId: this._projectId,
                teams: teamsArray,
                households: this._households.map(h => h.toJSON()),
                completedHouses: this._completedHouses
            };
        }

        /**
         * Désérialisation JSON
         */
        static fromJSON(data) {
            const zone = new Zone(
                data.id,
                data.name,
                data.totalHouses,
                data.projectId
            );

            // Reconstruire les équipes
            if (data.teams) {
                for (const { type, teams } of data.teams) {
                    zone._teams.set(type, teams.map(t => (TeamLocal || window.Team).fromJSON(t)));
                }
            }

            // Reconstruire les ménages
            if (data.households) {
                zone._households = data.households.map(h => (HouseholdLocal || window.Household).fromJSON(h));
            }

            zone._completedHouses = data.completedHouses || 0;
            zone._createdAt = new Date(data.createdAt);
            zone._updatedAt = new Date(data.updatedAt);

            return zone;
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.Zone = Zone;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Zone;
    }
})();
