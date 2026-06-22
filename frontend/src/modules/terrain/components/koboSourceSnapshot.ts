export type KoboSourceRubric = {
  title: string;
  subtitle: string;
  fields: number;
  role?: string;
};

export type KoboSourceVersion = {
  uid: string;
  contentHash: string;
  deployedAt: string;
};

export const KOBO_SOURCE_SNAPSHOT = {
  capturedAt: '2026-05-03T23:55:00Z',
  assetUid: 'aEYZwPujJiFBTNb6mxMGCB',
  name: 'Suivi Electrification menages V2',
  owner: 'kobo-source-owner',
  deploymentActive: true,
  sourceSubmissionCount: 2,
  versionCount: 198,
  currentVersionId: 'vTCfrZAhqHk4NJCDeaULmx',
  currentContentHash: 'b09bc8e23bc8af50b810cdd02c59d52d0769ca83',
  currentDeployedAt: '2026-05-03T04:01:36.365126Z',
  deployedVersions: [
    { uid: 'vTCfrZAhqHk4NJCDeaULmx', contentHash: 'b09bc8e23bc8af50b810cdd02c59d52d0769ca83', deployedAt: '2026-05-03T04:01:36.365126Z' },
    { uid: 'vQskSRqbSxethka9amDU4g', contentHash: '9523e620052bfeebde8123e02ec99c98b4be312a', deployedAt: '2026-03-21T03:13:07.158222Z' },
    { uid: 'vZ53xZFuJJ2hyz5xUErdNp', contentHash: 'a512f3109f79895a7b854c36de6655c08bc5d261', deployedAt: '2025-12-07T02:15:01.590047Z' },
    { uid: 'vpVDizrwzVZ93oYKDTKbnU', contentHash: 'a512f3109f79895a7b854c36de6655c08bc5d261', deployedAt: '2025-12-06T07:45:00.904158Z' },
    { uid: 'vv3GDuoNGWKA2nQqnsZXWw', contentHash: 'd7fc67882a662db2847383478d33718a86bda8a1', deployedAt: '2025-12-03T13:04:35.295172Z' },
    { uid: 'vmnR6ZqsVVSbTzAguCcreP', contentHash: '31d9db623fe4465232d7139ae816e6c47dc0be3d', deployedAt: '2025-12-02T21:12:22.769072Z' },
    { uid: 'vmR65Y3vurNZAksHGbJH2u', contentHash: 'dc77dd0f1974345567e4fed37730efe3626bf4d3', deployedAt: '2025-12-02T19:36:34.403116Z' },
    { uid: 'vygwkScgN6dBS449GxUBZg', contentHash: 'fbb16c80c610f8489f16cc3a210a085a99075b47', deployedAt: '2025-12-02T19:11:07.704386Z' },
    { uid: 'vnHtrXT8HkjtcTfgV8RUnr', contentHash: 'f48b1a6d0cf15aece543576605f7deb0dd52f37b', deployedAt: '2025-12-01T07:02:28.425237Z' },
    { uid: 'vkUSD8cjxiTEdqHpaAs4eX', contentHash: '9be8c9091f9337842fddb769246ebf1ecac70632', deployedAt: '2025-11-30T22:36:10.096424Z' },
    { uid: 'vmQjaRd6aSWWgueMDs4hnX', contentHash: '6e4ad7d945431e09dd083f897e979385877595dc', deployedAt: '2025-11-30T19:31:06.587894Z' },
    { uid: 'v3unrXvpTh9m8ByfT6qQXJ', contentHash: 'e22872470ee1cef959bc064d43e3cfa317dfd461', deployedAt: '2025-11-30T01:47:50.940221Z' },
    { uid: 'vMERWj3jfJFKJAbHZeWmHg', contentHash: '90396e7443500094d0e3742b9f7f3a6243052c7e', deployedAt: '2025-11-29T23:48:31.013631Z' },
    { uid: 'vMcWC2M8DdNLmeiidrTK6f', contentHash: 'd329837e846f2b511160ff755952d14de886f1b7', deployedAt: '2022-01-17T15:05:21.143722Z' },
    { uid: 'visBTYunNdkfcnjt5yfe3K', contentHash: 'a39745fcab0b28dbddde485c8a80eef8668a390f', deployedAt: '2021-11-10T01:58:50.685665Z' },
    { uid: 'vVx8fes4wREzyvUF7h7rnu', contentHash: '5276c58bceac430c6afd913ad6ff85c991650ea2', deployedAt: '2021-11-05T03:44:10.548703Z' },
    { uid: 'vEL3Z2angtZTiFgEEbDvpM', contentHash: '314bd04f538b6c5eb5ed176667bd5fce16873bee', deployedAt: '2021-09-11T10:15:17.017018Z' },
  ] satisfies KoboSourceVersion[],
  selectedColumns: [
    'Num_ro_d_ordre',
    'TYPE_DE_VISITE/POSITION_CLIENT',
    'TYPE_DE_VISITE/TYPE_DE_VISITE_001',
    'TYPE_DE_VISITE/NOMBRE_DE_PIECE_INSTALLEE',
    'TYPE_DE_VISITE/PRENOM',
    'TYPE_DE_VISITE/NOM',
    'TYPE_DE_VISITE/ADRESSE_ou_NUMERO_D_ORDRE',
    'TYPE_DE_VISITE/TELEPHONE',
    'group_hx7ae46/PROTECTION_CONTRE_LES_CONTACT_001',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE_',
    'group_hx7ae46/CALIBRE_DISJONCTEUR_GENERAL',
    'group_hx7ae46/PROTECTION_CONTRE_LES_CONTACT_',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__001',
    'group_hx7ae46/ENSEMBLE_DE_L_INSTALLATION_PRO',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__002',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__003',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER_001',
    'group_hx7ae46/VALEUR_DE_LA_RESISTANCE_DE_TERRE',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER_',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__004',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER_002',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__005',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER__001',
    'group_hx7ae46/OBSERVATION_SEPARATION_DES_CIR',
    'group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER__002',
    'group_hx7ae46/_OBJET_DE_NON_CONFORMITE__006',
    'POSE_DU_BRANCHEMENT/Observations_sur_position_',
    'POSE_DU_BRANCHEMENT/POSE_DU_BRANCHEMENT_header',
    'POSE_DU_BRANCHEMENT/minimum_4m_ou_6_m_en_fonction_',
    'POSE_DU_BRANCHEMENT/Observations',
    'POSE_DU_BRANCHEMENT/maximum_1_6m_au_milieu_du_hubl',
    'POSE_DU_BRANCHEMENT/Observations_001',
    'POSE_DU_BRANCHEMENT/Pr_sence_de_coupe_ci_uit_avec_Fusible_25A',
    'POSE_DU_BRANCHEMENT/Observations_002',
    'POSE_DU_BRANCHEMENT/pvc_et_couses_entre_la_descent',
    'POSE_DU_BRANCHEMENT/Observations_003',
    'POSE_DU_BRANCHEMENT/MISE_EN_UVRE_POSE_ONS_ET_RACCORDEMENTS',
    'POSE_DU_BRANCHEMENT/Observations_004',
    'Nom_du_repr_sentant_Cogelec_',
    'ETAT_DE_L_INSTALLATION',
    'group_hx7ae46/VALEUR_DE_LA_RESISTANCE_DE_TER',
    'ETAT_BRANCHEMENT',
    'POSE_DU_BRANCHEMENT/Position_du_branchement',
    'POSE_DU_BRANCHEMENT/_1_photo_anomalie_si_possible',
    'start',
    'meta/audit',
    '__SubmissionLinks',
    'Numero_ordre',
    'TYPE_DE_VISITE/nom_key',
    'TYPE_DE_VISITE/region_key',
    'group_wu8kv54/Situation_du_M_nage',
    'etape_macon/validation_macon_final',
    'etape_reseau/validation_reseau_final',
    'etape_interieur/validation_interieur_final',
    'etape_controleur/validation_controleur_final',
    'notes_generales',
    'username',
    'TYPE_DE_VISITE/role',
    'group_wu8kv54/group_sy9vj14/Photo',
  ],
  exportFieldCount: 85,
  exportSettingsModifiedAt: '2026-04-11T02:15:46.256550Z',
  reportQuestions: ['ETAT_BRANCHEMENT', 'ETAT_DE_L_INSTALLATION'],
  sourceDownloads: [
    { format: 'xls', url: 'https://kf.kobotoolbox.org/api/v2/assets/aEYZwPujJiFBTNb6mxMGCB.xls' },
    { format: 'xml', url: 'https://kf.kobotoolbox.org/api/v2/assets/aEYZwPujJiFBTNb6mxMGCB.xml' },
  ],
  dataDownloadFormats: ['xls', 'csv', 'zip', 'kml', 'xlsx'],
} as const;

export const KOBO_SOURCE_RUBRICS: KoboSourceRubric[] = [
  { title: 'Menage', subtitle: 'Identification, contact, GPS et choix du role', fields: 8 },
  { title: 'Preparateur kit', subtitle: 'Preparation des kits et quantites', fields: 2, role: '__pr_parateur' },
  { title: 'Livreur', subtitle: 'Eligibilite menage, remise materiel, longueurs et photo', fields: 12, role: 'livreur' },
  { title: 'Macon', subtitle: 'Kit disponible, type de mur, problemes et validation', fields: 6, role: 'macon' },
  { title: 'Reseau', subtitle: 'Mur conforme, branchement, problemes et validation', fields: 6, role: 'reseau' },
  { title: 'Installation interieure', subtitle: 'Branchement conforme, installation et validation', fields: 6, role: 'interieur' },
  { title: 'Controle branchement', subtitle: 'Controle exterieur, position, hauteur, coffret et coupe-circuit', fields: 14, role: 'controleur' },
  { title: 'Controle installation interieure', subtitle: 'DDR, protections, circuits, terre et validation finale', fields: 25, role: 'controleur' },
  { title: 'Notes generales', subtitle: 'Observation obligatoire rattachee au formulaire actif', fields: 1 },
];

export const formatKoboSourceColumnLabel = (column: string) => {
  const leaf = column.split('/').pop() || column;
  return leaf
    .replace(/^_+|_+$/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || column;
};
