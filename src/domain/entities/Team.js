/**
 * Entité Team (Équipe)
 * Représente une équipe de travail
 */
// // (function () {
// Resolve domain dependencies in both Node (tests) and browser (window) environments
let _Entity, _TeamType, _ProductivityRate, _ValidationError, _DuplicateEntityError, _EntityNotFoundError;
try {
    if (false && typeof module !== 'undefined' && module.exports) {
        _Entity = require('./Entity');
        _TeamType = require('../../shared/constants/enums').TeamType;
        _ProductivityRate = require('../value-objects/ProductivityRate');
        const errs = require('../../shared/errors/DomainErrors');
        _ValidationError = errs.ValidationError;
        _DuplicateEntityError = errs.DuplicateEntityError;
        _EntityNotFoundError = errs.EntityNotFoundError;
    }
} catch (e) {
    // browser fallback to globals
    _Entity = typeof window !== 'undefined' ? window.Entity : _Entity;
    _TeamType = typeof window !== 'undefined' ? window.TeamType : _TeamType;
    _ProductivityRate = typeof window !== 'undefined' ? window.ProductivityRate : _ProductivityRate;
    _ValidationError = typeof window !== 'undefined' ? window.ValidationError : _ValidationError;
    _DuplicateEntityError = typeof window !== 'undefined' ? window.DuplicateEntityError : _DuplicateEntityError;
    _EntityNotFoundError = typeof window !== 'undefined' ? window.EntityNotFoundError : _EntityNotFoundError;
}

const EntityLocal = _Entity?.default || _Entity?.Entity || _Entity;
const TeamTypeLocal = _TeamType;
const ProductivityRateLocal = _ProductivityRate?.default || _ProductivityRate?.ProductivityRate || _ProductivityRate;
const ValidationErrorLocal = _ValidationError;
const DuplicateEntityErrorLocal = _DuplicateEntityError;
const EntityNotFoundErrorLocal = _EntityNotFoundError;

// Utility function to emit events (works in both browser and Node.js environments)
function emitEvent(eventName, data) {
    // Try window.eventBus first (browser environment)
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit(eventName, data);
    }
    // In Node.js/test environment, we could use a local event emitter or just skip
    // For now, we'll skip event emission in test environments
}

export class Team extends (EntityLocal || (typeof window !== 'undefined' ? window.Entity : globalThis.Entity)) {
    constructor(id, name, type, members = [], zone = null) {
        super(id);

        this._name = name || id;
        if (!type || typeof type !== 'string') {
            throw new (ValidationErrorLocal || window.ValidationError)(`Invalid team type: ${type}`);
        }

        this._type = type;
        this._members = members;
        this._zone = zone;
        this._startDate = null; // Date de démarrage spécifique
        this._assignedGrappes = []; // Grappes (villages) couvertes
        this._productivityRate = (ProductivityRateLocal || (typeof window !== 'undefined' ? window.ProductivityRate : globalThis.ProductivityRate)).fromDefaults(type);
        this._progressRecords = [];
        this._isActive = true;
        this._config = {};
        this._metadata = {};
    }

    // Getters
    get name() {
        return this._name;
    }

    set name(v) {
        this._name = v;
        this.touch();
    }

    get type() {
        return this._type;
    }

    get members() {
        return [...this._members];
    }

    get zone() {
        return this._zone;
    }

    get productivityRate() {
        return this._productivityRate;
    }

    get isActive() {
        return this._isActive;
    }

    get config() {
        if (!this._config) this._config = {};
        return this._config;
    }
    set config(v) { this._config = v || {}; this.touch(); }

    get metadata() {
        if (!this._metadata) this._metadata = {};
        return this._metadata;
    }
    set metadata(v) { this._metadata = v || {}; this.touch(); }

    get startDate() {
        return this._startDate;
    }

    set startDate(value) {
        this._startDate = value;
        this.touch();
    }

    get assignedGrappes() {
        return [...this._assignedGrappes];
    }

    set assignedGrappes(value) {
        this._assignedGrappes = Array.isArray(value) ? value : [];
        this.touch();
    }

    /**
     * Assigne l'équipe à une zone
     */
    assignToZone(zoneId) {
        this._zone = zoneId;
        this.touch();

        emitEvent('team.assigned', {
            teamId: this.id,
            zoneId
        });

        return this;
    }

    /**
     * Retire l'équipe de sa zone
     */
    unassignFromZone() {
        const oldZone = this._zone;
        this._zone = null;
        this.touch();

        emitEvent('team.unassigned', {
            teamId: this.id,
            zoneId: oldZone
        });

        return this;
    }

    /**
     * Ajoute un membre à l'équipe
     */
    addMember(member) {
        if (this._members.some(m => m.id === member.id)) {
            throw new (DuplicateEntityErrorLocal || window.DuplicateEntityError)('Member', member.id);
        }

        this._members.push(member);
        this.touch();

        emitEvent('team.member.added', {
            teamId: this.id,
            memberId: member.id
        });

        return this;
    }

    /**
     * Retire un membre de l'équipe
     */
    removeMember(memberId) {
        const index = this._members.findIndex(m => m.id === memberId);
        if (index === -1) {
            throw new (EntityNotFoundErrorLocal || window.EntityNotFoundError)('Member', memberId);
        }

        this._members.splice(index, 1);
        this.touch();

        emitEvent('team.member.removed', {
            teamId: this.id,
            memberId
        });

        return this;
    }

    /**
     * Enregistre la progression quotidienne
     */
    recordDailyProgress(date, housesCompleted, hoursWorked) {
        if (!(date instanceof Date)) {
            throw new (ValidationErrorLocal || window.ValidationError)('Date must be a Date instance');
        }
        if (housesCompleted < 0 || hoursWorked < 0) {
            throw new (ValidationErrorLocal || window.ValidationError)('Houses and hours must be positive');
        }

        const record = {
            date,
            housesCompleted,
            hoursWorked,
            productivity: hoursWorked > 0 ? housesCompleted / hoursWorked : 0
        };

        this._progressRecords.push(record);
        this.touch();

        emitEvent('team.progress.recorded', {
            teamId: this.id,
            date,
            housesCompleted,
            hoursWorked
        });

        return this;
    }

    /**
     * Calcule la productivité moyenne
     */
    getAverageProductivity(days = null) {
        let records = this._progressRecords;

        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            records = records.filter(r => r.date >= cutoffDate);
        }

        if (records.length === 0) return 0;

        const totalHouses = records.reduce((sum, r) => sum + r.housesCompleted, 0);
        const totalDays = records.length;

        return totalHouses / totalDays;
    }

    /**
     * Calcule l'efficacité (productivité réelle / productivité théorique)
     */
    getEfficiency(days = null) {
        const actualProductivity = this.getAverageProductivity(days);
        const theoreticalProductivity = this._productivityRate.housesPerDay;

        if (theoreticalProductivity === 0) return 0;

        return (actualProductivity / theoreticalProductivity) * 100;
    }

    /**
     * Obtient le total de ménages complétés
     */
    getTotalHousesCompleted() {
        return this._progressRecords.reduce((sum, r) => sum + r.housesCompleted, 0);
    }

    /**
     * Obtient le total d'heures travaillées
     */
    getTotalHoursWorked() {
        return this._progressRecords.reduce((sum, r) => sum + r.hoursWorked, 0);
    }

    /**
     * Définit un taux de productivité personnalisé
     */
    setCustomProductivityRate(housesPerDay) {
        this._productivityRate = new (ProductivityRateLocal || (typeof window !== 'undefined' ? window.ProductivityRate : globalThis.ProductivityRate))(housesPerDay, this._type);
        this.touch();

        return this;
    }

    /**
     * Active ou désactive l'équipe
     */
    setActive(isActive) {
        this._isActive = isActive;
        this.touch();

        emitEvent('team.status.changed', {
            teamId: this.id,
            isActive
        });

        return this;
    }

    /**
     * Sérialisation JSON
     */
    toJSON() {
        return {
            ...super.toJSON(),
            name: this._name,
            type: this._type,
            members: this._members,
            zone: this._zone,
            startDate: this._startDate,
            assignedGrappes: this._assignedGrappes,
            productivityRate: this._productivityRate.toJSON(),
            progressRecords: this._progressRecords.map(r => ({
                ...r,
                date: r.date.toISOString()
            })),
            isActive: this._isActive,
            config: this._config,
            metadata: this._metadata
        };
    }

    /**
     * Désérialisation JSON
     */
    static fromJSON(data) {
        const team = new Team(
            data.id,
            data.name,
            data.type,
            data.members || [],
            data.zone
        );

        team._startDate = data.startDate || null;
        team._assignedGrappes = data.assignedGrappes || [];

        const productivityRateData = data.productivityRate || { housesPerDay: 5, teamType: data.type };
        team._productivityRate = (ProductivityRateLocal || (typeof window !== 'undefined' ? window.ProductivityRate : globalThis.ProductivityRate)).fromJSON(productivityRateData);
        team._progressRecords = (data.progressRecords || []).map(r => ({
            ...r,
            date: new Date(r.date)
        }));
        team._isActive = data.isActive !== undefined ? data.isActive : true;
        team._config = data.config || {};
        team._metadata = data.metadata || {};
        team._createdAt = new Date(data.createdAt);
        team._updatedAt = new Date(data.updatedAt);

        return team;
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.Team = Team;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Team;
}
// // })();
