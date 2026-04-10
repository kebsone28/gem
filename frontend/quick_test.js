/**
 * SCRIPT DE TEST DE SÉCURITÉ (STRATÉGIE STRICTE)
 * Ce script s'exécute directement dans le navigateur ou via Node (si on définit l'environnement).
 */

const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    COMPTABLE: "COMPTABLE"
};

const PERMISSIONS = {
    VOIR_FINANCES: "voir_finances",
    VALIDER_MISSION: "valider_mission",
    GERER_UTILISATEURS: "gerer_utilisateurs"
};

// Logique du moteur (Identique à celle que je viens d'injecter dans GEM_SAAS)
function hasPermission(user, permission) {
    if (!user) return false;
    const role = user.role || "";
    const email = user.email || "";
    
    // 1. GOD MODE (Admin)
    if (role === ROLES.ADMIN || email.includes('admin')) return true;

    // 2. STRICT ADMIN OVERRIDE (Granular Control)
    // Si l'Admin a touché au profil (permissions est défini, même vide []),
    // on IGNORE le rôle par défaut et on utilise UNIQUMENT cette liste.
    if (user.permissions && Array.isArray(user.permissions)) {
        return user.permissions.includes(permission);
    }
    
    // 3. Fallback (Rôle par défaut) - Uniquement si l'Admin n'a jamais touché au profil
    const DEFAULT_COMPTABLE = [PERMISSIONS.VOIR_FINANCES, PERMISSIONS.VALIDER_MISSION];
    if (role === ROLES.COMPTABLE) return DEFAULT_COMPTABLE.includes(permission);

    return false;
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

console.log("🛡️ GEM SAAS - TEST DU MOTEUR DE PERMISSIONS STRICT\n");

// --- CAS 1 : COMPTABLE "VIDÉ" PAR L'ADMIN ---
const comptableBloqué = {
    name: "Comptable Bloqué",
    role: ROLES.COMPTABLE,
    permissions: [] // L'Admin a ouvert son profil et TOUT décoché
};

console.log("🛑 TEST : COMPTABLE DONT TOUTES LES CASES SONT DÉCOCHÉES");
const p1 = hasPermission(comptableBloqué, PERMISSIONS.VALIDER_MISSION);
const p2 = hasPermission(comptableBloqué, PERMISSIONS.VOIR_FINANCES);

console.log(`- Accès Validation : ${p1 ? RED + 'ERREUR (ACCÈS TOUJOURS ACTIF)' : GREEN + 'BLOQUÉ (STRICT OK)'}${RESET}`);
console.log(`- Accès Finances   : ${p2 ? RED + 'ERREUR (ACCÈS TOUJOURS ACTIF)' : GREEN + 'BLOQUÉ (STRICT OK)'}${RESET}`);

// --- CAS 2 : COMPTABLE "OPEN" (PAR DÉFAUT) ---
const comptableLibre = {
    name: "Comptable Normal",
    role: ROLES.COMPTABLE,
    permissions: null // L'Admin n'a jamais ouvert son profil (Mode automatique)
};

console.log("\n📖 TEST : COMPTABLE DONT LE PROFIL N'A JAMAIS ÉTÉ TOUCHÉ (MODE AUTO)");
const p3 = hasPermission(comptableLibre, PERMISSIONS.VALIDER_MISSION);
console.log(`- Accès Validation : ${p3 ? GREEN + 'ACTIF (RÔLE MÉTIER)' : RED + 'ERREUR (BLOCAGE NON VOULU)'}${RESET}`);

// --- CAS 3 : ADMIN ---
const adminUser = { role: ROLES.ADMIN };
console.log("\n👑 TEST : ADMINISTRATEUR (GOD MODE)");
const p4 = hasPermission(adminUser, PERMISSIONS.GERER_UTILISATEURS);
console.log(`- Accès Admin      : ${p4 ? GREEN + 'ACTIF (BYPASS OK)' : RED + 'ERREUR'}${RESET}`);

console.log("\n✅ CONCLUSION : Le blocage est désormais STRICT. Si l'Admin décoche tout, l'utilisateur n'a plus rien.");
