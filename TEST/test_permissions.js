import { hasPermission, ROLES, PERMISSIONS } from './src/utils/permissions';

/**
 * SCRIPT DE TEST RAPIDE : MOTEUR DE PERMISSIONS (RBAC & ABAC STRICT)
 * Objectif : Valider que retirer les accès à un Comptable le bloque réellement.
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

console.log("🚀 Lancement du Test de Sécurité (Moteur de Permissions)\n");

// --- CAS 1 : COMPTABLE PAR DÉFAUT (N'A PAS ÉTÉ TOUCHÉ PAR L'ADMIN) ---
const comptableDefault = {
    name: "Comptable Normal",
    role: ROLES.COMPTABLE,
    permissions: null // L'Admin n'a jamais ouvert son profil
};

console.log("📋 CAS 1 : Comptable par défaut (Libre)");
const p1 = hasPermission(comptableDefault, PERMISSIONS.VALIDER_MISSION);
console.log(`- Peut valider mission ? ${p1 ? GREEN + 'OUI (OK - Rôle par défaut)' : RED + 'NON'} ${RESET}`);

// --- CAS 2 : COMPTABLE "VIDÉ" (STRICT ADMIN OVERRIDE) ---
const comptableVidé = {
    name: "Comptable Bloqué",
    role: ROLES.COMPTABLE,
    permissions: [] // L'Admin a tout décoché (Liste vide)
};

console.log("\n🛑 CAS 2 : Comptable dont l'Admin a vidé les droits (Strict)");
const p2 = hasPermission(comptableVidé, PERMISSIONS.VALIDER_MISSION);
const p3 = hasPermission(comptableVidé, PERMISSIONS.VOIR_FINANCES);
console.log(`- Peut valider mission ? ${p2 ? RED + 'OUI (ERREUR)' : GREEN + 'NON (OK - Bloqué par Admin)'} ${RESET}`);
console.log(`- Peut voir finances ?  ${p3 ? RED + 'OUI (ERREUR)' : GREEN + 'NON (OK - Bloqué par Admin)'} ${RESET}`);

// --- CAS 3 : ADMIN (GOD MODE) ---
const adminUser = {
    name: "Super Administrateur",
    role: ROLES.ADMIN,
    permissions: [] // Même si la liste est vide, il est Admin
};

console.log("\n👑 CAS 3 : Administrateur (God Mode)");
const p4 = hasPermission(adminUser, PERMISSIONS.GERER_UTILISATEURS);
console.log(`- Peut gérer utilisateurs ? ${p4 ? GREEN + 'OUI (OK - Admin Bypass)' : RED + 'NON'} ${RESET}`);

// --- CAS 4 : COMPTABLE "SUPER-POUVOIR" ---
const comptableSuper = {
    name: "Comptable VIP",
    role: ROLES.COMPTABLE,
    permissions: [PERMISSIONS.VOIR_CARTE, PERMISSIONS.VOIR_FINANCES] // Accès Terrain ajouté
};

console.log("\n🧤 CAS 4 : Comptable avec permission 'Terrain' ajoutée");
const p5 = hasPermission(comptableSuper, PERMISSIONS.VOIR_CARTE);
const p6 = hasPermission(comptableSuper, PERMISSIONS.VALIDER_MISSION);
console.log(`- Peut voir la carte ? ${p5 ? GREEN + 'OUI (OK - Permission ajoutée)' : RED + 'NON'} ${RESET}`);
console.log(`- Peut valider mission ? ${p6 ? RED + 'OUI (OK - Bloqué car non listé dans VIP)' : GREEN + 'NON (STRICT OK)'} ${RESET}`);

console.log("\n🏁 Fin des tests de sécurité.");
