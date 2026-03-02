/**
 * kit-composition.js — Composition d'un kit type par ménage
 * Chaque entrée représente un article avec sa quantité par kit.
 * Source: cahier des charges PROQUELEC / LSE
 *
 * Usage: Pour N kits chargés, stock[item] = N × item.qty
 */

export const KIT_COMPOSITION = [
    // ─── Matériel réseau branchement ──────────────────────────────────────────
    { id: 'coffret_compteur', category: 'Réseau Branchement', label: 'Coffret compteur', qty: 1, unit: 'u' },
    { id: 'potelet_galva', category: 'Réseau Branchement', label: 'Potelet Galva 4m (40×40 creux)', qty: 1, unit: 'u' },
    { id: 'tube_pvc_25_3m', category: 'Réseau Branchement', label: 'Tube PVC Ø25mm 3m', qty: 1, unit: 'u' },
    { id: 'bride_serrage', category: 'Réseau Branchement', label: 'Bride de serrage', qty: 1, unit: 'u' },
    { id: 'queue_cochon', category: 'Réseau Branchement', label: 'Queue de cochon', qty: 1, unit: 'u' },
    { id: 'coude_25', category: 'Réseau Branchement', label: 'Coude Ø25 sectionné', qty: 4, unit: 'u' },
    { id: 'cable_preassemble_16', category: 'Réseau Branchement', label: 'Câble préassemblé 2×16mm²', qty: 1, unit: 'u' },
    { id: 'connecteur_cpb_ct70', category: 'Réseau Branchement', label: 'Connecteurs CPB1/CT70', qty: 2, unit: 'u' },
    { id: 'pince_ancrage_25', category: 'Réseau Branchement', label: 'Pince d\'ancrage 25', qty: 1, unit: 'u' },

    // ─── Matériel kit principal (installation intérieure) ─────────────────────
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

    // ─── Mise à la terre ──────────────────────────────────────────────────────
    { id: 'tube_annele', category: 'Mise à la Terre', label: 'Tube annelé (3m/10m)', qty: 1, unit: 'u' },
    { id: 'barrette_terre', category: 'Mise à la Terre', label: 'Barrette de terre', qty: 1, unit: 'u' },
    { id: 'fil_th_6mm_4m', category: 'Mise à la Terre', label: 'Fil TH vert/jaune 6mm² (4m)', qty: 1, unit: 'm' },
    { id: 'conducteur_cu_25', category: 'Mise à la Terre', label: 'Conducteur Cu nu Ø25mm² (3m/8m)', qty: 1, unit: 'u' },
    { id: 'piquet_terre', category: 'Mise à la Terre', label: 'Piquet de terre 1,5m cuivre', qty: 1, unit: 'u' },

    // ─── Matériel kit secondaire (installation intérieure) ───────────────────
    { id: 'lampe_lbc_sec', category: 'Kit Secondaire (Intérieur)', label: 'Lampe LBC + douille (secondaire)', qty: 1, unit: 'u' },
    { id: 'interrupteur_sec', category: 'Kit Secondaire (Intérieur)', label: 'Interrupteur simple allumage (secondaire)', qty: 1, unit: 'u' },
    { id: 'boite_derivation', category: 'Kit Secondaire (Intérieur)', label: 'Boite de dérivation 80×80mm', qty: 1, unit: 'u' },
    { id: 'prise_sec', category: 'Kit Secondaire (Intérieur)', label: 'Prise électrique (option)', qty: 1, unit: 'u' },
    { id: 'bornier_sec', category: 'Kit Secondaire (Intérieur)', label: 'Bornier alimentation + raccordement (sec)', qty: 1, unit: 'u' },
    { id: 'cable_arme_3x25_10m', category: 'Kit Secondaire (Intérieur)', label: 'Câble armé 3×2,5mm² (10m)', qty: 1, unit: 'm' },
];

// Catégories dans l'ordre d'affichage
export const KIT_CATEGORIES = [
    'Réseau Branchement',
    'Kit Principal (Intérieur)',
    'Mise à la Terre',
    'Kit Secondaire (Intérieur)',
];

export const CATEGORY_COLORS = {
    'Réseau Branchement': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
    'Kit Principal (Intérieur)': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-700' },
    'Mise à la Terre': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
    'Kit Secondaire (Intérieur)': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
};

if (typeof window !== 'undefined') {
    window.KIT_COMPOSITION = KIT_COMPOSITION;
    window.KIT_CATEGORIES = KIT_CATEGORIES;
    window.CATEGORY_COLORS = CATEGORY_COLORS;
}

if (typeof module !== 'undefined') {
    module.exports = { KIT_COMPOSITION, KIT_CATEGORIES, CATEGORY_COLORS };
}
