export const INTERNAL_KOBO_FORM_KEY = 'terrain_internal';
export const INTERNAL_KOBO_FORM_VERSION = '8 (2021-07-24 19:48:35)';

export const INTERNAL_KOBO_ALLOWED_ROLES = new Set([
    'livreur',
    'macon',
    'reseau',
    'interieur',
    'controleur',
    '__pr_parateur'
]);

const REQUIRED_RULES = [
    { name: 'Numero_ordre' },
    { name: 'nom_key' },
    { name: 'telephone_key' },
    { name: 'latitude_key' },
    { name: 'longitude_key' },
    { name: 'region_key' },
    { name: 'LOCALISATION_CLIENT' },
    { name: 'role' },
    {
        name: 'Longueur_Cable_2_5mm_Int_rieure',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'",
        aliases: ['Longueur_c\u00e2ble_2_5mm_Int_rieure']
    },
    {
        name: 'Longueur_Cable_1_5mm_Int_rieure',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'",
        aliases: ['Longueur_c\u00e2ble_1_5mm_Int_rieure']
    },
    {
        name: 'Longueur_Tranch_e_Cable_arm_4mm',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'",
        aliases: ['Longueur_Tranch_e_c\u00e2ble_arm_4mm']
    },
    {
        name: 'Longueur_Tranch_e_C_ble_arm_1_5mm',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'"
    },
    {
        name: 'Je_confirme_la_remis_u_materiel_au_m_nage',
        type: 'acknowledge',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'"
    },
    {
        name: 'Je_confirme_le_marqu_osition_des_coffrets',
        type: 'acknowledge',
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'"
    },
    {
        name: 'Je_confirme_le_marqu_coffrets_lectriques',
        type: 'acknowledge',
        aliases: ['Je_confirme_le_marqu_s_coffret_lectrique'],
        relevant: "${role} = 'livreur' and ${Situation_du_M_nage} = 'menage_eligible'"
    },
    { name: 'kit_disponible_macon', relevant: "${role} = 'macon'" },
    {
        name: 'type_mur_realise_macon',
        relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'oui'"
    },
    {
        name: 'validation_macon_final',
        type: 'acknowledge',
        relevant: "${role} = 'macon' and ${kit_disponible_macon} = 'oui' and ${type_mur_realise_macon} != ''"
    },
    { name: 'verification_mur_reseau', relevant: "${role} = 'reseau'" },
    {
        name: 'problemes_mur_reseau',
        relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'non'"
    },
    {
        name: 'etat_branchement_reseau',
        relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'oui'"
    },
    {
        name: 'validation_reseau_final',
        type: 'acknowledge',
        relevant: "${role} = 'reseau' and ${verification_mur_reseau} = 'oui' and ${etat_branchement_reseau} = 'termine'"
    },
    { name: 'verification_branchement_interieur', relevant: "${role} = 'interieur'" },
    {
        name: 'etat_installation_interieur',
        relevant: "${role} = 'interieur' and ${verification_branchement_interieur} = 'oui'"
    },
    {
        name: 'validation_interieur_final',
        type: 'acknowledge',
        relevant: "${role} = 'interieur' and ${verification_branchement_interieur} = 'oui' and ${etat_installation_interieur} = 'termine'"
    },
    { name: 'ETAT_DE_L_INSTALLATION', relevant: "${role} = 'controleur'" },
    {
        name: 'controleurPROB',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'probleme_a_signaler'"
    },
    {
        name: 'Phase_de_controle',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'ETAT_BRANCHEMENT',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATION',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'non_termine'"
    },
    {
        name: 'Position_du_branchement',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'"
    },
    {
        name: 'Observations_sur_la_ition_du_branchement',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Position_du_branchement} = 'non_conforme'"
    },
    {
        name: 'Hauteur_branchement',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'"
    },
    {
        name: 'Observations',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Hauteur_branchement} = 'non_conforme'"
    },
    {
        name: 'Hauteur_coffret',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'"
    },
    {
        name: 'Observations_001',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Hauteur_coffret} = 'non_conforme'"
    },
    {
        name: 'OBSERVATION_001',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Etat_du_coupe_circuit} = 'nc'"
    },
    {
        name: 'Continuit_PVC',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'"
    },
    {
        name: 'OBSERVATION_002',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Continuit_PVC} = 'non_conforme'"
    },
    {
        name: 'Mise_en_oeuvre',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise'"
    },
    {
        name: 'OBSERVATION_003',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ETAT_BRANCHEMENT} = 'realise' and ${Mise_en_oeuvre} = 'non_conforme'"
    },
    {
        name: 'DISJONCTEUR_GENERAL_EN_TETE_D_',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS_',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${DISJONCTEUR_GENERAL_EN_TETE_D_} = 'non_conforme'"
    },
    {
        name: 'TYPE_DE_DISJONCTEUR_GENERAL',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${DISJONCTEUR_GENERAL_EN_TETE_D_} = 'conforme'"
    },
    {
        name: 'ENSEMBLE_DE_L_INSTALLATION_PRO',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__001',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${ENSEMBLE_DE_L_INSTALLATION_PRO} = 'non_conforme'"
    },
    {
        name: 'PROTECTION_L_ORIGINE_DE_CHAQ',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS_002',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${PROTECTION_L_ORIGINE_DE_CHAQ} = 'non_conforme'"
    },
    {
        name: 'S_PARATION_DES_CIRCUITS_Lumi_',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__002',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${S_PARATION_DES_CIRCUITS_Lumi_} = 'non_conforme'"
    },
    {
        name: 'PROTECTION_CONTRE_LES_CONTACTS',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__003',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${PROTECTION_CONTRE_LES_CONTACTS} = 'non_conforme'"
    },
    {
        name: 'MISE_EN_OEUVRE_MAT_RIEL_ET_APP',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__004',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${MISE_EN_OEUVRE_MAT_RIEL_ET_APP} = 'non_conforme'"
    },
    {
        name: 'CONTINUITE_DE_LA_PROTECTION_ME',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__005',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${CONTINUITE_DE_LA_PROTECTION_ME} = 'non_conforme'"
    },
    {
        name: 'MISE_EN_UVRE_DU_R_SEAU_DE_TER',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__006',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${MISE_EN_UVRE_DU_R_SEAU_DE_TER} = 'non_conforme'"
    },
    {
        name: 'VALEUR_DE_LA_RESISTANCE_DE_TER',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee'"
    },
    {
        name: 'OBSERVATIONS__007',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${VALEUR_DE_LA_RESISTANCE_DE_TER} != ''"
    },
    {
        name: 'validation_controleur_final',
        type: 'acknowledge',
        relevant: "${role} = 'controleur' and ${ETAT_DE_L_INSTALLATION} = 'terminee' and ${OBSERVATIONS__007} != ''"
    },
    { name: 'notes_generales', relevant: "${role} = 'livreur' or ${role} = '__pr_parateur' or ${role} = 'macon' or ${role} = 'reseau' or ${role} = 'interieur' or ${role} = 'controleur'" }
];

function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function isTruthyKoboValue(value) {
    return value === true || value === 'true' || value === 'yes' || value === 'oui' || value === '1';
}

function getValue(values, rule) {
    if (hasValue(values[rule.name])) return values[rule.name];
    for (const alias of rule.aliases || []) {
        if (hasValue(values[alias])) return values[alias];
    }
    return values[rule.name];
}

function getExpressionValue(values, fieldName) {
    const rule = REQUIRED_RULES.find((item) => item.name === fieldName || item.aliases?.includes(fieldName));
    return rule ? getValue(values, rule) : values[fieldName];
}

function evaluateAtomicRelevant(expression, values) {
    const cleaned = String(expression || '').trim().replace(/^\((.*)\)$/, '$1').trim();
    const comparison = cleaned.match(/^\$\{([^}]+)\}\s*(=|!=)\s*'([^']*)'$/);

    if (comparison) {
        const [, fieldName, operator, expected] = comparison;
        const actual = getExpressionValue(values, fieldName);
        const actualValues = Array.isArray(actual) ? actual.map(String) : String(actual ?? '');
        const matches = Array.isArray(actualValues)
            ? actualValues.includes(expected)
            : actualValues === expected;

        return operator === '=' ? matches : !matches;
    }

    const presence = cleaned.match(/^\$\{([^}]+)\}$/);
    if (presence) return hasValue(getExpressionValue(values, presence[1]));

    return true;
}

function isRelevant(rule, values) {
    if (!rule.relevant) return true;

    return rule.relevant
        .split(/\s+or\s+/i)
        .some((orPart) =>
            orPart
                .split(/\s+and\s+/i)
                .every((andPart) => evaluateAtomicRelevant(andPart, values))
        );
}

function hasRequiredValue(rule, values) {
    const value = getValue(values, rule);
    if (rule.type === 'acknowledge') return isTruthyKoboValue(value);
    return hasValue(value);
}

export function getServerRequiredMissing(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return [];

    return REQUIRED_RULES
        .filter((rule) => isRelevant(rule, values))
        .filter((rule) => !hasRequiredValue(rule, values))
        .map((rule) => rule.name);
}
