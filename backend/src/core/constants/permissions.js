/**
 * Matrice de Permissions - Backend
 */

export const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    DG: "DG_PROQUELEC",
    CHEF_EQUIPE: "CHEF_EQUIPE",
    CLIENT_LSE: "CLIENT_LSE",
    CHEF_PROJET: "CHEF_PROJET",
    COMPTABLE: "COMPTABLE",
    DIRECTEUR: "DIRECTEUR"
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
    ACCES_TERMINAL_KOBO: "acces_terminal_kobo",
    CREER_MISSION: "creer_mission",
    VALIDER_MISSION: "valider_mission"
};

export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),

    [ROLES.DG]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.VALIDER_MISSION
    ],

    [ROLES.DIRECTEUR]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO
    ],

    [ROLES.CHEF_PROJET]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.ACCES_TERMINAL_KOBO
    ],

    [ROLES.COMPTABLE]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_FINANCES,
        PERMISSIONS.VOIR_RAPPORTS
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

/**
 * logic shared between frontend/backend
 */
export const checkPermission = (user, permission) => {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;

    // 1. Check custom override permissions
    if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
        return user.permissions.includes(permission);
    }

    // 2. Fall back to role-based default
    const rolesPermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolesPermissions.includes(permission);
};
