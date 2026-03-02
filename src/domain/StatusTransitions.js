/**
 * Matrice des transitions autorisées entre statuts RÉELS
 * Workflow d'électrification terrain
 */

// Protection contre double chargement
if (typeof window.StatusTransitions === 'undefined') {

    const HS = window.HouseholdStatus || {
        NON_DEBUTE: 'Non débuté',
        MURS_EN_COURS: 'Murs: En cours',
        MURS_TERMINE: 'Murs: Terminé',
        RESEAU_EN_COURS: 'Réseau: En cours',
        RESEAU_TERMINE: 'Réseau: Terminé',
        INTERIEUR_EN_COURS: 'Intérieur: En cours',
        INTERIEUR_TERMINE: 'Intérieur: Terminé',
        RECEPTION_VALIDEE: 'Réception: Validée',
        PROBLEME: 'Problème',
        INELIGIBLE: 'Inéligible'
    };

    /**
     * Transitions logiques du workflow
     */
    const StatusTransitions = {
        [HS.NON_DEBUTE]: [HS.MURS_EN_COURS, HS.PROBLEME, HS.INELIGIBLE],
        [HS.MURS_EN_COURS]: [HS.MURS_TERMINE, HS.PROBLEME, HS.INELIGIBLE],
        [HS.MURS_TERMINE]: [HS.RESEAU_EN_COURS, HS.PROBLEME, HS.INELIGIBLE],
        [HS.RESEAU_EN_COURS]: [HS.RESEAU_TERMINE, HS.PROBLEME, HS.INELIGIBLE],
        [HS.RESEAU_TERMINE]: [HS.INTERIEUR_EN_COURS, HS.PROBLEME, HS.INELIGIBLE],
        [HS.INTERIEUR_EN_COURS]: [HS.INTERIEUR_TERMINE, HS.PROBLEME, HS.INELIGIBLE],
        [HS.INTERIEUR_TERMINE]: [HS.RECEPTION_VALIDEE, HS.PROBLEME, HS.INELIGIBLE],
        [HS.PROBLEME]: [HS.INTERIEUR_EN_COURS, HS.RESEAU_EN_COURS, HS.MURS_EN_COURS, HS.INELIGIBLE],
        [HS.RECEPTION_VALIDEE]: [],
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
            return [HS.NON_DEBUTE];
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
