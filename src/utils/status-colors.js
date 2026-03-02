/**
 * Mapping des couleurs Tailwind pour chaque statut RÉEL
 */

// Protection contre double chargement
if (typeof window.StatusColors === 'undefined') {

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
     * Classes Tailwind pour chaque statut
     * Couleurs choisies pour différencier visuellement
     */
    const StatusColors = {
        [HS.NON_DEBUTE]: 'bg-gray-200 text-gray-800',
        [HS.MURS_EN_COURS]: 'bg-orange-200 text-orange-900',
        [HS.MURS_TERMINE]: 'bg-orange-300 text-orange-900',
        [HS.RESEAU_EN_COURS]: 'bg-blue-200 text-blue-800',
        [HS.RESEAU_TERMINE]: 'bg-blue-300 text-blue-900',
        [HS.INTERIEUR_EN_COURS]: 'bg-purple-200 text-purple-800',
        [HS.INTERIEUR_TERMINE]: 'bg-purple-300 text-purple-900',
        [HS.RECEPTION_VALIDEE]: 'bg-green-200 text-green-800',
        [HS.PROBLEME]: 'bg-red-200 text-red-800',
        [HS.INELIGIBLE]: 'bg-red-100 text-red-700'
    };

    /**
     * Couleurs pour les marqueurs de carte (version map)
     */
    const StatusMapColors = {
        [HS.NON_DEBUTE]: '#6b7280',
        [HS.MURS_EN_COURS]: '#f97316',
        [HS.MURS_TERMINE]: '#fb923c',
        [HS.RESEAU_EN_COURS]: '#3b82f6',
        [HS.RESEAU_TERMINE]: '#1d4ed8',
        [HS.INTERIEUR_EN_COURS]: '#a855f7',
        [HS.INTERIEUR_TERMINE]: '#7c3aed',
        [HS.RECEPTION_VALIDEE]: '#22c55e',
        [HS.PROBLEME]: '#ef4444',
        [HS.INELIGIBLE]: '#f87171'
    };

    /**
     * Icônes Font Awesome par statut
     */
    const StatusIcons = {
        [HS.NON_DEBUTE]: 'fa-flag',
        [HS.MURS_EN_COURS]: 'fa-hammer',
        [HS.MURS_TERMINE]: 'fa-hammer',
        [HS.RESEAU_EN_COURS]: 'fa-plug',
        [HS.RESEAU_TERMINE]: 'fa-plug',
        [HS.INTERIEUR_EN_COURS]: 'fa-bolt',
        [HS.INTERIEUR_TERMINE]: 'fa-bolt',
        [HS.RECEPTION_VALIDEE]: 'fa-check-circle',
        [HS.PROBLEME]: 'fa-ban',
        [HS.INELIGIBLE]: 'fa-times-circle'
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
