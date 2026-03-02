/**
 * Entité de base
 * Toutes les entités du domaine doivent hériter de cette classe
 */
export class Entity {
    constructor(id) {
        this._id = id;
        this._createdAt = new Date();
        this._updatedAt = new Date();
    }

    get id() {
        return this._id;
    }

    get createdAt() {
        return this._createdAt;
    }

    get updatedAt() {
        return this._updatedAt;
    }

    /**
     * Met à jour la date de modification
     */
    touch() {
        this._updatedAt = new Date();
    }

    /**
     * Vérifie l'égalité avec une autre entité
     */
    equals(other) {
        if (!other || !(other instanceof Entity)) {
            return false;
        }
        return this._id === other.id;
    }

    /**
     * Clone l'entité (shallow copy)
     */
    clone() {
        throw new Error('Clone method must be implemented by subclass');
    }

    /**
     * Valide l'entité
     */
    validate() {
        // À implémenter dans les sous-classes
        return true;
    }

    /**
     * Convertit l'entité en objet simple (pour sérialisation)
     */
    toJSON() {
        return {
            id: this._id,
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString()
        };
    }

    /**
     * Crée une entité depuis un objet simple
     */
    static fromJSON(data) {
        throw new Error('fromJSON method must be implemented by subclass');
    }
}

// Export pour utilisation globale (compatibilité)
if (typeof window !== 'undefined') {
    window.Entity = Entity;
}
