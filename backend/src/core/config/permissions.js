/**
 * Configuration des Rôles et Permissions - PROQUELEC SaaS
 * Centralisation de la logique d'accès pour une maintenance facilitée.
 */

export const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    DG: "DG_PROQUELEC",
    CHEF_EQUIPE: "CHEF_EQUIPE",
    CLIENT_LSE: "CLIENT_LSE"
};

export const PERMISSIONS = {
    // Gestion des Utilisateurs & Système
    GERER_UTILISATEURS: "gerer_utilisateurs",
    GERER_PARAMETRES: "gerer_parametres",
    VOIR_DIAGNOSTIC: "voir_diagnostic",

    // Finances & Stratégie
    VOIR_FINANCES: "voir_finances",
    GERER_FINANCES: "gerer_finances",
    VOIR_SIMULATION: "voir_simulation",
    LANCER_SIMULATION: "lancer_simulation",

    // Gestion de Projet & Terrain
    VOIR_CARTE: "voir_carte",
    MODIFIER_CARTE: "modifier_carte",
    CREER_PROJET: "creer_projet",
    SUPPRIMER_PROJET: "supprimer_projet",
    GERER_LOGISTIQUE: "gerer_logistique",
    VOIR_RAPPORTS: "voir_rapports",
    ACCES_TERMINAL_KOBO: "acces_terminal_kobo"
};

export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: [
        PERMISSIONS.GERER_UTILISATEURS,
        PERMISSIONS.GERER_PARAMETRES,
        PERMISSIONS.VOIR_DIAGNOSTIC,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.LANCER_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.MODIFIER_CARTE,
        PERMISSIONS.CREER_PROJET,
        PERMISSIONS.SUPPRIMER_PROJET,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO
    ],

    [ROLES.DG]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_PARAMETRES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO
    ],

    [ROLES.CHEF_EQUIPE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.MODIFIER_CARTE, // Limité par ABAC au niveau des données
        PERMISSIONS.VOIR_RAPPORTS
    ],

    [ROLES.CLIENT_LSE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS
    ]
};
