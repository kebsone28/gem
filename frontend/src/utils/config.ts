export const KIT_COMPOSITION = [
    { id: 'coffret_compteur', category: 'Réseau Branchement', label: 'Coffret compteur', qty: 1, unit: 'u' },
    { id: 'potelet_galva', category: 'Réseau Branchement', label: 'Potelet Galva 4m (40×40 creux)', qty: 1, unit: 'u' },
    { id: 'tube_pvc_25_3m', category: 'Réseau Branchement', label: 'Tube PVC Ø25mm 3m', qty: 1, unit: 'u' },
    { id: 'bride_serrage', category: 'Réseau Branchement', label: 'Bride de serrage', qty: 1, unit: 'u' },
    { id: 'queue_cochon', category: 'Réseau Branchement', label: 'Queue de cochon', qty: 1, unit: 'u' },
    { id: 'coude_25', category: 'Réseau Branchement', label: 'Coude Ø25 sectionné', qty: 4, unit: 'u' },
    { id: 'cable_preassemble_16', category: 'Réseau Branchement', label: 'Câble préassemblé 2×16mm²', qty: 1, unit: 'u' },
    { id: 'connecteur_cpb_ct70', category: 'Réseau Branchement', label: 'Connecteurs CPB1/CT70', qty: 2, unit: 'u' },
    { id: 'pince_ancrage_25', category: 'Réseau Branchement', label: 'Pince d\'ancrage 25', qty: 1, unit: 'u' },
    { id: 'grillage_avert', category: 'Kit Principal (Intérieur)', label: 'Grillage avertisseur 30×50cm', qty: 1, unit: 'u' },
    { id: 'cable_rvfv_6_15m', category: 'Kit Principal (Intérieur)', label: 'Câble RVFV 2×6mm² (15m)', qty: 1, unit: 'roul.' },
    { id: 'coffret_modulaire', category: 'Kit Principal (Intérieur)', label: 'Coffret modulaire kit principal', qty: 1, unit: 'u' },
    { id: 'hublot', category: 'Kit Principal (Intérieur)', label: 'Hublot', qty: 1, unit: 'u' },
    { id: 'cable_3x15_4m', category: 'Kit Principal (Intérieur)', label: 'Câble 3×1,5mm² (4m)', qty: 1, unit: 'm' },
    { id: 'interrupteur_princ', category: 'Kit Principal (Intérieur)', label: 'Interrupteur simple allumage (principal)', qty: 2, unit: 'u' },
    { id: 'lampe_lbc_ip23', category: 'Kit Principal (Intérieur)', label: 'Lampe LBC + douille IP 23', qty: 1, unit: 'u' },
    { id: 'prise_princ', category: 'Kit Principal (Intérieur)', label: 'Prise électrique (principale)', qty: 1, unit: 'u' },
    { id: 'modulaire_c10', category: 'Kit Principal (Intérieur)', label: 'Modulaire C10', qty: 1, unit: 'u' },
    { id: 'modulaire_c20', category: 'Kit Principal (Intérieur)', label: 'Modulaire C20', qty: 1, unit: 'u' },
    { id: 'differentiel_25a', category: 'Kit Principal (Intérieur)', label: 'Différentiel 25A/30mA', qty: 1, unit: 'u' },
    { id: 'disjoncteur_5_15a', category: 'Kit Principal (Intérieur)', label: 'Disjoncteur de branchement 5/15A', qty: 1, unit: 'u' },
    { id: 'bornier_princ', category: 'Kit Principal (Intérieur)', label: 'Bornier alimentation + raccordement', qty: 1, unit: 'u' },
    { id: 'tube_annele', category: 'Mise à la Terre', label: 'Tube annelé (3m/10m)', qty: 1, unit: 'u' },
    { id: 'barrette_terre', category: 'Mise à la Terre', label: 'Barrette de terre', qty: 1, unit: 'u' },
    { id: 'fil_th_6mm_4m', category: 'Mise à la Terre', label: 'Fil TH vert/jaune 6mm² (4m)', qty: 1, unit: 'm' },
    { id: 'conducteur_cu_25', category: 'Mise à la Terre', label: 'Conducteur Cu nu Ø25mm² (3m/8m)', qty: 1, unit: 'u' },
    { id: 'piquet_terre', category: 'Mise à la Terre', label: 'Piquet de terre 1,5m cuivre', qty: 1, unit: 'u' },
    { id: 'lampe_lbc_sec', category: 'Kit Secondaire (Intérieur)', label: 'Lampe LBC + douille (secondaire)', qty: 1, unit: 'u' },
    { id: 'interrupteur_sec', category: 'Kit Secondaire (Intérieur)', label: 'Interrupteur simple allumage (secondaire)', qty: 1, unit: 'u' },
    { id: 'boite_derivation', category: 'Kit Secondaire (Intérieur)', label: 'Boite de dérivation 80×80mm', qty: 1, unit: 'u' },
    { id: 'prise_sec', category: 'Kit Secondaire (Intérieur)', label: 'Prise électrique (option)', qty: 1, unit: 'u' },
    { id: 'bornier_sec', category: 'Kit Secondaire (Intérieur)', label: 'Bornier alimentation + raccordement (sec)', qty: 1, unit: 'u' },
    { id: 'cable_arme_3x25_10m', category: 'Kit Secondaire (Intérieur)', label: 'Câble armé 3×12,5mm² (10m)', qty: 1, unit: 'm' },
];

export const KIT_CATEGORIES = [
    'Réseau Branchement',
    'Kit Principal (Intérieur)',
    'Mise à la Terre',
    'Kit Secondaire (Intérieur)',
];

export const CATEGORY_COLORS: Record<string, { bg: string, border: string, text: string, badge: string }> = {
    'Réseau Branchement': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
    'Kit Principal (Intérieur)': { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300' },
    'Mise à la Terre': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
    'Kit Secondaire (Intérieur)': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
};

export const GRAPPES_CONFIG = {
    "grappes": [
        {
            "id": "kaffrine_grappe_1",
            "nom": "Kaffrine – Grappe 1",
            "region": "Kaffrine",
            "numero": 1,
            "nb_menages": 722,
            "centroide_lat": 14.189357,
            "centroide_lon": -15.438856,
            "rayon_moyen_km": 3.5,
            "rayon_max_km": 7.05,
            "sous_grappes": []
        },
        {
            "id": "kaffrine_grappe_2",
            "nom": "Kaffrine – Grappe 2",
            "region": "Kaffrine",
            "numero": 2,
            "nb_menages": 617,
            "centroide_lat": 14.230624,
            "centroide_lon": -15.309393,
            "rayon_moyen_km": 4.38,
            "rayon_max_km": 8.97,
            "sous_grappes": []
        },
        {
            "id": "kaffrine_grappe_3",
            "nom": "Kaffrine – Grappe 3",
            "region": "Kaffrine",
            "numero": 3,
            "nb_menages": 562,
            "centroide_lat": 14.155395,
            "centroide_lon": -15.546118,
            "rayon_moyen_km": 5.16,
            "rayon_max_km": 6.51,
            "sous_grappes": []
        },
        {
            "id": "kaffrine_grappe_4",
            "nom": "Kaffrine – Grappe 4",
            "region": "Kaffrine",
            "numero": 4,
            "nb_menages": 283,
            "centroide_lat": 14.387435,
            "centroide_lon": -15.24757,
            "rayon_moyen_km": 6.03,
            "rayon_max_km": 48.85,
            "sous_grappes": []
        },
        {
            "id": "tambacounda_grappe_1",
            "nom": "Tambacounda – Grappe 1",
            "region": "Tambacounda",
            "numero": 1,
            "nb_menages": 733,
            "centroide_lat": 13.342713,
            "centroide_lon": -13.620338,
            "rayon_moyen_km": 4.85,
            "rayon_max_km": 8.42,
            "sous_grappes": []
        },
        {
            "id": "tambacounda_grappe_2",
            "nom": "Tambacounda – Grappe 2",
            "region": "Tambacounda",
            "numero": 2,
            "nb_menages": 618,
            "centroide_lat": 13.423247,
            "centroide_lon": -13.702384,
            "rayon_moyen_km": 4.79,
            "rayon_max_km": 8.21,
            "sous_grappes": []
        }
    ],
    "sous_grappes": [
        {
            "id": "KAF-G1-SG01",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 1,
            "nom": "Kaffrine – Grappe 1 – SG01",
            "code": "KAF-G1-SG01",
            "nb_menages": 219,
            "centroide_lat": 14.194082,
            "centroide_lon": -15.475078
        },
        {
            "id": "KAF-G1-SG02",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 2,
            "nom": "Kaffrine – Grappe 1 – SG02",
            "code": "KAF-G1-SG02",
            "nb_menages": 126,
            "centroide_lat": 14.199349,
            "centroide_lon": -15.405812
        },
        {
            "id": "KAF-G1-SG03",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 3,
            "nom": "Kaffrine – Grappe 1 – SG03",
            "code": "KAF-G1-SG03",
            "nb_menages": 99,
            "centroide_lat": 14.174934,
            "centroide_lon": -15.459871
        },
        {
            "id": "KAF-G1-SG04",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 4,
            "nom": "Kaffrine – Grappe 1 – SG04",
            "code": "KAF-G1-SG04",
            "nb_menages": 82,
            "centroide_lat": 14.186712,
            "centroide_lon": -15.436513
        },
        {
            "id": "KAF-G1-SG05",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 5,
            "nom": "Kaffrine – Grappe 1 – SG05",
            "code": "KAF-G1-SG05",
            "nb_menages": 74,
            "centroide_lat": 14.213473,
            "centroide_lon": -15.383837
        },
        {
            "id": "KAF-G1-SG06",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 6,
            "nom": "Kaffrine – Grappe 1 – SG06",
            "code": "KAF-G1-SG06",
            "nb_menages": 44,
            "centroide_lat": 14.166218,
            "centroide_lon": -15.416722
        },
        {
            "id": "KAF-G1-SG07",
            "grappe_id": "KAF-G1",
            "region": "Kaffrine",
            "grappe_numero": 1,
            "sous_grappe_numero": 7,
            "nom": "Kaffrine – Grappe 1 – SG07",
            "code": "KAF-G1-SG07",
            "nb_menages": 39,
            "centroide_lat": 14.198041,
            "centroide_lon": -15.438636
        }
    ]
};
