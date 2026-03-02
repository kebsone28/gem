/**
 * Classe de base pour toutes les erreurs de domaine
 */

// (function (global) {
//    // Prevent duplicate declaration
//    if (global.DomainError) return;

export class DomainError extends Error {
    constructor(message, code = 'DOMAIN_ERROR') {
        super(message);
        this.name = 'DomainError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Erreur de validation des données
 */
export class ValidationError extends DomainError {
    constructor(details) {
        super('Validation failed', 'VALIDATION_ERROR');
        this.details = Array.isArray(details) ? details : [details];
    }

    toString() {
        return `ValidationError: ${this.details.map(d => d.message || d).join(', ')}`;
    }
}

/**
 * Erreur de violation de contrainte métier
 */
export class ConstraintViolationError extends DomainError {
    constructor(constraint, details = null) {
        super(`Constraint violated: ${constraint}`, 'CONSTRAINT_VIOLATION');
        this.constraint = constraint;
        this.details = details;
    }
}

/**
 * Erreur d'état invalide
 */
export class InvalidStateError extends DomainError {
    constructor(message, currentState = null) {
        super(message, 'INVALID_STATE');
        this.currentState = currentState;
    }
}

/**
 * Erreur d'entité non trouvée
 */
export class EntityNotFoundError extends DomainError {
    constructor(entityType, id) {
        super(`${entityType} with id ${id} not found`, 'ENTITY_NOT_FOUND');
        this.entityType = entityType;
        this.entityId = id;
    }
}

/**
 * Erreur de duplication d'entité
 */
export class DuplicateEntityError extends DomainError {
    constructor(entityType, identifier) {
        super(`${entityType} with identifier ${identifier} already exists`, 'DUPLICATE_ENTITY');
        this.entityType = entityType;
        this.identifier = identifier;
    }
}

/**
 * Erreur d'infrastructure (base de données, réseau, etc.)
 */
export class InfrastructureError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = 'InfrastructureError';
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.DomainError = DomainError;
    window.ValidationError = ValidationError;
    window.ConstraintViolationError = ConstraintViolationError;
    window.InvalidStateError = InvalidStateError;
    window.EntityNotFoundError = EntityNotFoundError;
    window.DuplicateEntityError = DuplicateEntityError;
    window.InfrastructureError = InfrastructureError;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DomainError,
        ValidationError,
        ConstraintViolationError,
        InvalidStateError,
        EntityNotFoundError,
        DuplicateEntityError,
        InfrastructureError
    };
}
// })(typeof window !== 'undefined' ? window : this);
