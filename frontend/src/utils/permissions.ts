 
/**
 * 🔐 Moteur de Sécurité & RBAC - GEM SAAS
 * Version : Fortress-Class / Infinity Granularity
 */

// 1️⃣ RÉFÉRENTIEL DES RÔLES
export const ROLES = {
  ADMIN: 'ADMIN_PROQUELEC',
  ADMIN_ALT: 'ADMINISTRATEUR',
  DG: 'DG_PROQUELEC',
  DG_ALT: 'DIRECTION GÉNÉRALE',
  CHEF_PROJET: 'CHEF_PROJET',
  CHEF_PROJET_ALT: 'CHEF DE PROJET',
  CHEF_EQUIPE: 'CHEF_EQUIPE',
  CHEF_CHANTIER: 'CHEF DE CHANTIER',
  CHEF: 'CHEF',
  COMPTABLE: 'COMPTABLE',
  DIRECTEUR: 'DIRECTEUR',
  CLIENT_LSE: 'CLIENT_LSE',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// 2️⃣ TABLE D'ALIAS
export const ROLE_ALIASES: Record<string, UserRole> = {
  ADMIN_PROQUELEC: ROLES.ADMIN,
  ADMINISTRATEUR: ROLES.ADMIN,
  ADMIN: ROLES.ADMIN,
  DG_PROQUELEC: ROLES.DG,
  'DIRECTION GÉNÉRALE': ROLES.DG,
  DIRECTEUR: ROLES.DG,
  CHEF_PROJET: ROLES.CHEF_PROJET,
  'CHEF DE PROJET': ROLES.CHEF_PROJET,
  CP: ROLES.CHEF_PROJET,
  'CHEF DE CHANTIER': ROLES.CHEF_EQUIPE,
  CHEF_EQUIPE: ROLES.CHEF_EQUIPE,
  CHEF: ROLES.CHEF_EQUIPE,
  COMPTABLE: ROLES.COMPTABLE,
  CLIENT_LSE: ROLES.CLIENT_LSE,
};

// 3️⃣ RÉFÉRENTIEL TOTAL DES PERMISSIONS
export const PERMISSIONS = {
  // --- ADMINISTRATION & SÉCURITÉ ---
  GERER_UTILISATEURS: 'gerer_utilisateurs',
  GERER_PARAMETRES: 'gerer_parametres',
  VOIR_AUDIT_LOGS: 'voir_audit_logs',
  EXPORTER_AUDIT_LOGS: 'exporter_audit_logs',
  ACCES_GOD_MODE: 'acces_god_mode',
  VOIR_DIAGNOSTIC: 'voir_diagnostic',
  MODIFIER_TEMPLATES: 'modifier_templates',
  DIFFUSER_MESSAGE_SYSTEME: 'diffuser_message_systeme',
  GENERER_CLES_API: 'generer_cles_api',
  GERER_WEBHOOKS: 'gerer_webhooks',

  // --- MISSIONS (OM) ---
  VOIR_MISSIONS: 'voir_missions',
  CREER_MISSION: 'creer_mission',
  MODIFIER_MISSION: 'modifier_mission',
  VALIDER_MISSION: 'valider_mission',
  APPROUVER_MISSION: 'approuver_mission',
  SUPPRIMER_MISSION: 'supprimer_mission',
  ARCHIVER_MISSION: 'archiver_mission',
  PURGER_MISSIONS: 'purger_missions',
  CONFIGURER_WORKFLOW: 'configurer_workflow',

  // --- ÉQUIPES ---
  VOIR_EQUIPES: 'voir_equipes',
  CREER_EQUIPE: 'creer_equipe',
  MODIFIER_EQUIPE: 'modifier_equipe',
  SUPPRIMER_EQUIPE: 'supprimer_equipe',

  // --- FINANCES ---
  VOIR_FINANCES: 'voir_finances',
  GERER_BUDGETS: 'gerer_budgets',
  VOIR_PAIEMENTS: 'voir_paiements',
  EXPORTER_COMPTABILITE: 'exporter_comptabilite',
  REINITIALISER_STATISTIQUES: 'reinitialiser_statistiques',

  // --- TERRAIN & CARTE ---
  VOIR_CARTE: 'voir_carte',
  MODIFIER_CARTE: 'modifier_carte',
  GERER_ZONES: 'gerer_zones',
  GERER_MENAGES: 'gerer_menages',
  VALIDER_INSTALLATION: 'valider_installation',
  REJETER_DOSSIER: 'rejeter_dossier',

  // --- PROJETS & PLANNING ---
  VOIR_PROJETS: 'voir_projets',
  CREER_PROJET: 'creer_projet',
  MODIFIER_PROJET: 'modifier_projet',
  SUPPRIMER_PROJET: 'supprimer_projet',
  ARCHIVER_PROJET: 'archiver_projet',
  GERER_PLANNING: 'gerer_planning',
  MODIFIER_VUES_TABLEAUX_BORD: 'modifier_vues_tableaux_bord',

  // --- LOGISTIQUE & KOBO ---
  VOIR_LOGISTIQUE: 'voir_logistique',
  GERER_LOGISTIQUE: 'gerer_logistique',
  GERER_STOCK: 'gerer_stock',
  ACCES_TERMINAL_KOBO: 'acces_terminal_kobo',
  CONFIGURER_KOBO: 'configurer_kobo',

  // --- RAPPORTS & DOCUMENTS ---
  VOIR_RAPPORTS_TERRAIN: 'voir_rapports_terrain',
  VOIR_RAPPORTS_FINANCIERS: 'voir_rapports_financiers',
  GERER_PV: 'gerer_pv',
  EXPORTER_DONNEES: 'exporter_donnees',
  VOIR_DOCUMENTS_CONFIDENTIELS: 'voir_documents_confidentiels',
  SUPPRIMER_DOCUMENTS: 'supprimer_documents',

  // --- FORMATIONS ---
  VOIR_FORMATIONS: 'voir_formations',
  GERER_FORMATIONS: 'gerer_formations',

  // --- COMMUNICATION ---
  ACCES_CHAT: 'acces_chat',
  MODERER_CHAT: 'moderer_chat',
  ENVOYER_SMS_MASSIF: 'envoyer_sms_massif',

  // --- ALERTES ---
  VOIR_ALERTES: 'voir_alertes',
  CONFIGURER_ALERTES: 'configurer_alertes',

  // --- SYNCHRONISATION ---
  VOIR_SYNCHRO: 'voir_synchro',
  GERER_CONFLITS: 'gerer_conflits',

  // --- IA & ANALYTICS ---
  UTILISER_IA: 'utiliser_ia',
  GERER_MEMOIRE_IA: 'gerer_memoire_ia',
  VOIR_METRIQUES_IA: 'voir_metriques_ia',

  // --- SIMULATION ---
  VOIR_SIMULATION: 'voir_simulation',
  LANCER_SIMULATION: 'lancer_simulation',
};

// 4️⃣ MATRICE DE DROITS PAR DÉFAUT
// @ts-expect-error - ROLE_PERMISSIONS
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  [ROLES.DG]: [
    PERMISSIONS.VOIR_MISSIONS,
    PERMISSIONS.CREER_MISSION,
    PERMISSIONS.APPROUVER_MISSION,
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.VOIR_PAIEMENTS,
    PERMISSIONS.VOIR_RAPPORTS_TERRAIN,
    PERMISSIONS.VOIR_RAPPORTS_FINANCIERS,
    PERMISSIONS.VOIR_SIMULATION,
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.GERER_PV,
    PERMISSIONS.VOIR_FORMATIONS,
    PERMISSIONS.ACCES_CHAT,
    PERMISSIONS.VOIR_ALERTES,
    PERMISSIONS.UTILISER_IA,
    PERMISSIONS.DIFFUSER_MESSAGE_SYSTEME,
    PERMISSIONS.EXPORTER_DONNEES,
    PERMISSIONS.VOIR_DOCUMENTS_CONFIDENTIELS,
    PERMISSIONS.VOIR_METRIQUES_IA,
  ],

  [ROLES.CHEF_PROJET]: [
    PERMISSIONS.VOIR_MISSIONS,
    PERMISSIONS.CREER_MISSION,
    PERMISSIONS.MODIFIER_MISSION,
    PERMISSIONS.VALIDER_MISSION,
    PERMISSIONS.VOIR_PROJETS,
    PERMISSIONS.MODIFIER_PROJET,
    PERMISSIONS.GERER_PLANNING,
    PERMISSIONS.VOIR_EQUIPES,
    PERMISSIONS.CREER_EQUIPE,
    PERMISSIONS.MODIFIER_EQUIPE,
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.MODIFIER_CARTE,
    PERMISSIONS.GERER_ZONES,
    PERMISSIONS.GERER_MENAGES,
    PERMISSIONS.VALIDER_INSTALLATION,
    PERMISSIONS.REJETER_DOSSIER,
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.VOIR_RAPPORTS_TERRAIN,
    PERMISSIONS.ACCES_TERMINAL_KOBO,
    PERMISSIONS.GERER_PV,
    PERMISSIONS.VOIR_FORMATIONS,
    PERMISSIONS.GERER_FORMATIONS,
    PERMISSIONS.ACCES_CHAT,
    PERMISSIONS.VOIR_ALERTES,
    PERMISSIONS.VOIR_SYNCHRO,
    PERMISSIONS.GERER_CONFLITS,
    PERMISSIONS.UTILISER_IA,
    PERMISSIONS.EXPORTER_DONNEES,
  ],

  [ROLES.COMPTABLE]: [
    PERMISSIONS.VOIR_MISSIONS,
    PERMISSIONS.VOIR_FINANCES,
    PERMISSIONS.VOIR_PAIEMENTS,
    PERMISSIONS.EXPORTER_COMPTABILITE,
    PERMISSIONS.VOIR_RAPPORTS_FINANCIERS,
    PERMISSIONS.VOIR_LOGISTIQUE,
    PERMISSIONS.GERER_LOGISTIQUE,
    PERMISSIONS.ACCES_CHAT,
    PERMISSIONS.EXPORTER_DONNEES,
  ],

  [ROLES.CLIENT_LSE]: [
    PERMISSIONS.VOIR_CARTE, 
    PERMISSIONS.VOIR_RAPPORTS_TERRAIN,
    PERMISSIONS.VOIR_MISSIONS,
    PERMISSIONS.ACCES_CHAT,
  ],

  [ROLES.CHEF_EQUIPE]: [
    PERMISSIONS.VOIR_MISSIONS,
    PERMISSIONS.ACCES_TERMINAL_KOBO,
    PERMISSIONS.VOIR_CARTE,
    PERMISSIONS.VOIR_RAPPORTS_TERRAIN,
    PERMISSIONS.ACCES_CHAT,
    PERMISSIONS.VOIR_ALERTES,
    PERMISSIONS.VOIR_SYNCHRO,
    PERMISSIONS.VOIR_EQUIPES,
  ],
};

// 5️⃣ HELPERS
export const normalizeRole = (role?: string): UserRole | null => {
  if (!role) return null;
  return ROLE_ALIASES[role.trim().toUpperCase()] || null;
};

export const isMasterAdmin = (user: any): boolean => {
  if (!user) return false;
  const nRole = normalizeRole(user.role);
  return nRole === ROLES.ADMIN || user.email === 'admingem' || user.email === 'admin@proquelec.com';
};

export const hasPermission = (user: any, permission: string | string[]): boolean => {
  if (!user) return false;
  if (isMasterAdmin(user)) return true;

  const check = (p: string) => {
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(p);
    }
    const nRole = normalizeRole(user.role);
    if (!nRole) return false;
    return ROLE_PERMISSIONS[nRole]?.includes(p) || false;
  };

  if (Array.isArray(permission)) {
    return permission.some(p => check(p));
  }
  return check(permission);
};

// 🏷️ Labels UI Complet
export const PERMISSION_LABELS: Record<string, string> = {
  // Administration
  [PERMISSIONS.GERER_UTILISATEURS]: 'Gestion des Comptes',
  [PERMISSIONS.GERER_PARAMETRES]: 'Paramètres Système',
  [PERMISSIONS.VOIR_AUDIT_LOGS]: 'Historique (Audit Logs)',
  [PERMISSIONS.EXPORTER_AUDIT_LOGS]: 'Exporter Logs Audit',
  [PERMISSIONS.ACCES_GOD_MODE]: 'Mode Simulation (God Mode)',
  [PERMISSIONS.VOIR_DIAGNOSTIC]: 'Diagnostic Serveur',
  [PERMISSIONS.MODIFIER_TEMPLATES]: 'Modifier Modèles PDF/Docs',
  [PERMISSIONS.DIFFUSER_MESSAGE_SYSTEME]: 'Diffuser Message Global',
  [PERMISSIONS.GENERER_CLES_API]: 'Générer Clés API',
  [PERMISSIONS.GERER_WEBHOOKS]: 'Gérer Webhooks (Intégration)',

  // Missions
  [PERMISSIONS.VOIR_MISSIONS]: 'Voir Registre Missions',
  [PERMISSIONS.CREER_MISSION]: 'Créer Missions',
  [PERMISSIONS.MODIFIER_MISSION]: 'Modifier Missions',
  [PERMISSIONS.VALIDER_MISSION]: 'Validation Opérationnelle',
  [PERMISSIONS.APPROUVER_MISSION]: 'Approbation Finale (DG)',
  [PERMISSIONS.SUPPRIMER_MISSION]: 'Supprimer Missions',
  [PERMISSIONS.ARCHIVER_MISSION]: 'Archiver Missions',
  [PERMISSIONS.PURGER_MISSIONS]: '☢️ PURGER LE SERVEUR',
  [PERMISSIONS.CONFIGURER_WORKFLOW]: 'Configurer Étapes Approbation',

  // Équipes
  [PERMISSIONS.VOIR_EQUIPES]: 'Voir les Équipes',
  [PERMISSIONS.CREER_EQUIPE]: 'Former des Équipes',
  [PERMISSIONS.MODIFIER_EQUIPE]: 'Gérer Composition Équipes',
  [PERMISSIONS.SUPPRIMER_EQUIPE]: 'Dissoudre des Équipes',

  // Finances
  [PERMISSIONS.VOIR_FINANCES]: 'Tableau de bord Finances',
  [PERMISSIONS.GERER_BUDGETS]: 'Gestion des Budgets',
  [PERMISSIONS.VOIR_PAIEMENTS]: 'Suivi des Paiements',
  [PERMISSIONS.EXPORTER_COMPTABILITE]: 'Exports Comptables',
  [PERMISSIONS.REINITIALISER_STATISTIQUES]: 'Réinitialiser Stats Mensuelles',

  // Terrain
  [PERMISSIONS.VOIR_CARTE]: 'Carte Interactive',
  [PERMISSIONS.MODIFIER_CARTE]: 'Édition Cartographique',
  [PERMISSIONS.GERER_ZONES]: 'Gestion Zones/Grappes',
  [PERMISSIONS.GERER_MENAGES]: 'Gestion des Ménages',
  [PERMISSIONS.VALIDER_INSTALLATION]: 'Valider Conformité Terrain',
  [PERMISSIONS.REJETER_DOSSIER]: 'Rejeter Dossier Kobo',

  // Projets
  [PERMISSIONS.VOIR_PROJETS]: 'Registre des Projets',
  [PERMISSIONS.CREER_PROJET]: 'Nouveau Projet',
  [PERMISSIONS.MODIFIER_PROJET]: 'Paramétrage Projets',
  [PERMISSIONS.SUPPRIMER_PROJET]: 'Supprimer Projets',
  [PERMISSIONS.ARCHIVER_PROJET]: 'Archiver Projets',
  [PERMISSIONS.GERER_PLANNING]: 'Planning (Gantt)',
  [PERMISSIONS.MODIFIER_VUES_TABLEAUX_BORD]: 'Personnaliser Dashboard',

  // Logistique
  [PERMISSIONS.VOIR_LOGISTIQUE]: 'État des Stocks',
  [PERMISSIONS.GERER_LOGISTIQUE]: 'Gestion Logistique',
  [PERMISSIONS.GERER_STOCK]: 'Mouvements de Stock',
  [PERMISSIONS.ACCES_TERMINAL_KOBO]: 'Terminal Collecte Kobo',
  [PERMISSIONS.CONFIGURER_KOBO]: 'Configuration Kobo',

  // Rapports & Documents
  [PERMISSIONS.VOIR_RAPPORTS_TERRAIN]: 'Rapports Techniques',
  [PERMISSIONS.VOIR_RAPPORTS_FINANCIERS]: 'Rapports Financiers',
  [PERMISSIONS.GERER_PV]: 'Génération des PV',
  [PERMISSIONS.EXPORTER_DONNEES]: 'Exports Excel Massifs',
  [PERMISSIONS.VOIR_DOCUMENTS_CONFIDENTIELS]: 'Voir Docs Confidentiels',
  [PERMISSIONS.SUPPRIMER_DOCUMENTS]: 'Supprimer Documents/Médias',

  // Formations
  [PERMISSIONS.VOIR_FORMATIONS]: 'Accès Sessions Formation',
  [PERMISSIONS.GERER_FORMATIONS]: 'Gérer Planning Formations',

  // Communication
  [PERMISSIONS.ACCES_CHAT]: 'Utiliser la Messagerie',
  [PERMISSIONS.MODERER_CHAT]: 'Modération du Chat',
  [PERMISSIONS.ENVOYER_SMS_MASSIF]: 'Envoi SMS Groupés',

  // Alertes
  [PERMISSIONS.VOIR_ALERTES]: 'Consulter les Alertes',
  [PERMISSIONS.CONFIGURER_ALERTES]: 'Régler Seuils Alertes',

  // Synchro
  [PERMISSIONS.VOIR_SYNCHRO]: 'Logs de Synchronisation',
  [PERMISSIONS.GERER_CONFLITS]: 'Résoudre Conflits Offline',

  // IA
  [PERMISSIONS.UTILISER_IA]: 'Accès Assistant Wanekoo',
  [PERMISSIONS.GERER_MEMOIRE_IA]: 'Gérer Personnalité IA',
  [PERMISSIONS.VOIR_METRIQUES_IA]: 'Consommation & Coûts IA',

  // Simulation
  [PERMISSIONS.VOIR_SIMULATION]: 'Accès Simulation',
  [PERMISSIONS.LANCER_SIMULATION]: 'Lancer Scénarios IA',
};
