/**
 * Bus d'événements pour la communication découplée entre modules
 * Implémente le pattern Observer/Pub-Sub
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * S'abonner à un événement
     * @param {string} eventName - Nom de l'événement
     * @param {Function} handler - Fonction de traitement
     * @param {Object} options - Options (priority, once)
     */
    on(eventName, handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const listener = {
            handler,
            priority: options.priority || 0,
            once: options.once || false,
            id: this.generateListenerId()
        };

        const handlers = this.listeners.get(eventName);
        handlers.push(listener);

        // Trier par priorité (plus haute en premier)
        handlers.sort((a, b) => b.priority - a.priority);

        return listener.id;
    }

    /**
     * S'abonner à un événement une seule fois
     */
    once(eventName, handler, options = {}) {
        return this.on(eventName, handler, { ...options, once: true });
    }

    /**
     * Se désabonner d'un événement
     */
    off(eventName, handlerOrId) {
        if (!this.listeners.has(eventName)) return;

        const handlers = this.listeners.get(eventName);

        if (typeof handlerOrId === 'function') {
            // Retirer par fonction
            const index = handlers.findIndex(l => l.handler === handlerOrId);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        } else {
            // Retirer par ID
            const index = handlers.findIndex(l => l.id === handlerOrId);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }

        if (handlers.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    /**
     * Émettre un événement
     */
    emit(eventName, data = {}) {
        const event = {
            name: eventName,
            data,
            timestamp: new Date(),
            id: this.generateEventId()
        };

        // Ajouter à l'historique
        this.addToHistory(event);

        if (!this.listeners.has(eventName)) {
            return;
        }

        const handlers = [...this.listeners.get(eventName)];
        const toRemove = [];

        for (const listener of handlers) {
            try {
                listener.handler(data, event);

                if (listener.once) {
                    toRemove.push(listener.id);
                }
            } catch (error) {
                console.error(`Error in event handler for ${eventName}:`, error);

                // Émettre un événement d'erreur
                if (eventName !== 'eventbus.error') {
                    this.emit('eventbus.error', {
                        originalEvent: eventName,
                        error,
                        handler: listener.handler.name || 'anonymous'
                    });
                }
            }
        }

        // Retirer les listeners "once"
        for (const id of toRemove) {
            this.off(eventName, id);
        }
    }

    /**
     * Émettre un événement de manière asynchrone
     */
    async emitAsync(eventName, data = {}) {
        const event = {
            name: eventName,
            data,
            timestamp: new Date(),
            id: this.generateEventId()
        };

        this.addToHistory(event);

        if (!this.listeners.has(eventName)) {
            return;
        }

        const handlers = [...this.listeners.get(eventName)];
        const toRemove = [];

        for (const listener of handlers) {
            try {
                await listener.handler(data, event);

                if (listener.once) {
                    toRemove.push(listener.id);
                }
            } catch (error) {
                console.error(`Error in async event handler for ${eventName}:`, error);

                if (eventName !== 'eventbus.error') {
                    this.emit('eventbus.error', {
                        originalEvent: eventName,
                        error,
                        handler: listener.handler.name || 'anonymous'
                    });
                }
            }
        }

        for (const id of toRemove) {
            this.off(eventName, id);
        }
    }

    /**
     * Retirer tous les listeners d'un événement
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Obtenir le nombre de listeners pour un événement
     */
    listenerCount(eventName) {
        if (!this.listeners.has(eventName)) return 0;
        return this.listeners.get(eventName).length;
    }

    /**
     * Obtenir tous les noms d'événements
     */
    eventNames() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Ajouter à l'historique
     */
    addToHistory(event) {
        this.eventHistory.push(event);

        // Limiter la taille de l'historique
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Obtenir l'historique des événements
     */
    getHistory(eventName = null, limit = 10) {
        let history = this.eventHistory;

        if (eventName) {
            history = history.filter(e => e.name === eventName);
        }

        return history.slice(-limit);
    }

    /**
     * Vider l'historique
     */
    clearHistory() {
        this.eventHistory = [];
    }

    /**
     * Générer un ID unique pour un listener
     */
    generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Générer un ID unique pour un événement
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtenir des statistiques
     */
    getStats() {
        return {
            totalEvents: this.listeners.size,
            totalListeners: Array.from(this.listeners.values())
                .reduce((sum, handlers) => sum + handlers.length, 0),
            historySize: this.eventHistory.length,
            events: this.eventNames().map(name => ({
                name,
                listenerCount: this.listenerCount(name)
            }))
        };
    }
}

// Créer une instance globale
export const eventBus = new EventBus();

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
    window.eventBus = eventBus;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, eventBus };
}
