/**
 * Matrice de Permissions - Production Ready (SaaS Advanced)
 * Alignée avec workflow réel PROQUELEC : DG seul valideur par défaut
 */

export const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    DG: "DG_PROQUELEC",
    CHEF_EQUIPE: "CHEF_EQUIPE",
    CLIENT_LSE: "CLIENT_LSE",
    CHEF_PROJET: "CHEF_PROJET",
    COMPTABLE: "COMPTABLE",
    DIRECTEUR: "DIRECTEUR"
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

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

    // 🔥 IMPORTANT : réservé DG uniquement par défaut
    VALIDER_MISSION: "valider_mission"
} as const;

export type AppPermission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Centralized evaluation tools for performance
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as string[];
const ALL_ROLES = Object.values(ROLES) as string[];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),

    [ROLES.DG]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.VALIDER_MISSION // ✅ SEUL DG
    ],

    [ROLES.DIRECTEUR]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.GERER_LOGISTIQUE
    ],

    [ROLES.CHEF_PROJET]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.MODIFIER_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION
    ],

    [ROLES.COMPTABLE]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_FINANCES,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION
    ],

    [ROLES.CHEF_EQUIPE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS
    ],

    [ROLES.CLIENT_LSE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS
    ]
};

/**
 * Normalisation robuste du rôle (évite les bugs de casse backend/frontend)
 */
const normalizeRole = (role: string): UserRole | null => {
    const upper = (role || "").toUpperCase();
    return ALL_ROLES.includes(upper) ? (upper as UserRole) : null;
};

/**
 * Type Guard pour la sécurité des permissions demandées
 */
const isValidPermission = (perm: string): boolean => {
    return ALL_PERMISSIONS.includes(perm);
};

export type AppUser = {
    role?: string;
    permissions?: string[];
    deniedPermissions?: string[];
};

export const hasPermission = (user: (AppUser & { email?: string }) | null | undefined, permission: string): boolean => {
    if (!user) return false;

    const email = (user.email || "").toLowerCase().trim();
    const rawRole = (user.role || "").trim().toUpperCase();
    
    // 🔥 1. ABSOLUTE MASTER BYPASS (JOKER ADMIN)
    // Toujours accès à tout pour ne jamais être bloqué
    if (email === 'admingem' || rawRole === ROLES.ADMIN || rawRole === "ADMIN" || rawRole.includes('ADMIN')) {
        return true; 
    }

    // 🔒 Sécurité : protection contre les injections de chaînes invalides
    if (!permission || !isValidPermission(permission)) return false;

    // 🔥 2. CUSTOM ALLOW (Souveraineté des cases cochées manuellement par l'admin)
    // Si l'admin a défini une liste de permissions (même vide []), on ignore le rôle métier.
    // L'utilisateur n'a accès QU'À ce qui est coché.
    const hasCustomPermissions = user.permissions !== null && user.permissions !== undefined;
    if (hasCustomPermissions) {
        return user.permissions?.includes(permission) ?? false;
    }

    // 🔥 3. FALLBACK ROLE (Seulement pour les comptes qui n'ont jamais été modifiés manuellement)
    const normalizedRole = normalizeRole(rawRole);
    if (!normalizedRole) return false;

    return ROLE_PERMISSIONS[normalizedRole]?.includes(permission) ?? false;
};

export const PERMISSION_LABELS: Record<string, string> = {
    [PERMISSIONS.GERER_UTILISATEURS]: "👥 Gestion des utilisateurs",
    [PERMISSIONS.GERER_PARAMETRES]: "⚙️ Paramètres entreprise",
    [PERMISSIONS.VOIR_DIAGNOSTIC]: "🩺 Diagnostic système",
    [PERMISSIONS.VOIR_FINANCES]: "📈 Consultation finances",
    [PERMISSIONS.GERER_FINANCES]: "💸 Gestion des finances",
    [PERMISSIONS.VOIR_SIMULATION]: "🧪 Consultation devis",
    [PERMISSIONS.LANCER_SIMULATION]: "🚀 Lancer simulations",
    [PERMISSIONS.VOIR_CARTE]: "🗺️ Carte terrain",
    [PERMISSIONS.MODIFIER_CARTE]: "📍 Modifier carte",
    [PERMISSIONS.CREER_PROJET]: "🏗️ Créer projet",
    [PERMISSIONS.SUPPRIMER_PROJET]: "🗑️ Supprimer projet",
    [PERMISSIONS.GERER_LOGISTIQUE]: "📦 Logistique",
    [PERMISSIONS.VOIR_RAPPORTS]: "📊 Rapports",
    [PERMISSIONS.ACCES_TERMINAL_KOBO]: "📡 Accès Kobo",
    [PERMISSIONS.CREER_MISSION]: "🕒 Créer mission",
    [PERMISSIONS.VALIDER_MISSION]: "✔️ Validation DG (signature officielle)"
};
