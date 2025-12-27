/**
 * Enum des statuts RÉELS de ménages
 * Basé sur le workflow d'électrification terrain
 */

// Protection contre double chargement
if (typeof window.HouseholdStatus === 'undefined') {

    const HouseholdStatus = Object.freeze({
        INELIGIBLE: 'Inéligible',
        INJOIGNABLE: 'Injoignable',
        ATTENTE_DEMARRAGE: 'Attente démarrage',
        ATTENTE_MACON: 'Attente Maçon',
        ATTENTE_BRANCHEMENT: 'Attente Branchement',
        ATTENTE_ELECTRICIEN: 'Attente électricien',
        ATTENTE_CONTROLEUR: 'Attente Controleur',
        ATTENTE_ELECTRICIEN_X: 'Attente électricien(X)',
        CONFORME: 'Conforme'
    });

    /**
     * Labels (identiques aux valeurs dans ce cas)
     */
    const StatusLabels = {
        [HouseholdStatus.INELIGIBLE]: 'Inéligible',
        [HouseholdStatus.INJOIGNABLE]: 'Injoignable',
        [HouseholdStatus.ATTENTE_DEMARRAGE]: 'Attente démarrage',
        [HouseholdStatus.ATTENTE_MACON]: 'Attente Maçon',
        [HouseholdStatus.ATTENTE_BRANCHEMENT]: 'Attente Branchement',
        [HouseholdStatus.ATTENTE_ELECTRICIEN]: 'Attente électricien',
        [HouseholdStatus.ATTENTE_CONTROLEUR]: 'Attente Controleur',
        [HouseholdStatus.ATTENTE_ELECTRICIEN_X]: 'Attente électricien(X)',
        [HouseholdStatus.CONFORME]: 'Conforme'
    };

    /**
     * Descriptions détaillées
     */
    const StatusDescriptions = {
        [HouseholdStatus.INELIGIBLE]: 'Ménage non éligible au programme d\'électrification',
        [HouseholdStatus.INJOIGNABLE]: 'Impossible de joindre le ménage',
        [HouseholdStatus.ATTENTE_DEMARRAGE]: 'En attente du démarrage des travaux',
        [HouseholdStatus.ATTENTE_MACON]: 'En attente de l\'intervention des maçons',
        [HouseholdStatus.ATTENTE_BRANCHEMENT]: 'En attente du branchement au réseau',
        [HouseholdStatus.ATTENTE_ELECTRICIEN]: 'En attente de l\'électricien pour installation',
        [HouseholdStatus.ATTENTE_CONTROLEUR]: 'En attente du contrôle qualité',
        [HouseholdStatus.ATTENTE_ELECTRICIEN_X]: 'En attente de correction par électricien',
        [HouseholdStatus.CONFORME]: 'Installation terminée et conforme'
    };

    // Export pour utilisation dans le code
    if (typeof window !== 'undefined') {
        window.HouseholdStatus = HouseholdStatus;
        window.StatusLabels = StatusLabels;
        window.StatusDescriptions = StatusDescriptions;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { HouseholdStatus, StatusLabels, StatusDescriptions };
    }

} // Fin protection double chargement
