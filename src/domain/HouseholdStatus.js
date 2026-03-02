/**
 * Enum des statuts RÉELS de ménages
 * Basé sur le workflow d'électrification terrain
 */

// Protection contre double chargement
if (typeof window.HouseholdStatus === 'undefined') {

    const HouseholdStatus = Object.freeze({
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
    });

    /**
     * Labels (identiques aux valeurs dans ce cas)
     */
    const StatusLabels = {
        [HouseholdStatus.NON_DEBUTE]: 'Non débuté',
        [HouseholdStatus.MURS_EN_COURS]: 'Murs: En cours',
        [HouseholdStatus.MURS_TERMINE]: 'Murs: Terminé',
        [HouseholdStatus.RESEAU_EN_COURS]: 'Réseau: En cours',
        [HouseholdStatus.RESEAU_TERMINE]: 'Réseau: Terminé',
        [HouseholdStatus.INTERIEUR_EN_COURS]: 'Intérieur: En cours',
        [HouseholdStatus.INTERIEUR_TERMINE]: 'Intérieur: Terminé',
        [HouseholdStatus.RECEPTION_VALIDEE]: 'Réception: Validée',
        [HouseholdStatus.PROBLEME]: 'Problème',
        [HouseholdStatus.INELIGIBLE]: 'Inéligible'
    };

    /**
     * Descriptions détaillées
     */
    const StatusDescriptions = {
        [HouseholdStatus.NON_DEBUTE]: 'Ménage prêt, aucun chantier démarré',
        [HouseholdStatus.MURS_EN_COURS]: 'Travaux maçonnerie en cours',
        [HouseholdStatus.MURS_TERMINE]: 'Travaux maçonnerie terminés',
        [HouseholdStatus.RESEAU_EN_COURS]: 'Branchement réseau en cours',
        [HouseholdStatus.RESEAU_TERMINE]: 'Branchement réseau terminé',
        [HouseholdStatus.INTERIEUR_EN_COURS]: 'Installation intérieure en cours',
        [HouseholdStatus.INTERIEUR_TERMINE]: 'Installation intérieure terminée, prêt pour contrôle',
        [HouseholdStatus.RECEPTION_VALIDEE]: 'Réception finale validée',
        [HouseholdStatus.PROBLEME]: 'Blocage/incident nécessitant reprise',
        [HouseholdStatus.INELIGIBLE]: 'Ménage non éligible au programme'
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
