/**
 * Énumérations et constantes métier
 */

(function (global) {
    // Prevent duplicate declaration if already loaded
    if (global.TeamType) return;

    // Types d'équipes
    const TeamType = Object.freeze({
        PREPARATEURS: 'preparateurs',
        LIVRAISON: 'livraison',
        MACONS: 'macons',
        RESEAU: 'reseau',
        INTERIEUR_TYPE1: 'interieur_type1',
        INTERIEUR_TYPE2: 'interieur_type2',
        CONTROLE: 'controle'
    });

    // Statuts de ménage
    const HouseholdStatus = Object.freeze({
        PENDING: 'En attente',
        IN_PROGRESS: 'En cours',
        COMPLETED: 'Terminé',
        BLOCKED: 'Problème'
    });

    // Statuts de projet
    const ProjectStatus = Object.freeze({
        PLANNING: 'Planification',
        IN_PROGRESS: 'En cours',
        COMPLETED: 'Terminé',
        PAUSED: 'En pause',
        CANCELLED: 'Annulé'
    });

    // Modes de paiement
    const PaymentMode = Object.freeze({
        DAILY: 'daily',
        PER_TASK: 'per-task',
        SUBCONTRACT: 'subcontract'
    });

    // Modes d'acquisition de véhicules
    const AcquisitionMode = Object.freeze({
        PURCHASE: 'acheter',
        RENT: 'louer'
    });

    // Types d'activités terrain
    const ActivityType = Object.freeze({
        PREPARATION: 'preparation',
        DELIVERY: 'livraison',
        MASONRY: 'maconnerie',
        NETWORK: 'reseau',
        INTERIOR: 'interieur',
        CONTROL: 'controle'
    });

    // Niveaux de log
    const LogLevel = Object.freeze({
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
        FATAL: 'fatal'
    });

    // Transitions de statut valides pour les ménages
    const VALID_STATUS_TRANSITIONS = Object.freeze({
        [HouseholdStatus.PENDING]: [HouseholdStatus.IN_PROGRESS],
        [HouseholdStatus.IN_PROGRESS]: [HouseholdStatus.COMPLETED, HouseholdStatus.BLOCKED],
        [HouseholdStatus.BLOCKED]: [HouseholdStatus.IN_PROGRESS],
        [HouseholdStatus.COMPLETED]: []
    });

    // Constantes de productivité par défaut
    const DEFAULT_PRODUCTIVITY = Object.freeze({
        [TeamType.PREPARATEURS]: 8,
        [TeamType.LIVRAISON]: 10,
        [TeamType.MACONS]: 3,
        [TeamType.RESEAU]: 4,
        [TeamType.INTERIEUR_TYPE1]: 5,
        [TeamType.INTERIEUR_TYPE2]: 3,
        [TeamType.CONTROLE]: 8
    });

    // Constantes de coûts par défaut (FCFA)
    const DEFAULT_COSTS = Object.freeze({
        DAILY_RATES: {
            preparateur: 5000,
            livreur: 6000,
            macon: 8000,
            reseau: 10000,
            interieur_type1: 9000,
            interieur_type2: 11000,
            controleur: 7000,
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
    const CALCULATION_RATIOS = Object.freeze({
        SUPERVISOR_PER_TEAMS: 10,
        DRIVER_PER_TRUCK: 1,
        DELIVERY_AGENT_PER_HOUSES: 500,
        INTERIOR_TYPE1_SHARE: 0.7
    });

    // Export pour utilisation globale
    global.TeamType = TeamType;
    global.HouseholdStatus = HouseholdStatus;
    global.ProjectStatus = ProjectStatus;
    global.PaymentMode = PaymentMode;
    global.AcquisitionMode = AcquisitionMode;
    global.ActivityType = ActivityType;
    global.LogLevel = LogLevel;
    global.VALID_STATUS_TRANSITIONS = VALID_STATUS_TRANSITIONS;
    global.DEFAULT_PRODUCTIVITY = DEFAULT_PRODUCTIVITY;
    global.DEFAULT_COSTS = DEFAULT_COSTS;
    global.CALCULATION_RATIOS = CALCULATION_RATIOS;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            TeamType,
            HouseholdStatus,
            ProjectStatus,
            PaymentMode,
            AcquisitionMode,
            ActivityType,
            LogLevel,
            VALID_STATUS_TRANSITIONS,
            DEFAULT_PRODUCTIVITY,
            DEFAULT_COSTS,
            CALCULATION_RATIOS
        };
    }

})(typeof window !== 'undefined' ? window : this);
