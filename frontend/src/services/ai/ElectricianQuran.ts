/**
 * SERVICE : ElectricianQuran (V.8.0 THEMATIC) 🛡️🕌🧠🧬🚀✨
 * Le Référentiel Technique & Cahier des Charges de PROQUELEC.
 * "Le Guide de l'Électricien" : Matériel, Géographie et Normes Kobo.
 */

export interface TechnicalDefinition {
    title: string;
    description: string;
    specs: string[];
    norm: string;
    keywords: string[];
    images?: { url: string; caption: string }[];
}

/** 🛠️ RÉFÉRENTIEL TECHNIQUE ORGANISÉ PAR THÈMES (PROQUELEC) */
export const ELECTRICIAN_GUIDE: Record<string, TechnicalDefinition> = {
    
    // 🏗️ THÈME 1 : PROJET MFR (TERRAIN & AUDIT)
    projet_mfr_eligibilite: {
        title: "Projet Ménages à Faible Revenu - Critères d'Éligibilité",
        description: "Règles strictes de sélection pour les ménages à faible revenu.",
        specs: ["Proximité avec le réseau Senelec", "Condition de revenu faible", "Propriétaire exclusif de la maison ou dépendance", "Construction en dur (ciment ou banco)", "Aucune installation électrique ou compteur pré-existant"],
        norm: "Guide Ménages Faible Revenu - Chap 1",
        keywords: ["37500", "faible revenu", "eligibilit", "critere", "selection", "condition"]
    },
    projet_mfr_interieur: {
        title: "Projet Ménages à Faible Revenu - Installation Intérieure",
        description: "Règles de pose pour les équipements intérieurs et l'esthétique.",
        specs: ["Coffret disjoncteur dans un couloir couvert (ou mur clos de pièce adossée)", "Interrupteurs strictement en zone couverte", "Configuration standard : 3 lampes et 1 prise", "Hublots étanches requis en extérieur", "Câbles armés enterrés (0.5m profondeur) sous grillage avertisseur rouge entre les pièces isolées"],
        norm: "Guide Ménages Faible Revenu - Chap 3",
        keywords: ["interieur", "lampe", "prise", "couloir", "interrupteur", "cable arme", "enterr", "grillage"],
        images: [
            { url: "/guide_images/schema_interieur.jpg", caption: "Schéma de principe de l'installation intérieure" }
        ]
    },
    projet_mfr_branchement: {
        title: "Projet Ménages à Faible Revenu - Branchement Senelec",
        description: "Prescriptions de sécurité pour les compteurs et raccordements Senelec.",
        specs: ["Coffret compteur fixé STRICTEMENT en limite de propriété (jamais à l'intérieur)", "Câble de branchement : ne jamais surplomber d'autres maisons", "Hublot du coffret à 1.60m du sol", "Hauteur de câble à minima de 4m (ruelles) ou 6m (traversée routière)", "Protection mécanique par Tube PVC obligatoire du potelet au coffret"],
        norm: "Guide Ménages Faible Revenu - Chap 4",
        keywords: ["senelec", "limite", "propriete", "potelet", "pvc", "tube", "hauteur", "hublot", " rural", " urbain"],
        images: [
            { url: "/guide_images/schema_branchement_urbain.jpg", caption: "Branchement Milieu Urbain : Arrêt à la 2ème position" },
            { url: "/guide_images/schema_branchement_rural.png", caption: "Branchement Milieu Rural : Arrêt à la 3ème position" },
            { url: "/guide_images/exemple_coffret_compteur.png", caption: "Exemple de pose conforme (Concession multiple)" },
            { url: "/guide_images/protection_mecanique_pvc.png", caption: "Détail de protection PVC" },
            { url: "/guide_images/protection_pvc_type_1.png", caption: "Protection mécanique Type 1" },
            { url: "/guide_images/exemple_pose_limite_propriete.jpg", caption: "Pose en limite de propriété (Milieu Rural)" }
        ]
    },
    projet_mfr_anomalies: {
        title: "Projet MFR - Anomalies & Interdits",
        description: "Liste des défauts techniques majeurs entraînant un rejet d'installation géographique ou sécuritaire.",
        specs: ["Fils conducteurs visibles après pose (utilisation de pince interdite, utiliser un cutteur)", "Câbles placés en plein air (doivent être dans la chambre/couloir)", "Barrette de terre à l'extérieur (interdit)", "Utilisation de poteaux en bois pourris pour le branchement"],
        norm: "Guide Ménages Faible Revenu - Chap 5",
        keywords: ["anomalie", "eviter", "interdit", "mauvais", "erreur", "defaut", "cutteur", "pince", "visible", "bois pourri"],
        images: [
            { url: "/guide_images/anomalie_conducteur_visible.png", caption: "❌ À ÉVITER : Conducteurs visibles" },
            { url: "/guide_images/anomalie_decoupe_pince.png", caption: "❌ À ÉVITER : Mauvaise découpe à la pince" },
            { url: "/guide_images/bonne_pratique_decoupe_cable.png", caption: "✅ BONNE PRATIQUE : Découpage au cutteur" },
            { url: "/guide_images/anomalie_cables_exterieurs.png", caption: "❌ À ÉVITER : Câbles en plein air" },
            { url: "/guide_images/anomalie_barette_terre.png", caption: "❌ À ÉVITER : Barrette de terre à l'extérieur" },
            { url: "/guide_images/exemple_barette_terre.png", caption: "✅ Exemple de barrette de terre interne" },
            { url: "/guide_images/anomalie_poteau_bois_pourri.png", caption: "❌ À ÉVITER : Poteau bois pourri" },
            { url: "/guide_images/materiel_cable_arme_grillage.png", caption: "Matériel Conforme : Câble armé et Grillage avertisseur" }
        ]
    },

    // 📜 THÈME 2 : NORME NS 01-001 (LES FONDEMENTS)
    norme_ns_01_001_domaine: {
        title: "Norme NS 01-001 - Domaine d'application",
        description: "Frontières légales d'application de la norme sénégalaise pour les installations BT.",
        specs: ["Tension autorisée : ≤ 1000 V (AC) / ≤ 1500 V (DC)", "Cible : Habitations, ERP, commerces, chantiers, marinas", "Exclusions : Locaux médicaux, traction, mines, HT"],
        norm: "NS 01-001 - Chapitre 1",
        keywords: ["ns 01-001", "domaine", "application", "tension", "bt", "1000", "erp"]
    },
    ns01_terms: {
        title: "Glossaire Technique NS 01-001",
        norm: "NS 01-001 (Règles installations BT)",
        keywords: ["terre", "prise de terre", "definitions", "termes", "glossaire", "masse", "partie active", "contact direct", "contact indirect", "equipotentielle", "ddr", "conducteur de protection", "pe", "section"],
        description: "Ensemble des définitions normatives essentielles pour la conformité et la sécurité des installations électriques au Sénégal.",
        specs: [
            "PARTIE ACTIVE : Conducteur ou pièce conductrice sous tension en service normal, y compris le neutre.",
            "MASSE : Partie conductrice d'un matériel susceptible d'être touchée, normalement isolée, mais pouvant être mise sous tension par défaut.",
            "CONTACT DIRECT : Contact avec des parties actives sous tension.",
            "CONTACT INDIRECT : Contact avec des masses accidentellement sous tension par défaut d'isolement.",
            "LIAISON ÉQUIPOTENTIELLE : Connexion reliant masses et éléments conducteurs pour annuler les différences de potentiel.",
            "DDR (Dispositif Différentiel) : Appareil de coupure automatique en cas de courant de fuite à la terre (Protection des personnes).",
            "PRISE DE TERRE : Métal enfoui assurant le contact électrique permanent avec la terre.",
            "CONDUCTEUR PE : Conducteur de protection reliant les masses à la terre (impérativement Vert/Jaune).",
            "SECTION NOMINALE : Surface conductrice du câble (ex: 1.5mm², 2.5mm²) dimensionnée selon l'intensité."
        ]
    },
    norme_ns_01_001_protection: {
        title: "Norme NS 01-001 - Principes fondamentaux de Protection",
        description: "Règles absolues pour la sécurité des personnes, animaux et biens.",
        specs: ["Contacts Directs : Protection contre le contact avec les parties actives", "Contacts Indirects : Coupure automatique obligatoire en cas de défaut sur masse (ex: DDR)", "Surintensités : Protection stricte contre surcharges et courts-circuits", "Surtensions : Protection parafoudre contre actes atmosphériques"],
        norm: "NS 01-001 - Chapitre 3",
        keywords: ["protection", "choc electrique", "direct", "indirect", "surintensit", "surtension", "court-circuit", "incendie", "terre"]
    },
    ns01_characteristics: {
        title: "Détermination des Caractéristiques Générales (NS 01-001)",
        norm: "NS 01-001 - Chapitre 3",
        keywords: ["caracteristiques", "puissance", "slt", "regime neutre", "simultaneite", "foisonnement", "circuits", "maintenance"],
        description: "Règles pour définir la structure technique, la puissance et le mode de protection d'une installation avant sa réalisation.",
        specs: [
            "PUISSANCE INSTALLÉE : Évaluation de la puissance totale et application des coefficients de foisonnement (simultanéité).",
            "SCHÉMA DE LIAISON À LA TERRE (SLT) : Au Sénégal, le régime TT est la norme standard (Neutre à la terre côté réseau, masses à la terre côté client).",
            "REPARTITION DES CIRCUITS : Division obligatoire pour limiter les coupures (ex: minimum 2 circuits d'éclairage pour un logement).",
            "SÉPARATION DES SERVICES : Circuits spécialisés obligatoires pour Climatisation, Four, Lave-linge, Chauffe-eau.",
            "MAINTENANCE : Les organes de coupure et tableaux doivent rester accessibles et comporter un repérage clair (étiquetage).",
            "ÉVOLUTIVITÉ : Prévoir une réserve de 20% d'emplacements libres sur le tableau électrique."
        ]
    },

    // 🛡️ THÈME 3 : SÉCURITÉ EXPERTE (PROTECTION & MATÉRIEL)
    ns01_safety: {
        title: "Protection pour Assurer la Sécurité (NS 01-001)",
        norm: "NS 01-001 - Tome Protection",
        keywords: ["securite", "protection", "surintensite", "surcharge", "court-circuit", "ip", "indice", "selectivite", "foudre", "parafoudre"],
        description: "Directives fondamentales pour la protection des biens et des personnes contre les risques thermiques, électriques et atmosphériques.",
        specs: [
            "PROTECTION SURINTENSITÉ : Utilisation de disjoncteurs magnéto-thermiques ou fusibles calibrés selon la section du câble (ex: 16A pour 1.5mm², 20A pour 2.5mm²).",
            "PROTECTION CONTACTS : Isolation des parties actives et utilisation d'enveloppes (IP2X mini) pour empêcher tout contact direct.",
            "INDICE DE PROTECTION (IP) : IP44 minimum pour les luminaires extérieurs et locaux humides. IP20 pour l'intérieur.",
            "SÉLECTIVITÉ : Coordination des dispositifs pour que seul l'organe de protection le plus proche du défaut ne déclenche.",
            "PROTECTION THERMIQUE : Éviter les échauffements par un dimensionnement correct et une ventilation des armoires.",
            "PROTECTION ATMOSPHÉRIQUE : Installation de parafoudres sur l'arrivée principale si la zone est classée 'foudroyée' (Keraunique)."
        ]
    },
    compteur: {
        title: "Compteur Électrique (Monophasé/Triphasé)",
        description: "Organe de mesure sacré de la consommation. Doit être scellé et inaccessible sans autorisation.",
        specs: ["Classe de précision 1.0", "Étanchéité IP54", "Affichage LCD rétroéclairé"],
        norm: "NF EN 50470-1",
        keywords: ["compteur", "monophase", "triphase", "mesure", "consommation"]
    },
    disjoncteur: {
        title: "Disjoncteur Différentiel",
        description: "Garde du corps de l'installation. Coupe le courant en cas de défaut pour protéger les vies.",
        specs: ["Sensibilité 30mA", "Pouvoir de coupure 6kA", "Réglage de calibre"],
        norm: "NF C 15-100",
        keywords: ["disjoncteur", "differentiel", "coupure", "courant"]
    },

    // 🏘️ THÈME 4 : TYPOLOGIE DE BÂTIMENT (IEI & HABITAT)
    ns01_iei_domestic: {
        title: "Guide des Installations Électriques Intérieures (IEI) Domestiques",
        norm: "NS 01-011 / NS 01-001 (Habitat)",
        keywords: ["domestique", "habitat", "logement", "salle de bain", "volumes", "gtl", "points", "specialise", "cossuel", "visa"],
        description: "Règles spécifiques pour la mise en conformité des branchements et circuits intérieurs des ménages (Projet MFR).",
        specs: [
            "DDR 30mA : Protection différentielle haute sensibilité obligatoire sur TOUS les circuits de l'habitation.",
            "GTL (Gaine Technique Logement) : Emplacement regroupant le tableau et les arrivées. Largeur min 600mm pour courant fort/faible.",
            "SALLE D'EAU : Respect strict des volumes (0, 1, 2). Aucune prise à moins de 60cm de la douche/baignoire (Volume 2).",
            "DÉNOMBREMENT : Max 8 points lumineux par circuit (1.5mm²) | Max 12 prises par circuit (2.5mm²).",
            "CIRCUITS SPÉCIALISÉS : Impératif pour Lave-linge (2.5mm²-20A), Four (2.5mm²-20A) et Plaque de cuisson (6mm²-32A).",
            "LIAISON ÉQUIPOTENTIELLE : Liaison de toutes les canalisations métalliques (eau, gaz) à la terre du logement.",
            "COSSUEL : Un schéma unifilaire à jour est requis pour obtenir le visa de conformité."
        ]
    },
    ns01_erp_ert: {
        title: "Guide des Installations Intérieures ERP (Public) et ERT (Travailleurs)",
        norm: "SN 01 001 / Réglementation ERP-ERT",
        keywords: ["erp", "ert", "public", "travailleurs", "incendie", "baes", "evacuation", "secours", "alarme", "registre"],
        description: "Exigences strictes pour les bâtiments recevant du public ou du personnel, avec focus sur la sécurité incendie et l'évacuation.",
        specs: [
            "ÉCLAIRAGE DE SÉCURITÉ (BAES) : Obligatoire pour l'évacuation. Doit fonctionner min 1h en cas de coupure secteur.",
            "CIRCUITS DE SÉCURITÉ (CR1) : Utilisation de câbles résistant au feu pour l'alarme, le désenfumage et l'éclairage de sécurité.",
            "COUPURE D'URGENCE : Dispositif accessible à l'entrée du bâtiment permettant de couper toute l'installation par le personnel/pompiers.",
            "SOURCE DE SECOURS : Obligation d'une source autonome (Batteries ou Groupe) si l'établissement est de catégorie élevée.",
            "PRÉVENTION INCENDIE : Protection par DDR 300mA ou 500mA sur l'arrivée générale pour limiter les risques thermiques.",
            "REGISTRE DE SÉCURITÉ : Tenue obligatoire d'un carnet de maintenance et des rapports de vérification (COSSUEL/Bureaux de contrôle).",
            "ÉTABLISSEMENTS DE TRAVAIL (ERT) : Respect de l'ergonomie (éclairage min 200/500 lux selon tâche) et accessibilité des prises."
        ]
    },

    // ⚡ THÈME 5 : INFRASTRUCTURE & RÉSEAU
    branchement: {
        title: "Branchement Client (Audit Kobo)",
        description: "Point de connexion physique entre le réseau public et l'installation privée.",
        specs: ["Câble torsadé alu/cuivre", "Fixation murale sécurisée", "Audit photo obligatoire"],
        norm: "Spec PROQUELEC v2.1",
        keywords: ["branchement", "raccordement", "connexion senelec", "cable"]
    },
    transformateur: {
        title: "Poste de Transformation",
        description: "Cœur battant du quartier, abaissant la tension pour alimenter les foyers.",
        specs: ["Refroidissement huile/sec", "Protection MT/BT", "Mise à la terre certifiée"],
        norm: "IEEE C57.12.00",
        keywords: ["transformateur", "poste", "tension"]
    }
};

/** 🗺️ RÉFÉRENTIEL GÉOGRAPHIQUE PROQUELEC (SÉNÉGAL) */
export const GEOGRAPHY_REFERENCE = {
    regions: ["Dakar", "Saint-Louis", "Thiès", "Matam", "Louga", "Diourbel", "Fatick", "Kaolack", "Kaffrine", "Ziguinchor", "Sédhiou", "Kolda", "Kedougou", "Tambacounda"],
    priority_zones: ["Podor", "Dagana", "Pikine", "Guediawaye", "Mbour", "Tivaouane"],
    mapping: "Centralisé via Kobo Engine & ArcGIS Integration"
};

/** 📋 NORMES DE COLLECTE (CAHIER DES CHARGES KOBO) */
export const KOBO_STANDARDS = {
    household_audit: "Chaque ménage doit avoir 3 photos (Façade, Compteur, Signature).",
    gps_precision: "Marge d'erreur maximale tolérée : 5 mètres.",
    sync_rule: "Données transmises au Cloud dès détection de connexion 4G/Wifi."
};

/** 🧠 MOTEUR DE RECHERCHE TECHNIQUE INTELLIGENT (V9) */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
}

/** 🔍 MATCH INTELLIGENT V3.0 — Scoring multi-facteurs */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

function matchDefinition(query: string): TechnicalDefinition | null {
    const q = normalize(query);
    const queryWords = q.split(/\s+/).filter(w => w.length >= 3);

    let bestMatch: TechnicalDefinition | null = null;
    let bestScore = 0;

    Object.values(ELECTRICIAN_GUIDE).forEach(def => {
        let score = 0;
        const titleNorm = normalize(def.title);
        const descNorm = normalize(def.description);

        if (q.includes(titleNorm) || titleNorm.includes(q)) score += 4;
        else if (queryWords.some(w => titleNorm.includes(w) && w.length > 4)) score += 2;

        if (queryWords.some(w => descNorm.includes(w) && w.length > 5)) score += 2;

        def.keywords.forEach(keyword => {
            const kn = normalize(keyword);
            if (q.includes(kn)) {
                score += kn.length > 5 ? 3 : 2;
            } else {
                for (const word of queryWords) {
                    if (word.length >= 5 && kn.length >= 5 && Math.abs(word.length - kn.length) <= 2) {
                        const dist = levenshtein(word, kn);
                        if (dist <= 1) { score += 2; break; }
                        if (dist <= 2) { score += 1; break; }
                    }
                }
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = def;
        }
    });

    return bestScore >= 3 ? bestMatch : null;
}

function formatTechnicalResponse(def: TechnicalDefinition): string {
    return `
🕌 **${def.title}**

📖 ${def.description}

🛠️ **Règles essentielles :**
${def.specs.map(s => "• " + s).join("\n")}

📏 **Norme :** ${def.norm}

⚡ **Conseil GEM-MINT :**
Respectez strictement ces règles pour garantir la sécurité des ménages et la conformité COSSUEL.

Al-Hamdulillah 🤲
`;
}

export function getTechnicalAnswer(query: string): { message: string, images?: {url:string, caption:string}[] } | null {
    const match = matchDefinition(query);
    if (!match) return null;

    return {
        message: formatTechnicalResponse(match),
        images: match.images
    };
}
