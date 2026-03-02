/**
 * Énumérations et constantes métier
 */

// Types d'équipes
export const TeamType = Object.freeze({
    PREPARATEURS: 'preparateurs',
    LIVRAISON: 'livraison',
    MACONS: 'macons',
    RESEAU: 'reseau',
    INTERIEUR_TYPE1: 'interieur_type1',
    INTERIEUR_TYPE2: 'interieur_type2',
    CONTROLE: 'controle',
    SUPERVISEUR: 'superviseur'
});

// Statuts de ménage
export const HouseholdStatus = Object.freeze({
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

// Statuts de projet
export const ProjectStatus = Object.freeze({
    PLANNING: 'Planification',
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Terminé',
    PAUSED: 'En pause',
    CANCELLED: 'Annulé'
});

// Modes de paiement
export const PaymentMode = Object.freeze({
    DAILY: 'daily',
    PER_TASK: 'per-task',
    SUBCONTRACT: 'subcontract'
});

// Modes d'acquisition de véhicules
export const AcquisitionMode = Object.freeze({
    PURCHASE: 'acheter',
    RENT: 'louer'
});

// Types d'activités terrain
export const ActivityType = Object.freeze({
    PREPARATION: 'preparation',
    DELIVERY: 'livraison',
    MASONRY: 'maconnerie',
    NETWORK: 'reseau',
    INTERIOR: 'interieur',
    CONTROL: 'controle'
});

// Niveaux de log
export const LogLevel = Object.freeze({
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
});

// Transitions de statut valides pour les ménages
export const VALID_STATUS_TRANSITIONS = Object.freeze({
    [HouseholdStatus.NON_DEBUTE]: [HouseholdStatus.MURS_EN_COURS, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.MURS_EN_COURS]: [HouseholdStatus.MURS_TERMINE, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.MURS_TERMINE]: [HouseholdStatus.RESEAU_EN_COURS, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.RESEAU_EN_COURS]: [HouseholdStatus.RESEAU_TERMINE, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.RESEAU_TERMINE]: [HouseholdStatus.INTERIEUR_EN_COURS, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.INTERIEUR_EN_COURS]: [HouseholdStatus.INTERIEUR_TERMINE, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.INTERIEUR_TERMINE]: [HouseholdStatus.RECEPTION_VALIDEE, HouseholdStatus.PROBLEME, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.PROBLEME]: [HouseholdStatus.INTERIEUR_EN_COURS, HouseholdStatus.RESEAU_EN_COURS, HouseholdStatus.MURS_EN_COURS, HouseholdStatus.INELIGIBLE],
    [HouseholdStatus.RECEPTION_VALIDEE]: [],
    [HouseholdStatus.INELIGIBLE]: []
});

export const LEGACY_STATUS_MAP = Object.freeze({
    'En attente': HouseholdStatus.NON_DEBUTE,
    'Attente démarrage': HouseholdStatus.NON_DEBUTE,
    'Attente Maçon': HouseholdStatus.MURS_EN_COURS,
    'Attente Branchement': HouseholdStatus.RESEAU_EN_COURS,
    'Attente électricien': HouseholdStatus.INTERIEUR_EN_COURS,
    'Attente Controleur': HouseholdStatus.INTERIEUR_TERMINE,
    'Attente électricien(X)': HouseholdStatus.INTERIEUR_EN_COURS,
    'Conforme': HouseholdStatus.RECEPTION_VALIDEE,
    'Terminé': HouseholdStatus.RECEPTION_VALIDEE,
    'En cours': HouseholdStatus.MURS_EN_COURS,
    'Injoignable': HouseholdStatus.PROBLEME,
    'Problème': HouseholdStatus.PROBLEME,
    'Inéligible': HouseholdStatus.INELIGIBLE
});

function normalizeStatus(status) {
    if (!status) return HouseholdStatus.NON_DEBUTE;
    if (Object.values(HouseholdStatus).includes(status)) return status;
    return LEGACY_STATUS_MAP[status] || HouseholdStatus.NON_DEBUTE;
}

function getStatusCategory(status) {
    const s = normalizeStatus(status);
    if (s === HouseholdStatus.RECEPTION_VALIDEE) return 'done';
    if (s === HouseholdStatus.PROBLEME || s === HouseholdStatus.INELIGIBLE) return 'blocked';
    if (s === HouseholdStatus.NON_DEBUTE) return 'todo';
    return 'in_progress';
}

// Constantes de productivité par défaut
export const DEFAULT_PRODUCTIVITY = Object.freeze({
    [TeamType.PREPARATEURS]: 8,
    [TeamType.LIVRAISON]: 10,
    [TeamType.MACONS]: 3,
    [TeamType.RESEAU]: 4,
    [TeamType.INTERIEUR_TYPE1]: 5,
    [TeamType.INTERIEUR_TYPE2]: 3,
    [TeamType.CONTROLE]: 8,
    [TeamType.SUPERVISEUR]: 15
});

// Constantes de coûts par défaut (FCFA)
export const DEFAULT_COSTS = Object.freeze({
    DAILY_RATES: {
        preparateurs: 5000,
        livraison: 6000,
        macons: 8000,
        reseau: 10000,
        interieur_type1: 9000,
        interieur_type2: 11000,
        controle: 7000,
        superviseur: 15000,
        chauffeur: 6000,
        agent_livraison: 5500,
        chef_projet: 50000
    },
    TASK_RATES: {
        preparateur: 600,
        livreur: 800,
        macon: 2500,
        reseau: 2000,
        interieur_type1: 1500,
        interieur_type2: 2200,
        controleur: 800
    },
    VEHICLES: {
        pm_purchase: 40000000,
        pm_rent_per_day: 20000,
        controller_purchase: 30000000,
        controller_rent_per_day: 15000,
        network_purchase: 35000000,
        network_rent_per_day: 18000,
        delivery_purchase: 25000000,
        delivery_rent_per_day: 30000
    },
    FUEL_PER_LITER: 650,
    // Constants from legacy resource_calculator.js
    SUBCONTRACTING_MASONRY: {
        model1_standard: {
            name: 'Mur 1,6m avec poteaux + potelet dessus',
            pricePerHouse: 45000
        },
        model2_chimney: {
            name: 'Mur cheminée 1,6m avec potelet dessous',
            pricePerHouse: 48000
        }
    },
    POTELET_COST: { galva4m: 8500 },
    SECONDARY_PANEL_COST: { standard: 12000 }
});

// Ratios de calcul
export const CALCULATION_RATIOS = Object.freeze({
    SUPERVISOR_PER_TEAMS: 10,
    DRIVER_PER_TRUCK: 1,
    DELIVERY_AGENT_PER_HOUSES: 500,
    INTERIOR_TYPE1_SHARE: 0.7
});

export const KPI_STATUS = Object.freeze({
    CRITICAL: 'critical',
    WARNING: 'warning',
    GOOD: 'good',
    UNKNOWN: 'unknown'
});

// Pour compatibilité avec les pages non migrées (temporaire)
if (typeof window !== 'undefined') {
    window.TeamType = TeamType;
    window.HouseholdStatus = HouseholdStatus;
    window.ProjectStatus = ProjectStatus;
    window.PaymentMode = PaymentMode;
    window.AcquisitionMode = AcquisitionMode;
    window.ActivityType = ActivityType;
    window.LogLevel = LogLevel;
    window.VALID_STATUS_TRANSITIONS = VALID_STATUS_TRANSITIONS;
    window.LEGACY_STATUS_MAP = LEGACY_STATUS_MAP;
    window.KPI_STATUS = KPI_STATUS;
    window.CALCULATION_RATIOS = CALCULATION_RATIOS;
}
