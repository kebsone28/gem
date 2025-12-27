/**
 * Mapping des couleurs Tailwind pour chaque statut RÉEL
 */

// Protection contre double chargement
if (typeof window.StatusColors === 'undefined') {

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
     * Classes Tailwind pour chaque statut
     * Couleurs choisies pour différencier visuellement
     */
    const StatusColors = {
        [HS.INELIGIBLE]: 'bg-red-200 text-red-800',
        [HS.INJOIGNABLE]: 'bg-gray-200 text-gray-800',
        [HS.ATTENTE_DEMARRAGE]: 'bg-yellow-200 text-yellow-800',
        [HS.ATTENTE_MACON]: 'bg-orange-200 text-orange-800',
        [HS.ATTENTE_BRANCHEMENT]: 'bg-amber-200 text-amber-800',
        [HS.ATTENTE_ELECTRICIEN]: 'bg-blue-200 text-blue-800',
        [HS.ATTENTE_CONTROLEUR]: 'bg-purple-200 text-purple-800',
        [HS.ATTENTE_ELECTRICIEN_X]: 'bg-pink-200 text-pink-800',
        [HS.CONFORME]: 'bg-green-200 text-green-800'
    };

    /**
     * Couleurs pour les marqueurs de carte (version map)
     */
    const StatusMapColors = {
        [HS.INELIGIBLE]: '#ef4444',
        [HS.INJOIGNABLE]: '#6b7280',
        [HS.ATTENTE_DEMARRAGE]: '#eab308',
        [HS.ATTENTE_MACON]: '#f97316',
        [HS.ATTENTE_BRANCHEMENT]: '#f59e0b',
        [HS.ATTENTE_ELECTRICIEN]: '#3b82f6',
        [HS.ATTENTE_CONTROLEUR]: '#a855f7',
        [HS.ATTENTE_ELECTRICIEN_X]: '#ec4899',
        [HS.CONFORME]: '#22c55e'
    };

    /**
     * Icônes Font Awesome par statut
     */
    const StatusIcons = {
        [HS.INELIGIBLE]: 'fa-times-circle',
        [HS.INJOIGNABLE]: 'fa-phone-slash',
        [HS.ATTENTE_DEMARRAGE]: 'fa-hourglass-start',
        [HS.ATTENTE_MACON]: 'fa-hammer',
        [HS.ATTENTE_BRANCHEMENT]: 'fa-plug',
        [HS.ATTENTE_ELECTRICIEN]: 'fa-bolt',
        [HS.ATTENTE_CONTROLEUR]: 'fa-clipboard-check',
        [HS.ATTENTE_ELECTRICIEN_X]: 'fa-tools',
        [HS.CONFORME]: 'fa-check-circle'
    };

    /**
     * Récupère les classes de couleur pour un statut
     */
    function getStatusColor(status) {
        return StatusColors[status] || 'bg-gray-200 text-gray-800';
    }

    /**
     * Récupère la couleur de marqueur carte
     */
    function getStatusMapColor(status) {
        return StatusMapColors[status] || '#6b7280';
    }

    /**
     * Récupère l'icône
     */
    function getStatusIcon(status) {
        return StatusIcons[status] || 'fa-question-circle';
    }

    /**
     * Génère le HTML d'un badge de statut
     */
    function createStatusBadge(status, includeIcon = false) {
        const label = status;
        const colorClasses = getStatusColor(status);
        const icon = includeIcon ? `<i class="fas ${getStatusIcon(status)} mr-1"></i>` : '';

        return `<span class="status-badge px-2 py-1 rounded-full text-xs font-medium ${colorClasses}">
        ${icon}${label}
    </span>`;
    }

    // Export
    if (typeof window !== 'undefined') {
        window.StatusColors = StatusColors;
        window.StatusMapColors = StatusMapColors;
        window.getStatusColor = getStatusColor;
        window.getStatusMapColor = getStatusMapColor;
        window.getStatusIcon = getStatusIcon;
        window.createStatusBadge = createStatusBadge;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            StatusColors,
            StatusMapColors,
            getStatusColor,
            getStatusMapColor,
            getStatusIcon,
            createStatusBadge
        };
    }

} // Fin protection double chargement
