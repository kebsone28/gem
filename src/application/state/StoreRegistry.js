/**
 * Registre central pour tous les stores
 * Singleton pattern
 */
export class StoreRegistry {
    constructor() {
        if (StoreRegistry.instance) {
            return StoreRegistry.instance;
        }

        this.stores = new Map();
        StoreRegistry.instance = this;
    }

    /**
     * Enregistre un store
     */
    register(name, store) {
        if (this.stores.has(name)) {
            console.warn(`Store ${name} already registered, overwriting`);
        }
        this.stores.set(name, store);
        return store;
    }

    /**
     * Obtient un store
     */
    get(name) {
        if (!this.stores.has(name)) {
            throw new Error(`Store ${name} not found`);
        }
        return this.stores.get(name);
    }

    /**
     * Vérifie si un store existe
     */
    has(name) {
        return this.stores.has(name);
    }

    /**
     * Retire un store
     */
    unregister(name) {
        this.stores.delete(name);
    }

    /**
     * Obtient tous les noms de stores
     */
    getStoreNames() {
        return Array.from(this.stores.keys());
    }

    /**
     * Réinitialise tous les stores
     */
    resetAll() {
        for (const store of this.stores.values()) {
            if (typeof store.reset === 'function') {
                store.reset();
            }
        }
    }

    /**
     * Obtient l'instance singleton
     */
    static getInstance() {
        if (!StoreRegistry.instance) {
            new StoreRegistry();
        }
        return StoreRegistry.instance;
    }
}

// Créer l'instance globale
export const storeRegistry = StoreRegistry.getInstance();

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.StoreRegistry = StoreRegistry;
    window.storeRegistry = storeRegistry;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StoreRegistry, storeRegistry };
}
