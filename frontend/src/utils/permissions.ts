/**
 * Matrice de Permissions - Frontend Mirror
 * Utilisé pour la logique d'affichage (UI)
 */

export const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    DG: "DG_PROQUELEC",
    CHEF_EQUIPE: "CHEF_EQUIPE",
    CLIENT_LSE: "CLIENT_LSE"
};

export const PERMISSIONS = {
    GERER_UTILISATEURS: "gerer_utilisateurs",
    GERER_PARAMETRES: "gerer_parametres",
    VOIR_DIAGNOSTIC: "voir_diagnostic",
    VOIR_FINANCES: "voir_finances",
    GERER_FINANCES: "gerer_finances",
    VOIR_SIMULATION: "voir_simulation",
    LANCER_SIMULATION: "lancer_simulation",
    VOIR_CARTE: "voir_carte",
    MODIFIER_CARTE: "modifier_carte",
    CREER_PROJET: "creer_projet",
    SUPPRIMER_PROJET: "supprimer_projet",
    GERER_LOGISTIQUE: "gerer_logistique",
    VOIR_RAPPORTS: "voir_rapports",
    ACCES_TERMINAL_KOBO: "acces_terminal_kobo"
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),

    [ROLES.DG]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO
    ],

    [ROLES.CHEF_EQUIPE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.MODIFIER_CARTE,
        PERMISSIONS.VOIR_RAPPORTS
    ],

    [ROLES.CLIENT_LSE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS
    ]
};
