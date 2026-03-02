/**
 * TeamRegistry - Source unique de vérité pour les types d'équipes et métiers.
 */
(function () {
    'use strict';

    const TEAM_TYPES = {
        mason: {
            id: 'mason',
            label: 'Maçonnerie',
            shortLabel: 'Maçon',
            icon: 'fas fa-hammer',
            color: '#7c3aed', // Violet
            weight: 0.25
        },
        network: {
            id: 'network',
            label: 'Réseau / Branchement',
            shortLabel: 'Réseau',
            icon: 'fas fa-plug',
            color: '#2563eb', // Blue
            weight: 0.25
        },
        interior: {
            id: 'interior',
            label: 'Installation Intérieure',
            shortLabel: 'Intérieur',
            icon: 'fas fa-home',
            color: '#db2777', // Pink
            weight: 0.25
        },
        control: {
            id: 'control',
            label: 'Contrôle & Conformité',
            shortLabel: 'Contrôle',
            icon: 'fas fa-clipboard-check',
            color: '#059669', // Emerald
            weight: 0.25
        }
    };

    const LEGACY_MAP = {
        'macons': 'mason', 'macon': 'mason', 'mason': 'mason',
        'reseau': 'network', 'reveau': 'network', 'network': 'network',
        'interieur': 'interior', 'interior': 'interior', 'installateur': 'interior',
        'controle': 'control', 'control': 'control', 'controleur': 'control'
    };

    const TeamRegistry = {
        TYPES: Object.freeze(TEAM_TYPES),

        get(id) {
            const normalizedId = this.normalizeId(id);
            return TEAM_TYPES[normalizedId];
        },

        normalizeId(id) {
            if (!id) return id;
            const cleanId = id.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return LEGACY_MAP[cleanId] || cleanId;
        },

        getIds() {
            return Object.keys(TEAM_TYPES);
        },

        getLabels() {
            return Object.values(TEAM_TYPES).map(t => t.label);
        }
    };

    // Export global
    if (typeof window !== 'undefined') {
        window.TeamRegistry = TeamRegistry;
        // Alias pour compatibilité descendante immédiate si besoin
        window.TEAM_TYPES_REGISTRY = TeamRegistry.TYPES;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TeamRegistry;
    }
})();
