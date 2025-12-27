/**
 * Matrice des transitions autorisées entre statuts RÉELS
 * Workflow d'électrification terrain
 */

// Protection contre double chargement
if (typeof window.StatusTransitions === 'undefined') {

    const HS = window.HouseholdStatus || {
        INELIGIBLE: 'Inéligible',
        INJOIGNABLE: 'Injoignable',
        ATTENTE_DEMARRAGE: 'Attente démarrage',
        ATTENTE_MACON: 'Attente Maçon',
        ATTENTE_BRANCHEMENT: 'Attente Branchement',
        ATTENTE_ELECTRICIEN: 'Attente électricien',
        ATTENTE_CONTROLEUR: 'Attente Controleur',
        ATTENTE_ELECTRICIEN_X: 'Attente électricien(X)',
        CONFORME: 'Conforme'
    };

    /**
     * Transitions logiques du workflow
     */
    const StatusTransitions = {
        // Début du processus
        [HS.ATTENTE_DEMARRAGE]: [HS.ATTENTE_MACON, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Travaux maçonnerie
        [HS.ATTENTE_MACON]: [HS.ATTENTE_BRANCHEMENT, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Branchement réseau
        [HS.ATTENTE_BRANCHEMENT]: [HS.ATTENTE_ELECTRICIEN, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Installation électrique
        [HS.ATTENTE_ELECTRICIEN]: [HS.ATTENTE_CONTROLEUR, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Contrôle qualité
        [HS.ATTENTE_CONTROLEUR]: [HS.CONFORME, HS.ATTENTE_ELECTRICIEN_X, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Correction après contrôle
        [HS.ATTENTE_ELECTRICIEN_X]: [HS.ATTENTE_CONTROLEUR, HS.CONFORME, HS.INJOIGNABLE, HS.INELIGIBLE],

        // Injoignable peut revenir dans le flux
        [HS.INJOIGNABLE]: [HS.ATTENTE_DEMARRAGE, HS.ATTENTE_MACON, HS.ATTENTE_BRANCHEMENT, HS.ATTENTE_ELECTRICIEN, HS.INELIGIBLE],

        // États terminaux
        [HS.CONFORME]: [],
        [HS.INELIGIBLE]: []
    };

    /**
     * Valide si une transition est autorisée
     */
    function validateStatusTransition(currentStatus, newStatus) {
        if (!currentStatus || currentStatus === null || currentStatus === undefined) {
            return {
                valid: true,
                message: null
            };
        }

        const allowedTransitions = StatusTransitions[currentStatus] || [];
        const isValid = allowedTransitions.includes(newStatus);

        if (!isValid) {
            return {
                valid: false,
                message: `Transition non autorisée : "${currentStatus}" → "${newStatus}"`
            };
        }

        return {
            valid: true,
            message: null
        };
    }

    /**
     * Récupère tous les statuts possibles depuis un statut donné
     */
    function getAvailableTransitions(currentStatus) {
        if (!currentStatus) {
            return [HS.ATTENTE_DEMARRAGE, HS.INJOIGNABLE];
        }

        return StatusTransitions[currentStatus] || [];
    }

    /**
     * Vérifie si un statut est terminal
     */
    function isTerminalStatus(status) {
        const transitions = StatusTransitions[status] || [];
        return transitions.length === 0;
    }

    // Export
    if (typeof window !== 'undefined') {
        window.StatusTransitions = StatusTransitions;
        window.validateStatusTransition = validateStatusTransition;
        window.getAvailableTransitions = getAvailableTransitions;
        window.isTerminalStatus = isTerminalStatus;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            StatusTransitions,
            validateStatusTransition,
            getAvailableTransitions,
            isTerminalStatus
        };
    }

} // Fin protection double chargement
