/**
 * Value Object pour le taux de productivité
 * Immutable
 */
// // (function () {
// Support both browser globals and CommonJS requires in tests/Node
let DEFAULT_PRODUCTIVITY_LOCAL = null;
let _ValidationError;

try {
    if (false && typeof module !== 'undefined' && module.exports) {
        const enums = require('../../shared/constants/enums');
        DEFAULT_PRODUCTIVITY_LOCAL = enums.DEFAULT_PRODUCTIVITY;
        _ValidationError = require('../../shared/errors/DomainErrors').ValidationError;
    }
} catch (e) {
    // ignore - runtime may be a browser
}

if (!DEFAULT_PRODUCTIVITY_LOCAL && typeof window !== 'undefined') {
    DEFAULT_PRODUCTIVITY_LOCAL = window.DEFAULT_PRODUCTIVITY;
}

if (!_ValidationError && typeof window !== 'undefined') {
    _ValidationError = window.ValidationError;
}

const ValidationErrorLocal = _ValidationError;

export class ProductivityRate {
    constructor(housesPerDay, teamType) {
        if (typeof housesPerDay !== 'number' || housesPerDay <= 0) {
            throw new (ValidationErrorLocal || window.ValidationError)('Houses per day must be a positive number');
        }
        if (!teamType) {
            throw new (ValidationErrorLocal || window.ValidationError)('Team type is required');
        }

        this._housesPerDay = housesPerDay;
        this._teamType = teamType;

        Object.freeze(this);
    }

    get housesPerDay() {
        return this._housesPerDay;
    }

    get teamType() {
        return this._teamType;
    }

    /**
     * Calcule la durée nécessaire pour un nombre de ménages
     */
    calculateDuration(totalHouses, numberOfTeams = 1) {
        if (numberOfTeams <= 0) {
            throw new Error('Number of teams must be positive');
        }
        return Math.ceil(totalHouses / (this._housesPerDay * numberOfTeams));
    }

    /**
     * Calcule le nombre d'équipes nécessaires pour une durée cible
     */
    calculateRequiredTeams(totalHouses, targetDuration) {
        if (targetDuration <= 0) {
            throw new Error('Target duration must be positive');
        }
        return Math.ceil(totalHouses / (this._housesPerDay * targetDuration));
    }

    /**
     * Ajuste le taux avec un facteur d'efficacité
     */
    adjustWithEfficiency(efficiencyFactor) {
        if (efficiencyFactor <= 0 || efficiencyFactor > 2) {
            throw new Error('Efficiency factor must be between 0 and 2');
        }
        return new ProductivityRate(
            this._housesPerDay * efficiencyFactor,
            this._teamType
        );
    }

    /**
     * Égalité
     */
    equals(other) {
        if (!(other instanceof ProductivityRate)) return false;
        return this._housesPerDay === other._housesPerDay &&
            this._teamType === other._teamType;
    }

    /**
     * Représentation textuelle
     */
    toString() {
        return `${this._housesPerDay} ménages/jour (${this._teamType})`;
    }

    /**
     * Sérialisation JSON
     */
    toJSON() {
        return {
            housesPerDay: this._housesPerDay,
            teamType: this._teamType
        };
    }

    /**
     * Désérialisation JSON
     */
    static fromJSON(data) {
        return new ProductivityRate(data.housesPerDay, data.teamType);
    }

    /**
     * Créer depuis les valeurs par défaut
     */
    static fromDefaults(teamType) {
        // SaaS Strict Matching - never rely on UI labels directly
        const normalizedType = (typeof window !== 'undefined' && window.TeamRegistry)
            ? window.TeamRegistry.normalizeId(teamType)
            : teamType;

        const defaultRate = DEFAULT_PRODUCTIVITY_LOCAL ? DEFAULT_PRODUCTIVITY_LOCAL[normalizedType] : null;
        if (!defaultRate) {
            console.warn(`No default productivity for team type: ${teamType} (normalized to ${normalizedType}), using fallback (5)`);
            return new ProductivityRate(5, normalizedType);
        }
        return new ProductivityRate(defaultRate, normalizedType);
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.ProductivityRate = ProductivityRate;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductivityRate;
}
// // })();
