/**
 * Gestionnaire d'erreurs global
 * Capture et traite toutes les erreurs de l'application
 */
class ErrorHandler {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.errorCount = 0;
        this.setupGlobalHandlers();
    }

    /**
     * Configure les gestionnaires globaux
     */
    setupGlobalHandlers() {
        // Erreurs non capturées
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                type: 'uncaught_error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Promesses rejetées non gérées
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                type: 'unhandled_promise_rejection',
                promise: event.promise
            });
        });
    }

    /**
     * Gère une erreur
     */
    handleError(error, context = {}) {
        this.errorCount++;

        // Logger l'erreur
        this.logger.error(error.message, error, context);

        // Émettre un événement
        this.eventBus.emit('error.occurred', {
            error,
            context,
            count: this.errorCount
        });

        // Traitement spécifique selon le type d'erreur
        if (error instanceof ValidationError) {
            this.handleValidationError(error);
        } else if (error instanceof ConstraintViolationError) {
            this.handleConstraintError(error);
        } else if (error instanceof EntityNotFoundError) {
            this.handleNotFoundError(error);
        } else if (error instanceof DomainError) {
            this.handleDomainError(error);
        } else {
            this.handleUnknownError(error, context);
        }
    }

    /**
     * Gère une erreur de validation
     */
    handleValidationError(error) {
        this.showNotification(
            'Erreur de validation',
            this.formatValidationErrors(error.details),
            'warning'
        );
    }

    /**
     * Gère une erreur de contrainte
     */
    handleConstraintError(error) {
        this.showNotification(
            'Contrainte violée',
            error.message,
            'warning'
        );
    }

    /**
     * Gère une erreur d'entité non trouvée
     */
    handleNotFoundError(error) {
        this.showNotification(
            'Ressource non trouvée',
            `${error.entityType} avec l'ID ${error.entityId} n'existe pas`,
            'info'
        );
    }

    /**
     * Gère une erreur de domaine
     */
    handleDomainError(error) {
        this.showNotification(
            'Erreur métier',
            error.message,
            'error'
        );
    }

    /**
     * Gère une erreur inconnue
     */
    handleUnknownError(error, context) {
        this.showNotification(
            'Erreur inattendue',
            'Une erreur est survenue. Veuillez réessayer.',
            'error'
        );

        // Envoyer à un service de monitoring externe
        this.sendToMonitoring(error, context);
    }

    /**
     * Formate les erreurs de validation
     */
    formatValidationErrors(details) {
        if (!Array.isArray(details)) {
            return String(details);
        }
        return details.map(d => {
            if (typeof d === 'string') return d;
            return `${d.path || 'field'}: ${d.message}`;
        }).join('\n');
    }

    /**
     * Affiche une notification
     */
    showNotification(title, message, type = 'info') {
        // Break the recursion cycle:
        // legacy-shims.js redirects window.showNotification -> this.showNotification
        // So we cannot call window.showNotification here if it's the redirector.

        // Use direct DOM manipulation or SweetAlert if available
        if (typeof Swal !== 'undefined') {
            const icons = {
                success: 'success',
                error: 'error',
                warning: 'warning',
                info: 'info'
            };

            Swal.fire({
                title: title,
                text: message,
                icon: icons[type] || 'info',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            return;
        }

        // Fallback console if no UI lib available
        console[type === 'error' ? 'error' : 'log'](`[${type.toUpperCase()}] ${title}: ${message}`);
    }

    /**
     * Envoie l'erreur à un service de monitoring
     */
    async sendToMonitoring(error, context) {
        try {
            // Exemple avec un endpoint de monitoring
            const payload = {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                context,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userId: window.currentUser?.id,
                sessionId: window.sessionId
            };

            // Envoyer (à implémenter selon le service utilisé)
            // await fetch('/api/monitoring/errors', {
            //     method: 'POST',
            //     body: JSON.stringify(payload)
            // });

            console.log('Error sent to monitoring:', payload);
        } catch (e) {
            console.error('Failed to send error to monitoring:', e);
        }
    }

    /**
     * Obtient les statistiques d'erreurs
     */
    getStats() {
        return {
            totalErrors: this.errorCount,
            timestamp: new Date()
        };
    }

    /**
     * Réinitialise le compteur
     */
    reset() {
        this.errorCount = 0;
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
