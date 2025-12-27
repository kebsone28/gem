/**
 * Entité Ménage
 * Représente un foyer à électrifier
 */
(function () {
    let _Entity, _Location, _ValidationError, _HouseholdStatus;

    try {
        if (typeof module !== 'undefined' && module.exports) {
            _Entity = require('./Entity');
            _Location = require('../value-objects/Location');
            _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
            const enums = require('../../shared/constants/enums');
            _HouseholdStatus = enums.HouseholdStatus;
        }
    } catch (e) {
        // ignore
    }

    if (!_Entity && typeof window !== 'undefined') {
        _Entity = window.Entity;
    }
    if (!_Location && typeof window !== 'undefined') {
        _Location = window.Location;
    }
    if (!_ValidationError && typeof window !== 'undefined') {
        _ValidationError = window.ValidationError;
    }
    if (!_HouseholdStatus && typeof window !== 'undefined') {
        _HouseholdStatus = window.HouseholdStatus;
    }

    const EntityLocal = _Entity?.default || _Entity?.Entity || _Entity;
    const LocationLocal = _Location?.default || _Location?.Location || _Location;
    const ValidationErrorLocal = _ValidationError;
    const HouseholdStatusLocal = _HouseholdStatus;

    // Utility function to emit events (works in both browser and Node.js environments)
    function emitEvent(eventName, data) {
        // Try window.eventBus first (browser environment)
        if (typeof window !== 'undefined' && window.eventBus) {
            window.eventBus.emit(eventName, data);
        }
        // In Node.js/test environment, we could use a local event emitter or just skip
        // For now, we'll skip event emission in test environments
    }

    class Household extends (EntityLocal || window.Entity) {
        constructor(id, location, owner, status = 'En attente') {
            super(id);

            if (!location) {
                throw new (ValidationErrorLocal || window.ValidationError)('Location is required');
            }

            this._location = location;
            this._owner = owner || {};
            this._status = status;
            this._statusHistory = [];
            this._assignedTeams = new Map();
            this._scheduledDates = {};
            this._actualDates = {};
            this._notes = [];
            this._photos = [];

            // Event emitter capability (simple implementation)
            this._listeners = {};
        }

        get location() { return this._location; }
        get owner() { return this._owner; }
        get status() { return this._status; }
        get statusHistory() { return [...this._statusHistory]; }

        // Simple event emitter implementation
        on(event, callback) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(callback);
        }

        emit(event, data) {
            if (this._listeners[event]) {
                this._listeners[event].forEach(cb => cb(data));
            }
        }

        /**
         * Met à jour le statut du ménage
         */
        updateStatus(newStatus, reason = null) {
            const oldStatus = this._status;
            this._status = newStatus;

            this._statusHistory.push({
                from: oldStatus,
                to: newStatus,
                date: new Date(),
                reason
            });

            this.touch();

            emitEvent('household.status.changed', {
                householdId: this.id,
                oldStatus,
                newStatus,
                reason
            });

            return this;
        }

        /**
         * Met à jour la localisation
         */
        updateLocation(newLocation) {
            if (!newLocation) return this;

            // Validation basique
            this._location = newLocation;
            this.touch();

            emitEvent('household.location.changed', {
                householdId: this.id,
                location: newLocation
            });

            return this;
        }

        /**
         * Assigne une équipe
         */
        assignTeam(teamId, role) {
            this._assignedTeams.set(role, teamId);
            this.touch();
            return this;
        }

        /**
         * Programme une activité
         */
        scheduleActivity(activityType, date) {
            if (!(date instanceof Date)) {
                throw new (ValidationErrorLocal || window.ValidationError)('Date must be a Date instance');
            }

            this._scheduledDates[activityType] = date;
            this.touch();

            emitEvent('household.activity.scheduled', {
                householdId: this.id,
                activityType,
                date
            });

            return this;
        }

        /**
         * Enregistre la date effective d'une activité
         */
        recordActivityCompletion(activityType, date) {
            if (!(date instanceof Date)) {
                throw new (ValidationErrorLocal || window.ValidationError)('Date must be a Date instance');
            }

            this._actualDates[activityType] = date;
            this.touch();

            emitEvent('household.activity.completed', {
                householdId: this.id,
                activityType,
                date
            });

            return this;
        }

        /**
         * Ajoute une note
         */
        addNote(content, author) {
            const note = {
                content,
                author,
                timestamp: new Date()
            };

            this._notes.push(note);
            this.touch();

            return this;
        }

        get photos() { return [...(this._photos || [])]; }

        /**
         * Ajoute une photo
         * @param {Object} photoData { url, type, date, author }
         */
        addPhoto(photoData) {
            if (!this._photos) this._photos = [];

            // Évite les doublons basés sur l'URL
            if (!this._photos.find(p => p.url === photoData.url)) {
                this._photos.push({
                    url: photoData.url,
                    type: photoData.type || 'Autre',
                    date: photoData.date || new Date(),
                    author: photoData.author || 'Système'
                });
                this.touch();
            }
            return this;
        }

        /**
         * Vérifie si le ménage est terminé
         */
        isCompleted() {
            const HS = HouseholdStatusLocal || window.HouseholdStatus;
            return HS && this._status === HS.COMPLETED;
        }

        /**
         * Vérifie si le ménage est bloqué
         */
        isBlocked() {
            const HS = HouseholdStatusLocal || window.HouseholdStatus;
            return HS && this._status === HS.BLOCKED;
        }

        /**
         * Obtient le délai entre programmation et réalisation
         */
        getDelay(activityType) {
            const scheduled = this._scheduledDates[activityType];
            const actual = this._actualDates[activityType];

            if (!scheduled || !actual) return null;

            const diffTime = actual - scheduled;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // en jours
        }

        /**
         * Sérialisation JSON
         */
        toJSON() {
            return {
                ...super.toJSON(),
                location: this._location.toJSON ? this._location.toJSON() : this._location,
                owner: this._owner,
                status: this._status,
                statusHistory: this._statusHistory,
                assignedTeams: Array.from(this._assignedTeams.entries()),
                scheduledDates: this._scheduledDates,
                actualDates: this._actualDates,
                notes: this._notes,
                photos: this._photos
            };
        }

        /**
         * Désérialisation JSON
         */
        static fromJSON(data) {
            const Loc = LocationLocal || window.Location;
            const household = new Household(
                data.id,
                Loc && typeof Loc.fromJSON === 'function' ? Loc.fromJSON(data.location) : data.location,
                data.owner,
                data.status
            );

            household._statusHistory = data.statusHistory || [];
            household._assignedTeams = new Map(data.assignedTeams || []);
            household._scheduledDates = data.scheduledDates || {};
            household._actualDates = data.actualDates || {};
            household._notes = data.notes || [];
            household._photos = data.photos || [];
            household._createdAt = new Date(data.createdAt);
            household._updatedAt = new Date(data.updatedAt);

            return household;
        }
    }

    // Export pour utilisation globale
    if (typeof window !== 'undefined') {
        window.Household = Household;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Household;
    }
})();
