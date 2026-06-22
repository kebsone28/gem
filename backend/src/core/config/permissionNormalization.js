/**
 * Normalisation des permissions vers les atomes du frontend
 * (référentiel `PERMISSIONS` dans frontend/src/utils/security/types.ts).
 * Les clés Prisma / legacy (snake_case) et certains jetons « domaine.action »
 * sont convertis une seule fois à l’émission JWT et pour /auth/me.
 */

/** @type {readonly string[]} */
export const ALL_FRONTEND_ATOMS = Object.freeze([
  'missions.read',
  'missions.create',
  'missions.update',
  'missions.delete',
  'missions.validate',
  'missions.approve',
  'missions.planning',
  'terrain.read',
  'terrain.write',
  'terrain.terminal',
  'terrain.reject',
  'terrain.zones',
  'terrain.menages',
  'terrain.map',
  'cahier.technical',
  'cahier.contracts',
  'cahier.strategy',
  'finance.read',
  'finance.manage',
  'finance.payments',
  'finance.export',
  'finance.reports',
  'logistique.stock',
  'logistique.deliveries',
  'logistique.agents',
  'logistique.om',
  'logistique.atelier',
  'logistique.deployment',
  'logistique.read',
  'logistique.manage',
  'dashboard.admin',
  'dashboard.project',
  'dashboard.team',
  'dashboard.client',
  'dashboard.accounting',
  'dashboard.assets',
  'settings.charges',
  'settings.kobo',
  'settings.data',
  'settings.datahub',
  'settings.system',
  'system.users',
  'system.roles',
  'system.audit',
  'system.sync',
  'system.config',
  'system.export',
  'system.messages',
  'ui.map',
  'ui.chat',
  'ui.alerts',
  'ui.training',
  'ui.projects',
  'ui.teams',
  'ui.dashboard',
  'ia.use',
  'ia.metrics',
  'ia.simulation',
  'ia.config',
  'docs.read',
  'docs.confidential',
  'docs.pv',
  'modules.manage',
  'sector.gem',
  'sector.mes',
  // [FIX C-2] Atomes MES granulaires pour le moteur d'autorisation
  'sector.mes.create',
  'sector.mes.update',
  'sector.mes.delete',
  'sector.mes.validate',
  'sector.mes.control',
  'sector.mes.import',
  'sector.mes.export',
]);

const FRONTEND_ATOM_SET = new Set(ALL_FRONTEND_ATOMS);

/**
 * Clés DB (seed_rbac / permissions.js), jetons historiques, routes « atomiques ».
 * Valeurs cibles = atomes frontend.
 */
export const PERMISSION_KEY_TO_ATOM = Object.freeze({
  // ── Seed RBAC (permissions.js) ──
  gerer_utilisateurs: 'system.users',
  gerer_parametres: 'settings.system',
  voir_diagnostic: 'system.audit',
  voir_finances: 'finance.read',
  gerer_finances: 'finance.manage',
  voir_simulation: 'ia.simulation',
  lancer_simulation: 'ia.simulation',
  voir_carte: 'ui.map',
  modifier_carte: 'terrain.write',
  creer_projet: 'ui.projects',
  supprimer_projet: 'modules.manage',
  gerer_logistique: 'logistique.manage',
  voir_rapports: 'finance.reports',
  acces_terminal_kobo: 'terrain.terminal',
  creer_mission: 'missions.create',
  valider_mission: 'missions.validate',
  gerer_pv: 'docs.pv',
  voir_missions: 'missions.read',
  voir_registre_missions: 'missions.read',
  modifier_missions: 'missions.update',
  supprimer_missions: 'missions.delete',
  archiver_missions: 'missions.update',
  validation_operationnelle: 'missions.validate',
  approbation_finale_dg: 'missions.approve',

  // ── Jetons type MODULE_REGISTRY / atomicPermissions (alignés frontend LEGACY_MAPPING) ──
  'mission.view': 'missions.read',
  'project.view': 'ui.projects',
  'household.view': 'terrain.read',
  'report.view': 'missions.read',
  'chat.view': 'ui.chat',
  'project.edit': 'missions.update',
  'audit.view': 'system.audit',
  'formation.view': 'ui.training',
  'kobo.manage': 'settings.kobo',

  // ── Route project.routes (chaîne littérale) ──
  'project.module.manage': 'modules.manage',

  // ── Routes projectTemplate (authorize) ──
  'project.template.create': 'modules.manage',
  'project.template.update': 'modules.manage',
  'project.template.delete': 'modules.manage',
  'project.template.manage': 'modules.manage',

  // ── Routes MES (mes.routes.js) — [FIX C-2] ──
  'mes.create': 'sector.mes.create',
  'mes.update': 'sector.mes.update',
  'mes.delete': 'sector.mes.delete',
  'mes.validate': 'sector.mes.validate',
  'mes.control': 'sector.mes.control',
  'mes.import': 'sector.mes.import',
  'mes.export': 'sector.mes.export',
});

/**
 * @param {string[]|null|undefined} raw
 * @returns {string[]}
 */
export function normalizePermissionsToAtoms(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.includes('*')) return [...ALL_FRONTEND_ATOMS];
  const out = new Set();
  for (const p of raw) {
    if (typeof p !== 'string' || !p) continue;
    if (p === '*') {
      ALL_FRONTEND_ATOMS.forEach((a) => out.add(a));
      continue;
    }
    const mapped = PERMISSION_KEY_TO_ATOM[p];
    if (mapped) {
      out.add(mapped);
      continue;
    }
    if (FRONTEND_ATOM_SET.has(p)) out.add(p);
  }
  return [...out].sort();
}

/**
 * @param {string} key
 * @returns {Set<string>}
 */
export function atomsGrantedByPermissionKey(key) {
  const s = new Set();
  if (!key || typeof key !== 'string') return s;
  if (key === '*') {
    ALL_FRONTEND_ATOMS.forEach((a) => s.add(a));
    return s;
  }
  const mapped = PERMISSION_KEY_TO_ATOM[key];
  if (mapped) {
    s.add(mapped);
    return s;
  }
  if (FRONTEND_ATOM_SET.has(key)) s.add(key);
  return s;
}

/**
 * @param {string[]|null|undefined} permissionKeys
 * @returns {Set<string>}
 */
export function effectiveAtomSetFromKeys(permissionKeys) {
  const out = new Set();
  for (const k of permissionKeys || []) {
    atomsGrantedByPermissionKey(k).forEach((a) => out.add(a));
  }
  return out;
}

/**
 * Vérifie une permission route (clé legacy, atome, ou alias) contre le JWT et le rôle.
 * @param {string[]|null|undefined} userPermissionsFromJwt
 * @param {string} roleName
 * @param {string} requiredKey
 * @param {Record<string, string[]>} rolePermissionMap
 */
export function routePermissionSatisfied(
  userPermissionsFromJwt,
  roleName,
  requiredKey,
  rolePermissionMap
) {
  const required = atomsGrantedByPermissionKey(requiredKey);
  if (required.size === 0) return false;

  const userAtoms = effectiveAtomSetFromKeys(userPermissionsFromJwt);
  for (const a of required) {
    if (userAtoms.has(a)) return true;
  }

  const roleKeys = rolePermissionMap[roleName] || [];
  const roleAtoms = effectiveAtomSetFromKeys(roleKeys);
  for (const a of required) {
    if (roleAtoms.has(a)) return true;
  }
  return false;
}
