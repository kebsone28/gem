/**
 * Configuration des Rôles et Permissions - PROQUELEC SaaS
 * Centralisation de la logique d'accès pour une maintenance facilitée.
 */

export const ROLES = {
    ADMIN: "ADMIN_PROQUELEC",
    ADMIN_ALT: "ADMIN_ALT",
    DIRECTEUR: "DIRECTEUR",
    CHEF_PROJET: "CHEF_PROJET",
    COMPTABLE: "COMPTABLE",
    CHEF_EQUIPE: "CHEF_EQUIPE",
    PATRIMOINE: "PATRIMOINE",
    EMPLOYE: "EMPLOYE",
    CLIENT_LSE: "CLIENT_LSE",
    SUPERVISEUR: "SUPERVISEUR",
    CONTROLEUR: "CONTROLEUR",
    // Rôles Mode Gouvernement
    MINISTRE: "MINISTRE",
    DIRECTEUR_GENERAL: "DIRECTEUR_GENERAL",
    INSPECTEUR_GENERAL: "INSPECTEUR_GENERAL",
    // Rôles Mode ONG
    COORDINATEUR: "COORDINATEUR",
    RESPONSABLE_IMPACT: "RESPONSABLE_IMPACT",
    PROTECTION_BENEFICIAIRES: "PROTECTION_BENEFICIAIRES",
    // Rôles Mode Bailleur
    COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER",
    REPRESENTANT_BAILLEUR: "REPRESENTANT_BAILLEUR",
    AUDITEUR_EXTERNE: "AUDITEUR_EXTERNE",
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
    VALIDER_MISSION: "valider_mission",
    GERER_PV: "gerer_pv"
    ,
    // Permissions additionnelles pour l'UI granularité des missions
    VOIR_MISSIONS: "voir_missions",
    VOIR_REGISTRE_MISSIONS: "voir_registre_missions",
    MODIFIER_MISSIONS: "modifier_missions",
    SUPPRIMER_MISSIONS: "supprimer_missions",
    ARCHIVER_MISSIONS: "archiver_missions",
    VALIDATION_OPERATIONNELLE: "validation_operationnelle",
    APPROBATION_FINALE_DG: "approbation_finale_dg",
    // [FIX C-2] Permissions MES granulaires
    MES_CREATE: "mes.create",
    MES_UPDATE: "mes.update",
    MES_DELETE: "mes.delete",
    MES_VALIDATE: "mes.validate",
    MES_CONTROL: "mes.control",
    MES_IMPORT: "mes.import",
    MES_EXPORT: "mes.export",
    // Permissions Toolbox (GED OS Toolbox)
    TOOLBOX_SUBMISSION_CREATE: "toolbox.submission.create",
    TOOLBOX_SUBMISSION_EDIT: "toolbox.submission.edit",
    TOOLBOX_SUBMISSION_VALIDATE: "toolbox.submission.validate",
    TOOLBOX_SUBMISSION_DELETE: "toolbox.submission.delete",
    TOOLBOX_SETTINGS_READ: "toolbox.settings.read",
    TOOLBOX_SETTINGS_MANAGE: "toolbox.settings.manage",
    // Household export
    HOUSEHOLD_EXPORT: "household.export",
};

export const ROLE_PERMISSIONS = {
    // 👑 ADMIN: Accès absolu
    [ROLES.ADMIN]: Object.values(PERMISSIONS),
    [ROLES.ADMIN_ALT]: Object.values(PERMISSIONS),
    // DIRECTEUR: accès complet sauf gestion des utilisateurs et paramètres
    [ROLES.DIRECTEUR]: Object.values(PERMISSIONS).filter(
        p => p !== PERMISSIONS.GERER_UTILISATEURS && p !== PERMISSIONS.GERER_PARAMETRES
    ),

    // 🚀 OPÉRATIONNELS: Tout sauf suppression de projet (peuvent créer)
    [ROLES.CHEF_PROJET]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.MODIFIER_CARTE,
        PERMISSIONS.CREER_PROJET,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.VOIR_SIMULATION,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_FINANCES,
        PERMISSIONS.ACCES_TERMINAL_KOBO,
        PERMISSIONS.GERER_PV,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.MODIFIER_MISSIONS,
        PERMISSIONS.TOOLBOX_SUBMISSION_CREATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_EDIT,
        PERMISSIONS.TOOLBOX_SUBMISSION_VALIDATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_DELETE,
        PERMISSIONS.TOOLBOX_SETTINGS_READ,
        PERMISSIONS.TOOLBOX_SETTINGS_MANAGE,
    ],

    // 📈 FINANCES & AUDIT
    [ROLES.COMPTABLE]: [
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_FINANCES,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_MISSIONS,
        // MES — le comptable peut exporter
        PERMISSIONS.MES_EXPORT,
    ],

    // 🗺️ CLIENTS & SUPERVISION EXTERNE
    [ROLES.CLIENT_LSE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS
    ],

    // 🚀 OPÉRATIONNELS: peuvent aussi valider les soumissions terrain
    [ROLES.SUPERVISEUR]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VALIDER_MISSION,
        // [FIX C-2] Superviseur peut valider et contrôler les MES
        PERMISSIONS.MES_VALIDATE,
        PERMISSIONS.MES_CONTROL,
        PERMISSIONS.MES_EXPORT,
        PERMISSIONS.TOOLBOX_SUBMISSION_VALIDATE,
    ],
    [ROLES.CONTROLEUR]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        // [FIX C-2] Contrôleur peut contrôler les MES
        PERMISSIONS.MES_CONTROL,
        PERMISSIONS.MES_EXPORT,
        PERMISSIONS.TOOLBOX_SUBMISSION_VALIDATE,
    ],

    // 🔨 TERRAIN
    [ROLES.CHEF_EQUIPE]: [
        PERMISSIONS.ACCES_TERMINAL_KOBO,
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VOIR_REGISTRE_MISSIONS,
        // [FIX C-2] Chef d'équipe peut créer et modifier des MES
        PERMISSIONS.MES_CREATE,
        PERMISSIONS.MES_UPDATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_CREATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_EDIT,
    ],
    [ROLES.EMPLOYE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS
    ],
    [ROLES.PATRIMOINE]: [
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.VOIR_MISSIONS
    ],

    // 🏛️ RÔLES MODE GOUVERNEMENT
    [ROLES.MINISTRE]: [
        // Accès complet pour décisions stratégiques
        ...Object.values(PERMISSIONS).filter(p => p !== PERMISSIONS.GERER_UTILISATEURS && p !== PERMISSIONS.GERER_PARAMETRES),
    ],
    [ROLES.DIRECTEUR_GENERAL]: [
        // Transmission au ministère, validation niveau directeur
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VALIDER_MISSION,
        PERMISSIONS.APPROBATION_FINALE_DG,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.MES_VALIDATE,
        PERMISSIONS.MES_EXPORT,
    ],
    [ROLES.INSPECTEUR_GENERAL]: [
        // Audit légal, accès lecture seule
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.MES_CONTROL,
        PERMISSIONS.MES_EXPORT,
    ],

    // 🤝 RÔLES MODE ONG
    [ROLES.COORDINATEUR]: [
        // Évaluation impact, validation bénéficiaires
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.CREER_MISSION,
        PERMISSIONS.VALIDER_MISSION,
        PERMISSIONS.GERER_LOGISTIQUE,
        PERMISSIONS.MES_CREATE,
        PERMISSIONS.MES_UPDATE,
        PERMISSIONS.MES_VALIDATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_CREATE,
        PERMISSIONS.TOOLBOX_SUBMISSION_EDIT,
        PERMISSIONS.TOOLBOX_SUBMISSION_VALIDATE,
    ],
    [ROLES.RESPONSABLE_IMPACT]: [
        // Mesure impact uniquement, rapports sociaux
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.MES_EXPORT,
        PERMISSIONS.MES_VALIDATE,
    ],
    [ROLES.PROTECTION_BENEFICIAIRES]: [
        // Accès restreint données sensibles, validation éthique
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.MES_CONTROL,
        // Pas d'accès aux données personnelles par défaut
    ],

    // 🌍 RÔLES MODE BAILLEUR
    [ROLES.COMPLIANCE_OFFICER]: [
        // Vérification conformité uniquement, standards BM/BAD/UE
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.MES_CONTROL,
        PERMISSIONS.MES_EXPORT,
        PERMISSIONS.TOOLBOX_SUBMISSION_VALIDATE,
    ],
    [ROLES.REPRESENTANT_BAILLEUR]: [
        // Validation finale bailleur, reporting standardisé
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VALIDER_MISSION,
        PERMISSIONS.APPROBATION_FINALE_DG,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.MES_EXPORT,
        PERMISSIONS.MES_VALIDATE,
    ],
    [ROLES.AUDITEUR_EXTERNE]: [
        // Audit externe uniquement, accès lecture seule
        PERMISSIONS.VOIR_CARTE,
        PERMISSIONS.VOIR_RAPPORTS,
        PERMISSIONS.VOIR_MISSIONS,
        PERMISSIONS.VOIR_FINANCES,
        PERMISSIONS.MES_CONTROL,
        PERMISSIONS.MES_EXPORT,
    ],
};

/**
 * Helper function to check if an email is a super admin
 * Supports comma-separated SUPER_ADMIN_EMAIL environment variable
 * @param {string} email - Email to check
 * @returns {boolean} - True if email is a super admin
 */
export const isSuperAdminEmail = (email) => {
    if (!email) return false;
    const superAdminEmails = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmails) return false;

    // Split by comma and trim whitespace
    const emailList = superAdminEmails.split(',').map(e => e.trim());
    return emailList.includes(email.trim());
};
