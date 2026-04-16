import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  HardHat,
  Zap,
  Hammer,
  Package,
  Edit3,
  Save,
  Truck,
  Box as BoxIcon,
  Glasses,
  Home,
  History,
  CornerUpLeft,
  Network,
  ShieldCheck,
  Shield,
  Scale,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { useTeams } from '../hooks/useTeams';
import { exportCahiersToWord } from '@utils/word_engine';
import * as safeStorage from '@utils/safeStorage';
import type { CahierTask, TaskLibrary, CahierVersion } from '@utils/types';
import './Cahier.css';

// Import centralized design system
import { PageContainer, PageHeader, ContentArea, ActionBar } from '@components';
import Skeleton, { TableRowSkeleton, CardSkeleton } from '@components/common/Skeleton';

const COLOR_MAPS: Record<string, { bg: string; text: string; border: string; bgSoft: string }> = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    bgSoft: 'bg-blue-500/20',
  },
  orange: {
    bg: 'bg-orange-500',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    bgSoft: 'bg-orange-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bgSoft: 'bg-emerald-500/10',
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    bgSoft: 'bg-amber-500/20',
  },
  indigo: {
    bg: 'bg-indigo-500',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    bgSoft: 'bg-indigo-500/20',
  },
  pink: {
    bg: 'bg-pink-500',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    bgSoft: 'bg-pink-500/20',
  },
};

const GENERAL_CLAUSES = [
  'ART 0.1 - PIÈCES CONTRACTUELLES : Le présent cahier des charges, les plans types, les bordereaux quantitatifs et estimatifs (BQE), ainsi que les normes (NS 01-001, doctrine Senelec) constituent les pièces contractuelles opposables au Titulaire.',
  "ART 0.2 - ORDRE DE PRIORITÉ : En cas de contradiction entre les pièces, l'ordre de priorité décroissant est le suivant : 1. Le présent Cahier des Charges ; 2. Les plans techniques validés ; 3. Les normes techniques nationales et internationales.",
  'ART 0.3 - TRAÇABILITÉ NUMÉRIQUE & PREUVE : Toutes les opérations techniques et administratives sont impérativement tracées dans le système GEM-PROQUELEC. Les horodatages et données numériques issus du système font foi entre les parties en cas de litige.',
  "ART 0.4 - OBLIGATION DE RÉSULTAT GLOBALE : Le Titulaire est tenu à une obligation de résultat. Il assume la pleine responsabilité de la conformité finale des ouvrages aux règles de l'art.",
  'ART 6.1 - OBLIGATION DE RÉSULTAT : Le Titulaire est tenu de livrer un ouvrage entièrement fonctionnel, conforme aux normes en vigueur et exempt de défaut.',
  'ART 6.3 - TRAÇABILITÉ NUMÉRIQUE : Toutes les opérations sont enregistrées dans le système GEM-PROQUELEC et constituent une preuve contractuelle opposable.',
  'ART 6.4 - NON-CONFORMITÉ : Toute non-conformité détectée entraîne une obligation de reprise immédiate sans compensation.',
  'ART 6.8 - AUDIT DE CONFORMITÉ : Toute installation est soumise à un audit rigoureux par le contrôleur interne PROQUELEC. Les relevés numériques et photos géolocalisées saisis dans GEM font foi pour la validation finale.',
  'ART 6.9 - LIQUIDATION DES PAIEMENTS : Le règlement est strictement subordonné à l’obtention d’un score de conformité de 100% (zéro défaut) validé dans le système GEM-PROQUELEC.',
  'ART 7.1 - MODÈLE PROQUELEC INCLUSIF : Le Maître d’œuvre privilégie un mécanisme de paiement basé sur la performance et la validation des ouvrages via le système GEM-PROQUELEC, en substitution partielle des exigences de cautionnement classiques.',
  "ART 7.2 - TRÉSORERIE AGILE : Afin de soutenir la rotation de cash des PME, les paiements sont déclenchés de manière hebdomadaire sur la base des ménages validés 'Conformes' dans le système.",
  'ART 7.3 - CAUTIONNEMENT FLEXIBLE : Les taux de retenue sont limités à 5% et les cautions d’assurance (SONAM/ASKIA) sont acceptées en lieu et place des cautions bancaires.',
  "ART 7.4 - GARANTIE PAR PERFORMANCE : La rigueur du contrôle digital (Photos, GPS, Audit) constitue la garantie technique première de l'ouvrage.",
];

const LEGAL_COMMON = [
  'ART 6.1 - OBLIGATION DE RÉSULTAT : Le Titulaire est tenu de livrer un ouvrage fonctionnel et conforme.',
  'ART 6.3 - TRAÇABILITÉ NUMÉRIQUE : Preuve contractuelle basée sur les enregistrements GEM-PROQUELEC.',
  'ART 6.4 - NON-CONFORMITÉ : Obligation de reprise immédiate sans compensation.',
  'ART 6.8 - AUDIT DE CONFORMITÉ : Validation basée sur les relevés terrain du contrôleur interne PROQUELEC.',
  'ART 6.9 - LIQUIDATION DES PAIEMENTS : Tout règlement est strictement conditionné à l’obtention d’un score de conformité (zéro défaut) validé dans le système GEM-PROQUELEC.',
];

/**
 * Composant de section pour le Cahier des Charges
 */
const CahierSection: React.FC<{
  title: string;
  color: string;
  children: React.ReactNode;
}> = ({ title, color, children }) => (
  <div className="mb-10">
    <div className="flex items-center space-x-2 mb-6">
      <div 
        className="w-1.5 h-6 rounded-full shadow-lg bg-[var(--section-color)]" 
        // eslint-disable-next-line react/no-unknown-property
        style={{ '--section-color': color } as React.CSSProperties} 
      />
      <h4 className="font-black text-white uppercase tracking-[0.2em] text-xs md:text-sm">
        {title}
      </h4>
    </div>
    {children}
  </div>
);

const DEFAULT_TASK_LIBRARY: TaskLibrary = {
  Électricien: {
    color: 'blue',
    icon: Zap,
    image: '/assets/images/installation-terre.png',
    defaultCadence: 'Cadence : 3-5 Foyers / Jour',
    introduction:
      'ARTICLE 1 - OBJET ET NORMES : Le présent lot couvre l’installation électrique intérieure complète des ménages éligibles, incluant le Kit Principal & Secondaire, la pose du disjoncteur de branchement, et la réalisation des tranchées, le tout conforme aux normes NFC 15-100, NS 01-001, et à la doctrine Senelec. Le Titulaire garantit la conformité de l’installation aux règles de l’art et aux exigences du présent Cahier des Charges, sous peine de rejet et de pénalités.',
    missions: [
      'ART 1.1 - DIVISIONNAIRE PRINCIPAL : Pose d’un disjoncteur de branchement 5/15A, certifié et scellé, assurant la protection et le sectionnement de l’installation intérieure. Le disjoncteur doit être conforme à la norme NFC 15-100 et porter le marquage CE.',
      'ART 1.2 - TABLEAU MODULAIRE : Montage d’un coffret modulaire équipé d’un différentiel 25A/30mA et de modulaires C10/C20 certifiés, avec étiquetage clair des circuits. Le tableau doit être fixé à 1,50 m du sol et protégé contre les intempéries.',
      'ART 1.3 - MISE À LA TERRE : Réalisation obligatoire d’un dispositif de terre conforme à la NS 01-001, incluant un piquet en acier cuivré de 1,5 m, une barrette de coupure accessible, et un conducteur en cuivre nu Ø25 mm2. La résistance de terre mesurée doit être < 1500 Ohms pour un dispositif différentiel de 30mA. Toute valeur supérieure entraîne une reprise immédiate aux frais du Titulaire.',
      'ART 1.4 - GÉNIE CIVIL LÉGER : Réalisation des tranchées pour le passage des câbles (profondeur minimale 50 cm, largeur 30 cm), avec enfouissement sécurisé de la prise de terre et protection mécanique des câbles. Les tranchées doivent être rebouchées avec du sable compacté et signalées par un ruban avertisseur.',
      'ART 1.5 - REPORTING JOURNALIER : Le Chef d’équipe est responsable de la mise à jour quotidienne, avant 18h00, du formulaire Kobo intégré à GEM-PROQUELEC, incluant : état d’avancement (en %), photographies géolocalisées des ouvrages, liste des matériaux utilisés, et incidents éventuels. Toute omission ou retard entraîne une pénalité de 2% du montant journalier du lot.',
    ],
    materials: [
      '- Matériel fourni par le Client (Kits complets conformes aux normes et cahier de charge)',
      '- Disjoncteur de branchement 5/15A, certifié et scellé',
      "- Coffret modulaire équipé d'un Disjoncteur de branchement 5/15A, d'un différentiel 25A/30mA et de modulaires C10/C20",
      '- Piquet de terre en acier cuivré (1,5 m) et câble Cu nu Ø25 mm2',
      '- Lampes LED/LBC IP23 et accessoires (certifiés et conformes aux normes en vigueur).',
    ],
    hse: [
      '**HSE 1.1 - CONSIGNATION ÉLECTRIQUE** : Avant toute intervention, vérifier l\'absence de tension avec un VAT conforme à la norme NFC 18-510, consigner l\'installation par sectionnement visible et verrouillable, et apposer une signalisation "Ne pas réarmer - Travaux en cours". Le non-respect de cette procédure est sanctionné par un arrêt immédiat des travaux et une pénalité de 10% du montant journalier du lot.',
      '**HSE 1.2 - ÉQUIPEMENTS DE PROTECTION INDIVIDUELLE (EPI)** : Port obligatoire des EPI suivants : gants isolants classe 00 (norme EN 60903), chaussures de sécurité (norme EN ISO 20345), casque avec jugulaire, et vêtements anti-arc (norme EN 61482-2). Leur absence ou leur mauvais état entraîne une sanction immédiate (arrêt du chantier) et une pénalité de 5% du montant journalier du lot.',
      "**HSE 1.3 - TRAVAIL EN HAUTEUR** : Pour les interventions à plus de 1,80 m, utilisation obligatoire d'un harnais de sécurité (norme EN 361) fixé à un point d'ancrage certifié. Le non-respect expose à une pénalité de 20% du montant journalier du lot et à des poursuites pénales en cas d'accident.",
      "**HSE 1.4 - SIGNALISATION DES ZONES DE TRAVAUX** : Balisage clair des zones d'intervention en milieu habité (cônes, rubans, panneaux \"Danger Électricité\"). L'absence de signalisation est passible d'une pénalité de 3% du montant journalier du lot.",
      "**HSE 1.5 - PREMIERS SECOURS** : Chaque équipe doit disposer d'une trousse de secours conforme à la norme NF EN 12870 et d'un défibrillateur automatisé externe (DAE) sur les chantiers de plus de 5 personnes. Leur absence est sanctionnée par une pénalité de 7% du montant journalier du lot.",
    ],
    subcontracting: [
      "ART 4.1 - RESPONSABILITÉ : Le Titulaire reste pleinement responsable de la conformité des installations, même en cas de sous-traitance. Il doit obtenir l'accord écrit du Maître d'Ouvrage pour toute sous-traitance et vérifier que le sous-traitant dispose des certifications requises (qualification Senelec, assurance RC Pro).",
    ],
    finances: [
      'ART 5.1 - VALIDATION PAR RÉCEPTION FINALE : La réception finale, prononcée par PROQUELEC après vérification de la conformité aux exigences contractuelles, déclenche l\'exigibilité du paiement. Elle est matérialisée par le statut "Réceptionné conforme" dans GEM-PROQUELEC et la signature d\'un PVR.',
      "ART 5.2 - OBLIGATION DE SAISIE KOBO : Le Titulaire a l'obligation contractuelle de renseigner quotidiennement le formulaire Kobo avant 18h00. Le Chef de Projet assure la liquidation des règlements hebdomadaires sur la base des données validées dans GEM-PROQUELEC.",
      "ART 5.3 - CAUTIONNEMENT FLEXIBLE : La retenue de garantie est limitée à 5-10% du montant des prestations. Le Titulaire peut la substituer par une caution d'assurance délivrée par une compagnie agréée (SONAM, ASKIA), sous réserve de transmission de l’attestation correspondante.",
    ],
    legal: [
      ...LEGAL_COMMON,
      'ART E.1 - RESPONSABILITÉ TECHNIQUE : L’électricien est responsable de la conformité totale de l’installation intérieure aux normes NFC 15-100 et NS 01-001. Toute non-conformité engage sa responsabilité civile et pénale.',
      'ART E.2 - RISQUE ÉLECTRIQUE : Toute installation non sécurisée engage sa responsabilité en cas d’incendie, d’électrocution ou de dommage matériel, conformément au Code pénal sénégalais.',
      'ART E.3 - MISE À LA TERRE : L’absence ou la défaillance du systeme de terre (résistance > 1500 Ohms, conducteur section insuffisante) constitue une faute grave, entraînant le rejet de l’ouvrage et l’application de pénalités de 15% du montant du lot par jour de retard dans la correction.',
      'ART E.5 - ESSAIS OBLIGATOIRES : Avant validation, des essais de continuité, d’isolement (R > 0,5 MOhms) et de déclenchement du différentiel (IΔn <= 30 mA) doivent être réalisés et consignés dans GEM-PROQUELEC. Leur absence entraîne le rejet systématique de l’ouvrage.',
    ],
    pricing: {
      dailyRate: 25000,
      personnelCount: 5,
      durationDays: 20,
      penalties:
        '**PÉNALITÉS POUR RETARD OU NON-CONFORMITÉ**\n- **Retard de réalisation** : 5% du montant du lot par semaine de retard (plafonné à 20%).\n- **Non-conformité majeure** (ex : absence de mise à la terre, résistance > 1500 Ohms) : 10% du montant du lot **par jour** jusqu’à correction, sans dépasser 50% du montant total.\n- **Absence de reporting quotidien (Kobo/GEM-PROQUELEC)** : 2% du montant journalier du lot par omission, avec blocage des paiements jusqu’à régularisation.\n- **Falsification des données** (ex : photos truquées, essais non réalisés) : Résiliation immédiate du marché + pénalités de 100% du montant du lot concerné.\n- **Non-respect des EPI** : Arrêt immédiat des travaux + pénalité de 5% du montant journalier du lot par infraction constatée.',
      currency: 'FCFA',
    },
  },
  Maçonnerie: {
    color: 'orange',
    icon: Home,
    image: '/assets/images/macon-muret.png',
    defaultCadence: 'Cadence : 2-3 Murets / Jour',
    introduction:
      'ARTICLE 1 - OBJET : Construction des murs supports pour potelet et socles de coffrets de comptage, conformes aux plans validés et aux exigences de stabilité mécanique définies par la norme NS 01-001. Le Titulaire garantit la résistance et la durabilité des ouvrages, ainsi que leur conformité aux règles de l’art en matière de génie civil.',
    missions: [
      'ART 2.1 - FONDATION : Creusement d’une fouille de dimensions minimales 70x70x50 cm, nettoyage et pose d’un béton de propreté (épaisseur 10 cm, dosage 350 kg/m3). La fouille doit être exempte d’eau et de matériaux instables.',
      'ART 2.2 - ÉLÉVATION : Montage de 40 briques pleines (20x15x40 cm) en quinconce, avec contrôle systématique de la verticalité (+/- 2 mm/m) et de l’aplomb. Les joints doivent être réguliers (épaisseur 10-15 mm) et remplis de mortier (dosage 1:3).',
      'ART 2.3 - REMPLISSAGE : Scellement multicouche avec béton dosé à 350 kg/m3, pierres concassées et sable compacté. Le remblai doit être réalisé par couches successives de 20 cm, damées mécaniquement.',
      'ART 2.4 - FINITIONS : Intégration d’un potelet galvanisé (diamètre 60 mm, épaisseur 3 mm), scellement du coffret de comptage (niveau +/- 0), et application d’un enduit de protection (épaisseur 15 mm, dosage 1:2:4).',
      'ART 2.5 - REPORTING JOURNALIER : Le Chef d’équipe maçon doit renseigner quotidiennement, avant 18h00, le formulaire Kobo pour chaque muret réalisé, incluant : photographies géolocalisées, dimensions, et résultats des contrôles de verticalité. Toute omission entraîne une pénalité de 2% du montant journalier du lot.',
    ],
    materials: [
      '- Briques pleines (20x15x40 cm, résistance)',
      '- Ciment CPJ 45 (50 kg/sac) et agrégats (sable 0/5, gravillons 5/15)',
      '- Eau de gâchage potable (rapport E/C <= 0,5)',
      '- Potelet galvanisé (Ø60 mm, épaisseur 2 mm) et accessoires de scellement (mortier rapide, chevilles)',
      '- Enduit de protection (dosage 1:2:4, épaisseur 15 mm).',
    ],
    hse: [
      '**HSE 2.1 - PORT DES EPI** : Obligation de porter en permanence : gants anti-coupures (norme EN 388), chaussures de sécurité à embout métallique (norme EN ISO 20345), casque, et lunettes de protection (norme EN 166). Leur non-port entraîne un arrêt immédiat des travaux et une pénalité de 5% du montant journalier du lot.',
      '**HSE 2.2 - STABILITÉ DES FOUILLES** : Avant toute intervention en fouille (> 1,20 m de profondeur), vérification de la stabilité des parois (talus ou étaiement) et signalisation du périmètre. Les fouilles non sécurisées sont sanctionnées par une pénalité de 10% du montant journalier du lot.',
      '**HSE 2.3 - MANUTENTION DES CHARGES** : Pour les charges > 20 kg, utilisation obligatoire de moyens mécaniques (chariot, grue) ou de techniques de manutention manuelle sécurisées (formation obligatoire). Le non-respect expose à une pénalité de 5% du montant journalier du lot.',
      "**HSE 2.4 - STOCKAGE DES MATÉRIAUX** : Les sacs de ciment et les agrégats doivent être stockés sur palettes, à l'abri de l'humidité, et protégés par une bâche. Tout dommage dû à un stockage défectueux est facturé au Titulaire et sanctionné par une pénalité de 7% du montant du lot.",
      "**HSE 2.5 - PREMIERS SECOURS** : Présence obligatoire d'une trousse de secours (norme NF EN 12870) et d'un point d'eau potable sur chaque chantier. Leur absence est passible d'une pénalité de 5% du montant journalier du lot.",
    ],
    legal: [
      ...LEGAL_COMMON,
      'ART M.1 - STABILITÉ MÉCANIQUE : Le maçon est responsable de la stabilité des ouvrages réalisés. Toute fissuration (> 0,2 mm) ou tout affaissement détecté dans les 30 jours suivant la réception entraîne une reprise intégrale aux frais du Titulaire.',
      'ART M.2 - SUPPORT DES COFFRETS : Tout défaut du support (muret, socle) affectant la fixation ou l’étanchéité du coffret de comptage engage la responsabilité décennale du Titulaire.',
      'ART M.3 - DOSAGE DU BÉTON : Le non-respect des dosages prescrits (350 kg/m3 pour les fondations, 1:2:4 pour les enduits) constitue une non-conformité majeure, entraînant le rejet de l’ouvrage et des pénalités de 10% par jour de retard dans la correction.',
      'ART M.4 - FISSURATION POST-RÉCEPTION : Toute fissuration apparue dans les 12 mois suivant la réception engage la responsabilité du Titulaire et donne lieu à une reprise gratuite sous 15 jours, sous peine de pénalités de 5% par semaine de retard.',
    ],
    finances: [
      'ART 5.1 - VALIDATION PAR RÉCEPTION FINALE : La réception finale est prononcée par PROQUELEC après vérification de la conformité dimensionnelle, mécanique et esthétique des murets. Elle est matérialisée par le statut "Réceptionné conforme" dans GEM-PROQUELEC et la signature d’un PVR.',
      'ART 5.2 - OBLIGATION KOBO : Saisie quotidienne obligatoire des murets réalisés (dimensions, photos, contrôles) pour permettre le pilotage de la trésorerie par le Chef de Projet via GEM-PROQUELEC. Toute absence de saisie entraîne un blocage des paiements jusqu’à régularisation.',
      'ART 5.3 - CAUTIONNEMENT : Acceptation de la caution d’assurance (SONAM/ASKIA) pour l’avance de démarrage, sous réserve de transmission de l’attestation correspondante avant le premier décaissement.',
    ],
    pricing: {
      dailyRate: 30000,
      personnelCount: 2,
      durationDays: 20,
      penalties:
        '**PÉNALITÉS POUR DÉFAUTS DE CONFORMITÉ OU RETARDS**\n- **Retard de livraison** : 5% du montant du lot par semaine (plafonné à 25%).\n- **Non-respect des dosages béton** (ex : < 350 kg/m3) : Reprise intégrale aux frais du Titulaire + 10% du montant du lot par jour de retard dans la correction.\n- **Fissuration post-réception** (> 0,2 mm dans les 12 mois) : Réparation gratuite sous 15 jours, sinon pénalités de 5% par semaine de retard.\n- **Absence de reporting Kobo** : 3% du montant journalier du lot par omission, avec suspension des paiements.\n- **Non-port des EPI** : Sanction immédiate (arrêt du chantier) + 5% du montant journalier du lot par infraction.\n- **Stockage défectueux des matériaux** (ex : ciment mouillé) : Remplacement aux frais du Titulaire + pénalité de 7% du montant du lot.',
      currency: 'FCFA',
    },
  },
  'Réseau Extérieur': {
    color: 'emerald',
    icon: Network,
    image: '/assets/images/reseau-poteau.png',
    defaultCadence: 'Cadence : 4-6 Branch. / Jour',
    introduction:
      'ARTICLE 1 - OBJET : Réalisation du branchement client aérien ou souterrain, pose de l’organe de coupure, et raccordement au point de livraison Senelec, conformément aux normes NFC 13-100 et aux spécifications techniques de Senelec. Le Titulaire garantit la sécurité, la durabilité et la conformité réglementaire des installations.',
    missions: [
      'ART 3.1 - BRANCHEMENT MONOPHASÉ : Réalisation du branchement aérien en câble aluminium torsadé (section 2x16 mm2), avec respect des distances minimales (3 m au-dessus des voies publiques, 1 m en propriété privée). Le câble doit être tendu mécaniquement (flèche <= 1/50 de la portée) et protégé contre les frottements.',
      'ART 3.2 - COUPE-CIRCUIT DE BRANCHEMENT : Installation d’un coupe-circuit à fusibles (calibre adapté à la puissance souscrite), dans un boîtier étanche IP55, fixé à 2 m du sol. Le sectionnement doit être visible et accessible sans outil.',
      'ART 3.3 - RACCORDEMENT AU HUBLOT : Connexion du branchement au hublot Senelec (ou coffret de comptage) via des connecteurs certifiés (type CPB1/CT70), avec serrage mécanique et protection contre la corrosion. Le raccordement doit être étanche et identifié par une plaque signalétique.',
      'ART 3.4 - MISE EN SERVICE : La mise sous tension finale est réalisée par Senelec après validation technique par PROQUELEC. Le Titulaire doit fournir un rapport de conformité (avec photos géolocalisées) avant toute demande de mise en service.',
      'ART 3.5 - REPORTING JOURNALIER : Le Chef d’équipe réseau doit renseigner quotidiennement le formulaire Kobo pour chaque branchement effectué, incluant : coordonnées GPS, type de branchement, résultats des tests de continuité, et photos des connecteurs. Toute omission entraîne une pénalité de 3% du montant journalier du lot.',
    ],
    materials: [
      '- Câble aluminium torsadé 2x16 mm2 (norme NFC 33-209)',
      '- Connecteurs type CPB1/CT70 (certifiés et étanches)',
      '- Coupe-circuit de branchement (calibre adapté, boîtier IP55)',
      '- Pinces d’ancrage et brides de serrage (inox ou galvanisé)',
      '- Tube PVC Ø25 mm et accessoires de descente (pour passages souterrains).',
    ],
    hse: [
      "**HSE 3.1 - TRAVAIL EN HAUTEUR** : Pour les interventions à plus de 2 m, port obligatoire d'un harnais de sécurité (norme EN 361) fixé à un point d'ancrage certifié, et utilisation d'une ligne de vie. Le non-respect est sanctionné par un arrêt immédiat des travaux et une pénalité de 20% du montant journalier du lot.",
      '**HSE 3.2 - VÉRIFICATION DES SUPPORTS** : Avant toute ascension, contrôle de la solidité des poteaux et des échelles (marquage CE, absence de corrosion). Tout support instable doit être signalé et consolidé avant intervention, sous peine de pénalité de 15% du montant journalier du lot.',
      "**HSE 3.3 - SIGNALISATION DES CÂBLES** : Balisage et protection des câbles temporairement posés au sol (passages piétons, routes). L'absence de signalisation expose à une pénalité de 10% du montant journalier du lot et à des poursuites en cas d'accident.",
      '**HSE 3.4 - ÉQUIPEMENTS DE PROTECTION** : Port obligatoire des EPI suivants : casque avec jugulaire, gants isolants (norme EN 60903), chaussures de sécurité (norme EN ISO 20345), et vêtements haute visibilité (norme EN ISO 20471). Leur absence est sanctionné par une pénalité de 5% du montant journalier du lot.',
      '**HSE 3.5 - SÉCURITÉ ROUTIÈRE** : Respect des limites de vitesse (40 km/h en zone habitée) et interdiction du téléphone au volant. Les infractions sont sanctionnées par une pénalité de 5% du montant journalier du lot, cumulable en cas de récidive.',
    ],
    legal: [
      ...LEGAL_COMMON,
      'ART R.1 - INTÉGRITÉ DU RÉSEAU SENELEC : Toute dégradation du réseau Senelec (poteaux, câbles, hublots) imputable au Titulaire sera réparée à ses frais, sous 48h après notification, sous peine de pénalités de 20% du montant du lot par jour de retard.',
      'ART R.2 - DISTANCES DE SÉCURITÉ : Le non-respect des distances minimales (3 m au-dessus des voies, 1 m en propriété privée) ou des règles de tension mécanique des câbles constitue une faute grave, entraînant le rejet du branchement et une pénalité de 15% du montant du lot.',
      'ART R.3 - BRANCHEMENT ILLICITE : Tout branchement non conforme aux plans validés ou réalisé sans autorisation est strictement interdit. En cas de fraude avérée, le Titulaire sera exclu du marché et poursuivi conformément au Code pénal sénégalais.',
      'ART R.4 - SÉCURITÉ PUBLIQUE : Le Titulaire est responsable des risques pour les tiers (chute de câble, électrocution) liés à ses installations. Il doit souscrire une assurance spécifique couvrant ces risques et en fournir la preuve avant le démarrage des travaux.',
    ],
    finances: [
      'ART 5.1 - RÉCEPTION FINALE : Paiement hebdomadaire à l\'unité (par branchement) après réception finale par PROQUELEC et obtention du statut "Réceptionné conforme" dans GEM-PROQUELEC. Le PVR signé est obligatoire pour le déclenchement du paiement.',
      "ART 5.2 - FACILITATION GEM : Le systeme GEM-PROQUELEC permet un suivi en temps réel des flux de trésorerie, sur la base des formulaires Kobo renseignés quotidiennement par le prestataire. Les retards de saisie bloquent les paiements jusqu'à régularisation.",
    ],
    pricing: {
      dailyRate: 40000,
      personnelCount: 2,
      durationDays: 15,
      penalties:
        "**PÉNALITÉS POUR NON-RESPECT DES NORMES DE SÉCURITÉ ET DE DÉLAIS**\n- **Retard de branchement** : 10% du montant du lot par semaine (plafonné à 30%).\n- **Non-respect des distances de sécurité** (ex : câble à < 3 m au-dessus d'une voie) : Reprise immédiate + 15% du montant du lot par jour jusqu'à conformité.\n- **Absence de harnais en hauteur** : Arrêt immédiat des travaux + pénalité de 20% du montant journalier du lot.\n- **Branchement non conforme** (ex : absence de coupe-circuit) : Refus de mise en service par Senelec + 10% du montant du lot par jour de retard.\n- **Non-tracabilité des livraisons** (Kobo/GEM-PROQUELEC) : Blocage des paiements + 3% du montant journalier du lot par omission.\n- **Dégâts sur le réseau Senelec** : Réparation aux frais du Titulaire sous 48h, sinon pénalités de 20% du montant du lot par jour.",
      currency: 'FCFA',
    },
  },
  Logistique: {
    color: 'amber',
    icon: Truck,
    image: '/assets/images/livreur-distribution.png',
    defaultCadence: 'Flux : 20-30 Ménages / Jour',
    introduction:
      "ARTICLE 1 - OBJET : Gestion des flux de matériel, transport sécurisé, tracabilité des équipements, et gestion des rebuts, conformément aux exigences de tracabilité numérique du projet. Le Titulaire garantit la livraison intacte et dans les délais des matériaux, ainsi que leur stockage sécurisé sur les sites d'intervention.",
    missions: [
      'ART 4.1 - TRACABILITÉ NUMÉRIQUE : Enregistrement systématique des mouvements de stock (entrées/sorties) dans GEM-PROQUELEC via les identifiants NumeroOrdre, avec scan des codes-barres et géolocalisation des livraisons. Toute discordance entre les stocks physiques et numériques entraîne un audit immédiat et des pénalités de 5% du montant du lot concerné.',
      "ART 4.2 - TRANSPORT SÉCURISÉ : Acheminement des matériaux vers les sites d'intervention avec arrimage certifié des bobines (sangle 2T, protection anti-abrasion), respect des limites de vitesse (40 km/h en zone habitée), et signalisation du convoi. Les véhicules doivent être équipés de systèmes de géolocalisation et de kits de sécurité (extincteurs, trousses de secours).",
      'ART 4.3 - GESTION DES REBUTS : Récupération et tri des chutes de câbles, emballages et matériaux usagés pour traitement centralisé (recyclage ou élimination conforme). Un bordereau de suivi des déchets doit être établi et transmis hebdomadairement au Chef de Projet.',
      'ART 4.4 - CONTRÔLE DES FLUX : Reporting quotidien des quantités livrées vs prévisionnel, avec alerte immédiate en cas de risque de rupture. Les écarts > 10% doivent être justifiés sous 24h, sous peine de pénalités de 3% du montant du lot.',
      "ART 4.5 - REPORTING JOURNALIER : Le Chef d'équipe logistique doit mettre à jour quotidiennement les flux et livraisons dans le formulaire Kobo, incluant : heures de départ/arrivée, kilométrage, état des matériaux à la livraison, et incidents éventuels. Toute omission entraîne une pénalité de 2% du montant journalier du lot.",
    ],
    materials: [
      '- Véhicules de transport équipés (géolocalisation, arrimage certifié, extincteurs)',
      '- Systèmes de protection des bobines (sangles, bâches, caisses de transport)',
      '- Terminaux mobiles de scan et logiciels de tracabilité (GEM-PROQUELEC, Kobo)',
      '- Équipements de sécurité (gilets haute visibilité, kits de premiers secours).',
    ],
    hse: [
      '**HSE 4.1 - CONDUITE SÉCURISÉE** : Respect strict du Code de la route (vitesse limitée à 40 km/h en zone habitée, interdiction du téléphone au volant). Les infractions sont sanctionnées par une pénalité de 5% du montant journalier du lot, cumulable en cas de récidive.',
      '**HSE 4.2 - ARRIMAGE DES CHARGES** : Les bobines de câble et les matériaux doivent être arrimés avec des sangles homologuées (charge maximale 2T) et protégés contre les frottements. Tout chargement non sécurisé entraîne une pénalité de 10% du montant journalier du lot.',
      "**HSE 4.3 - INTERDICTION DES PASSAGERS NON AUTORISÉS** : Transport strictement réservé au personnel habilité. Toute infraction expose à une pénalité de 10% du montant du lot et à l'immobilisation du véhicule.",
      "**HSE 4.4 - ÉQUIPEMENTS DE PREMIERS SECOURS** : Chaque véhicule doit être équipé d'une trousse de secours (norme NF EN 12870) et d'un extincteur (norme EN 3-7). Leur absence est sanctionnée par une pénalité de 7% du montant journalier du lot.",
      '**HSE 4.5 - GESTION DES DÉCHETS** : Tri et élimination des rebuts (câbles, emballages) conformément à la réglementation environnementale sénégalaise. Le non-respect expose à une pénalité de 5% du montant du lot et à des poursuites administratives.',
    ],
    legal: [
      ...LEGAL_COMMON,
      "ART L.1 - RESPONSABILITÉ DU TRANSPORT : Le Titulaire est responsable des équipements et matériaux du départ du dépôt jusqu'à leur réception sur site. Toute perte, vol ou détérioration sera facturée au prix du marché majoré de 20%.",
      "ART L.2 - TRACABILITÉ OBLIGATOIRE : Toute sortie de matériel doit être enregistrée dans GEM-PROQUELEC avant le départ du dépôt. L'absence de tracabilité bloque les paiements jusqu'à régularisation.",
      "ART L.3 - GESTION DES DÉCHETS : Le non-respect des procédures de tri et d'élimination des rebuts (câbles, emballages) entraîne une pénalité de 5% du montant du lot et peut donner lieu à une exclusion du marché pour non-respect des normes environnementales.",
      "ART L.4 - STOCKAGE SÉCURISÉ : Les matériaux doivent être stockés sur site dans des conditions préservant leur intégrité (abri, protection contre l'humidité). Tout dommage dû à un stockage défectueux est à la charge du Titulaire.",
    ],
    finances: [
      'ART 5.1 - PAIEMENT : Règlement hebdomadaire après réception finale des flux de matériel et validation des données dans GEM-PROQUELEC par le Chef de Projet. Les bordereaux de livraison signés et les preuves de tracabilité sont obligatoires.',
      "ART 5.2 - OBLIGATION KOBO : La tracabilité des livraisons via les formulaires Kobo est obligatoire pour déclencher les facilités de trésorerie. Toute absence de saisie bloque les paiements jusqu'à régularisation.",
      "ART 5.3 - GARANTIE : Retenue de garantie limitée à 5-10%, libérable par caution d'assurance (SONAM/ASKIA) sur présentation de l'attestation correspondante.",
    ],
    pricing: {
      dailyRate: 35000,
      personnelCount: 2,
      durationDays: 15,
      penalties:
        '**PÉNALITÉS POUR PERTE, RETARD OU NON-TRACABILITÉ**\n- **Perte ou endommagement de matériel** : Remboursement au prix du marché majoré de 20% + pénalité de 10% du montant du lot par unité perdue.\n- **Retard de livraison** (> 24h) : 5% du montant du lot par jour de retard (plafonné à 30%).\n- **Non-respect des procédures de tracabilité** (Kobo/GEM-PROQUELEC) : Blocage des paiements + 5% du montant journalier du lot par omission.\n- **Excès de vitesse ou infraction routière** : 5% du montant journalier du lot par infraction, cumulable en cas de récidive.\n- **Transport de passagers non autorisés** : Immobilisation du véhicule + pénalité de 10% du montant du lot.\n- **Non-gestion des rebuts** (câbles, emballages) : Pénalité de 7% du montant du lot + obligation de nettoyage aux frais du Titulaire.',
      currency: 'FCFA',
    },
  },
  'Audit & Contrôle Qualité (PROQUELEC)': {
    color: 'emerald',
    icon: ShieldCheck,
    image: '/assets/images/controleur-final.png',
    defaultCadence: 'Cadence : Selon volume / Jour',
    introduction:
      "ARTICLE 1 - OBJET : Surveillance, essai et validation finale de l'ensemble des ouvrages (Génie Civil, Réseau, Intérieur) pour garantir leur conformité aux normes techniques (NFC 15-100, NS 01-001, doctrine Senelec) et aux exigences du présent Cahier des Charges. Le contrôleur PROQUELEC agit en totale indépendance et son avis est souverain pour la réception des travaux.",
    missions: [
      "ART 5.1 - AUDIT MAÇONNERIE : Vérification de la verticalité des murs (+/- 2 mm/m), du dosage du béton (350 kg/m3 pour les fondations), de la solidité mécanique des potelets, et de l'étanchéité des coffrets. Les essais de charge (1,5x la charge nominale) sont réalisés en présence du Titulaire.",
      "ART 5.2 - AUDIT RÉSEAU : Contrôle du branchement (tension mécanique du câble, présence et calibrage du coupe-circuit, étanchéité du hublot Senelec). Les mesures de résistance d'isolement (R > 0,5 MOhms) et de continuité sont consignées dans GEM-PROQUELEC.",
      "ART 5.3 - AUDIT ÉLECTRICIEN : Test de déclenchement du différentiel 30mA, vérification du disjoncteur 5/15A, et mesure de la résistance de terre (< 1500 Ohms). Les essais sont réalisés conformément à la norme NFC 15-100 et leurs résultats sont transmis au Maître d'Ouvrage sous 24h.",
      "ART 5.4 - CONFORMITÉ LOT 24 : Inspection visuelle des gaines, canalisations et fixations pour prévenir tout risque d'incendie ou d'électrocution. Les non-conformités sont consignées dans un Procès-Verbal de Non-Conformité (PVNC) et notifiées au Titulaire sous 48h.",
      "ART 5.5 - VALIDATION NUMÉRIQUE : Signature électronique du PV de réception dans Kobo/GEM-PROQUELEC, incluant les photographies géolocalisées des ouvrages, les résultats des essais, et l'avis du contrôleur. Ce PV est une condition préalable à tout paiement.",
    ],
    materials: [
      '- Tablette tactile avec applications GEM-PROQUELEC/Kobo (géolocalisation, signature électronique)',
      '- Multimètre et telluromètre (étalonnés, certificat de conformité valide)',
      "- VAT (Vérificateur d'Absence de Tension) conforme à la norme NFC 18-510",
      '- Appareil photo haute résolution avec horodatage et géolocalisation.',
    ],
    hse: [
      '**HSE 5.1 - ÉQUIPEMENTS DE PROTECTION** : Port obligatoire des EPI de catégorie 3 (combinaison anti-arc, gants isolants 1000V, casque avec jugulaire) et vérification de leur conformité avant chaque intervention.',
      "**HSE 5.2 - VÉRIFICATION D'ABSENCE DE TENSION** : Utilisation systématique d'un VAT (norme NFC 18-510) avant tout contact avec une installation électrique. Le non-respect de cette procédure est considéré comme une faute grave.",
      "**HSE 5.3 - SÉCURITÉ EN HAUTEUR** : Pour les contrôles en hauteur, utilisation obligatoire d'un harnais (norme EN 361) et d'une ligne de vie. Les infractions sont sanctionnées par une pénalité de 20% des honoraires journaliers.",
      "**HSE 5.4 - SIGNALISATION DES ZONES DE CONTRÔLE** : Balisage des ouvrages en attente de validation et isolement des zones non conformes. L'absence de signalisation expose à une pénalité de 5% des honoraires journaliers.",
      "**HSE 5.5 - FORMATION ET HABILITATION** : Le contrôleur doit être titulaire d'une habilitation électrique (BR ou BC) en cours de validité. Son absence est passible d'une exclusion du marché et de poursuites pour exercice illégal.",
    ],
    legal: [
      ...LEGAL_COMMON,
      'ART C.1 - INDÉPENDANCE DU CONTRÔLEUR : Le contrôleur PROQUELEC agit de manière autonome et indépendante des équipes de réalisation. Ses décisions sont souveraines et ne peuvent faire l’objet de pression ou d’influence.',
      'ART C.2 - POUVOIR DE REFUS : Tout ouvrage non conforme aux normes ou présentant un risque pour la sécurité est rejeté jusqu’à reprise complète et validation par PROQUELEC. Le Titulaire ne peut contester ce rejet sans preuve écrite de conformité.',
      'ART C.3 - CERTIFICATION FINALE : La validation dans GEM-PROQUELEC par le contrôleur PROQUELEC constitue le seul acte déclenchant le processus de paiement. Aucune réception verbale ou partielle n’est opposable au Maître d’Ouvrage.',
      'ART C.4 - RESPONSABILITÉ DU CONTRÔLEUR : Le contrôleur engage sa responsabilité en cas de validation d’un ouvrage dangereux ou non conforme. Il doit signaler toute tentative de fraude ou de falsification des données.',
    ],
    finances: [
      'ART 5.1 - HONORAIRES : Règlement basé sur le volume d’ouvrages audités et validés, selon un barème fixe par type de contrôle (maçonnerie, réseau, électricité). Les honoraires sont dus dès la signature du PV de réception.',
      'ART 5.2 - FACILITATION GEM : Utilisation de GEM-PROQUELEC pour le suivi des audits et l’accélération des validations. Les retards de saisie des rapports bloquent les paiements jusqu’à régularisation.',
    ],
    pricing: {
      dailyRate: 50000,
      personnelCount: 1,
      durationDays: 30,
      penalties:
        '**PÉNALITÉS POUR VALIDATION D’OUVRAGES NON CONFORMES OU FRAUDE**\n- **Validation d’un ouvrage non conforme** : Responsabilité engagée à hauteur de 100% des honoraires perçus pour le lot concerné + exclusion possible du marché.\n- **Retard dans la transmission des rapports** : 5% des honoraires par jour de retard (plafonné à 50%).\n- **Falsification des données d’audit** : Résiliation immédiate du contrat + pénalités civiles et pénales (poursuites conformément au Code pénal sénégalais).\n- **Absence de signalement d’une non-conformité** : Pénalité de 20% des honoraires du lot concerné.\n- **Non-port des EPI de catégorie 3** : Arrêt immédiat des contrôles + pénalité de 10% des honoraires journaliers.',
      currency: 'FCFA',
    },
  },
};

const ROLE_TO_TRADE_MAPPING: Record<string, string> = {
  Maçonnerie: 'macons',
  'Réseau Extérieur': 'reseau',
  Électricien: 'interieur_type1',
  Logistique: 'logistics',
  'Audit & Contrôle Qualité (PROQUELEC)': 'controle',
  'Contrôle & Validation': 'controle',
  Préparateur: 'preparateurs',
};

export default function Cahier() {
  const { user } = useAuth();
  const isAdmin =
    (user?.role || '').includes('ADMIN') ||
    (user?.role || '').includes('DG') ||
    (user?.role || '').includes('DIRECTEUR') ||
    user?.email === 'admingem' ||
    user?.role === 'CLIENT_LSE';

  const { project } = useProject();
  const { teams: allTeams } = useTeams(project?.id);

  const [selectedRole, setSelectedRole] = useState('Électricien');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { updateProject } = useProject();

  // Get automated rate for the current role from project settings
  const automatedRate = useMemo(() => {
    if (!project?.config?.costs?.staffRates) return null;
    const tradeKey = ROLE_TO_TRADE_MAPPING[selectedRole];
    if (!tradeKey) return null;

    const staffRates = project.config.costs.staffRates;
    for (const regionId in staffRates) {
      const regionRates = staffRates[regionId] as unknown as Record<
        string,
        { amount: number; mode: 'daily' | 'monthly' | 'task' }
      >;
      if (!regionRates || typeof regionRates !== 'object') continue;

      for (const teamId in regionRates) {
        const team = (allTeams || []).find((t) => t.id === teamId);
        if (team?.tradeKey === tradeKey) {
          const rate = regionRates[teamId];
          if (rate) {
            return rate.amount || null;
          }
        }
      }
    }
    return null;
  }, [project, allTeams, selectedRole]);

  // Load local overrides or fallback to Project Standard, then Default
  const [customLibrary, setCustomLibrary] = useState<TaskLibrary>(() => {
    try {
      // 1. Try Local Storage (User's working draft)
      const localSaved = safeStorage.getItem('gem_cahier_library');
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed['Électricien']) {
          // Restore Icons
          Object.keys(parsed).forEach((k) => {
            if (DEFAULT_TASK_LIBRARY[k]) parsed[k].icon = DEFAULT_TASK_LIBRARY[k].icon;
          });
          return parsed;
        }
      }

      // 2. Try Project Config (Team's standard)
      const projectHistory = (project?.config as any)?.cahierHistory;
      if (projectHistory && projectHistory.length > 0) {
        const dbLibrary = { ...projectHistory[0].library };
        Object.keys(dbLibrary).forEach((k) => {
          if (DEFAULT_TASK_LIBRARY[k]) dbLibrary[k].icon = DEFAULT_TASK_LIBRARY[k].icon;
        });
        return dbLibrary;
      }
    } catch (e) {
      console.error('Initial load failed:', e);
    }
    return DEFAULT_TASK_LIBRARY;
  });

  const currentRoleKey = customLibrary[selectedRole as keyof typeof customLibrary]
    ? selectedRole
    : Object.keys(DEFAULT_TASK_LIBRARY)[0];
  const currentTask =
    customLibrary[currentRoleKey as keyof typeof customLibrary] ||
    DEFAULT_TASK_LIBRARY[Object.keys(DEFAULT_TASK_LIBRARY)[0]];
  const CurrentIcon = currentTask?.icon || Hammer;

  const getCadence = (roleName: string) => {
    const tradeKey = ROLE_TO_TRADE_MAPPING[roleName];
    const task = customLibrary[roleName] || DEFAULT_TASK_LIBRARY[roleName];

    // 1. Priorité aux Cadences Standards du Projet (Production Rates)
    const productionRates = project?.config?.productionRates;
    if (tradeKey && productionRates && productionRates[tradeKey]) {
      const rate = productionRates[tradeKey];
      const unit = roleName.includes('Réseau')
        ? 'Branch.'
        : roleName.includes('Maçon')
          ? 'Murets'
          : roleName.includes('Log')
            ? 'Ménages'
            : 'Foyers';
      const label = roleName.includes('Log') ? 'Flux' : 'Cadence';

      // On génère une plage de "Vitesse Standard" (2 à double de 2)
      const maxRate = Math.ceil(rate * 1.5); // On utilise 1.5 pour rester réaliste, ou rate * 2 si strictement demandé
      return `${label} : ${rate}-${rate * 2} ${unit} / Jour`;
    }

    // 2. Fallback aux capacités individuelles des équipes
    const tradeTeams = allTeams?.filter((t) => t.tradeKey === tradeKey) || [];
    if (tradeTeams.length > 0) {
      const capacities = Array.from(
        new Set(tradeTeams.map((t) => (t as any).capacity).filter((c) => !!c))
      );
      if (capacities.length > 0) {
        const unit = roleName.includes('Réseau')
          ? 'Branch.'
          : roleName.includes('Maçon')
            ? 'Murets'
            : roleName.includes('Log')
              ? 'Ménages'
              : 'Foyers';
        const label = roleName.includes('Log') ? 'Flux' : 'Cadence';

        if (capacities.length === 1) return `${label} : ${capacities[0]} ${unit} / Jour`;
        return `${label} : ${Math.min(...(capacities as number[]))}-${Math.max(...(capacities as number[]))} ${unit} / Jour`;
      }
    }

    return task?.defaultCadence || '';
  };

  const [editData, setEditData] = useState({
    introduction: currentTask.introduction || '',
    missions: currentTask.missions.join('\n'),
    materials: currentTask.materials.join('\n'),
    hse: currentTask.hse.join('\n'),
    subcontracting: currentTask.subcontracting?.join('\n') || '',
    finances: currentTask.finances?.join('\n') || '',
    pricing: {
      dailyRate: currentTask.pricing?.dailyRate || 0,
      personnelCount: currentTask.pricing?.personnelCount || 0,
      durationDays: currentTask.pricing?.durationDays || 0,
      penalties: currentTask.pricing?.penalties || '',
    },
  });

  /**
   * Synchronise le taux automatique avec l'état d'édition si disponible
   */
  useEffect(() => {
    if (automatedRate && isEditing && editData.pricing.dailyRate === 0) {
      setEditData((prev) => ({
        ...prev,
        pricing: { ...prev.pricing, dailyRate: automatedRate },
      }));
    }
  }, [automatedRate, isEditing, editData.pricing.dailyRate]);

  // Reset editable fields when role changes
  /**
   * Gère le changement de rôle et réinitialise les champs d'édition
   */
  const handleRoleChange = useCallback(
    (role: string) => {
      setSelectedRole(role);
      setIsEditing(false);
      const task = (customLibrary[role as keyof typeof customLibrary] ||
        DEFAULT_TASK_LIBRARY[Object.keys(DEFAULT_TASK_LIBRARY)[0]]) as CahierTask;

      setEditData({
        introduction: task.introduction || '',
        missions: task.missions.join('\n'),
        materials: task.materials.join('\n'),
        hse: task.hse.join('\n'),
        subcontracting: task.subcontracting?.join('\n') || '',
        finances: task.finances?.join('\n') || '',
        pricing: {
          dailyRate: task.pricing?.dailyRate || 0,
          personnelCount: task.pricing?.personnelCount || 0,
          durationDays: task.pricing?.durationDays || 0,
          penalties: task.pricing?.penalties || '',
        },
      });
    },
    [customLibrary]
  );

  const handleSave = () => {
    const updatedLibrary = { ...customLibrary };
    updatedLibrary[selectedRole as keyof typeof customLibrary] = {
      ...currentTask,
      introduction: editData.introduction,
      missions: editData.missions.split('\n').filter(Boolean),
      materials: editData.materials.split('\n').filter(Boolean),
      hse: editData.hse.split('\n').filter(Boolean),
      subcontracting: editData.subcontracting.split('\n').filter(Boolean),
      finances: editData.finances.split('\n').filter(Boolean),
      pricing: {
        ...currentTask.pricing,
        ...editData.pricing,
      },
    } as CahierTask;

    setCustomLibrary(updatedLibrary);
    safeStorage.setItem('gem_cahier_library', JSON.stringify(updatedLibrary));
    setIsEditing(false);
  };

  const handleSaveToLocal = () => {
    safeStorage.setItem('gem_cahier_library', JSON.stringify(customLibrary));
    setIsEditing(false);
  };

  const handleSaveProjectStandard = async () => {
    if (!project || !isAdmin) return;
    try {
      setIsSaving(true);
      const currentHistory = project.config?.cahierHistory || [];
      const newVersion: CahierVersion = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        author: user?.role || 'Admin',
        library: { ...customLibrary } as TaskLibrary,
      };

      const newHistory = [newVersion, ...currentHistory].slice(0, 3);

      await updateProject({
        config: {
          ...project.config,
          cahierHistory: newHistory,
        },
      });
      alert('Norme projet enregistrée avec succès (Historique mis à jour).');
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreVersion = (version: CahierVersion) => {
    if (
      !confirm(`Voulez-vous restaurer la version du ${new Date(version.date).toLocaleString()} ?`)
    )
      return;
    setCustomLibrary(version.library);
    safeStorage.setItem('gem_cahier_library', JSON.stringify(version.library));
    alert('Version restaurée !');
  };

  const handleExportWord = async () => {
    await exportCahiersToWord(
      [
        {
          role: selectedRole,
          introduction: currentTask.introduction,
          missions: currentTask.missions,
          materials: currentTask.materials,
          hse: currentTask.hse,
          subcontracting: currentTask.subcontracting || [],
          finances: currentTask.finances || [],
          legal: (currentTask as any).legal || [],
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          responsible: user?.name || '',
          contact: '',
          imagePath: currentTask.image,
          technicalImages: (currentTask as any).technicalImages,
          pricing: currentTask.pricing,
        },
      ],
      false,
      GENERAL_CLAUSES
    );
  };

  const exportAllWord = async () => {
    const allData = Object.entries(customLibrary).map(([role, task]) => {
      const t = task as CahierTask;
      return {
        role,
        introduction: t.introduction,
        missions: t.missions,
        materials: t.materials,
        hse: t.hse,
        subcontracting: t.subcontracting || [],
        finances: t.finances || [],
        legal: t.legal || [],
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        responsible: '',
        contact: '',
        imagePath: t.image,
        technicalImages: t.technicalImages,
        pricing: t.pricing,
      };
    });
    await exportCahiersToWord(allData, true, GENERAL_CLAUSES);
  };

  const finalRolesToDisplay = useMemo(() => {
    const filtered = Object.entries(customLibrary).filter(([name]) => {
      if (isAdmin) return true;
      const userSearch = (
        user?.name + ' ' + user?.role + ' ' + (user as any)?.displayName || ''
      ).toLowerCase();
      const roleKey = name.toLowerCase();

      return (
        userSearch.includes(roleKey) ||
        roleKey.includes(userSearch.split(' ')[0].toLowerCase()) ||
        (name.includes('Maçonnerie') &&
          (userSearch.includes('macon') || userSearch.includes('maçon'))) ||
        (name.includes('Électricien') &&
          (userSearch.includes('elect') || userSearch.includes('élec'))) ||
        (name.includes('Réseau') && (userSearch.includes('res') || userSearch.includes('élec'))) ||
        (name.includes('Logistique') &&
          (userSearch.includes('log') || userSearch.includes('livr'))) ||
        (name.includes('Audit') && (userSearch.includes('audit') || userSearch.includes('contr')))
      );
    });
    return filtered.length > 0 ? filtered : Object.entries(customLibrary);
  }, [customLibrary, isAdmin, user]);

  useEffect(() => {
    if (!finalRolesToDisplay.find(([n]) => n === selectedRole)) {
      if (finalRolesToDisplay.length > 0) {
        setSelectedRole(finalRolesToDisplay[0][0]);
      }
    }
  }, [finalRolesToDisplay, selectedRole]);

  if (!project) {
    return (
      <PageContainer>
        <PageHeader title="Chargement..." subtitle="Préparation de la norme projet" icon={HardHat} />
        <ContentArea className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-4">
             <TableRowSkeleton />
             <TableRowSkeleton />
             <TableRowSkeleton />
          </div>
        </ContentArea>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Cahier des Charges"
        subtitle="Opérationnel & Technique"
        icon={HardHat}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none">
                NS 01-001
              </span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {/* Historique des versions */}
                {(project?.config as any)?.cahierHistory?.length > 0 && (
                  <div className="relative group">
                    <button
                      className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                      title="Voir l'historique des versions"
                    >
                      <History size={14} />
                      <span>Historique ({(project?.config?.cahierHistory || []).length})</span>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50">
                      <p className="text-[10px] font-black text-slate-500 uppercase p-2 border-b border-white/5 mb-2">
                        3 Dernières Versions
                      </p>
                      {(project?.config?.cahierHistory || []).map((v: any) => (
                        <div
                          key={v.id}
                          className="p-3 hover:bg-white/5 rounded-lg transition-all mb-1 border border-transparent hover:border-white/5"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-bold text-white">
                              {new Date(v.date).toLocaleDateString()}{' '}
                              {new Date(v.date).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded uppercase">
                              {v.author}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRestoreVersion(v)}
                            className="w-full flex items-center justify-center gap-2 py-1.5 bg-indigo-600/20 text-indigo-400 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            <CornerUpLeft size={10} /> RESTAURER CETTE VERSION
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveProjectStandard}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                  <span>{isSaving ? 'Sauvegarde...' : 'Figer la Norme'}</span>
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Voulez-vous réinitialiser TOUS les cahiers aux normes en vigueur par défaut ?'
                      )
                    ) {
                      safeStorage.removeItem('gem_cahier_library');
                      window.location.reload();
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all active:scale-95"
                  title="Réinitialiser aux normes par défaut"
                >
                  <RefreshCw size={14} />
                  <span>RESET</span>
                </button>
                <button
                  onClick={exportAllWord}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 rounded-lg text-xs font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg"
                >
                  <Download size={14} />
                  <span className="hidden md:inline">LOT COMPLET</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      <ContentArea className="p-0 border-none bg-transparent shadow-none overflow-visible">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-8 p-3 md:p-8">
          {/* Left Navigation: Role Selection with enhanced style */}
          {/* Navigation : Role Selection (Horizontal on mobile) */}
          <div className="xl:col-span-1 xl:space-y-3">
            <div className="flex xl:flex-col overflow-x-auto xl:overflow-x-visible gap-2 pb-4 xl:pb-0 no-scrollbar">
              {finalRolesToDisplay.map(([name, data]: [string, any]) => {
                const Icon = data.icon;
                const isSelected = selectedRole === name;
                return (
                  <button
                    key={name}
                    onClick={() => handleRoleChange(name)}
                    className={`
                      flex-shrink-0 flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 border
                      ${isSelected
                        ? 'bg-orange-500 text-white border-orange-400 shadow-[0_8px_20px_rgba(249,115,22,0.2)]'
                        : 'bg-slate-900/40 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-white'
                      }
                    `}
                  >
                    <div
                      className={`
                        w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center transition-transform shrink-0
                        ${isSelected ? 'bg-white/20' : 'bg-slate-800'}
                      `}
                    >
                      <Icon
                        size={16}
                        className={
                          isSelected
                            ? 'text-white'
                            : COLOR_MAPS[data.color]?.text || 'text-slate-400'
                        }
                      />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <span className="block font-bold text-xs md:text-sm leading-tight">
                        {name}
                      </span>
                      {getCadence(name) && (
                        <span
                          className={`block text-[10px] font-medium opacity-80 mt-0.5 ${isSelected ? 'text-white/90' : 'text-orange-400'
                            }`}
                        >
                          ({getCadence(name)})
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details Content */}
          <main className="xl:col-span-3 space-y-3 md:space-y-8">
            <div className="bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div
                className={`p-4 md:p-8 bg-gradient-to-br from-${currentTask.color}-500/10 to-transparent border-b border-slate-800`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div
                      className={`w-10 h-10 md:w-14 md:h-14 ${COLOR_MAPS[currentTask.color]?.bgSoft || 'bg-slate-800'} rounded-xl md:rounded-2xl flex items-center justify-center border ${COLOR_MAPS[currentTask.color]?.border || 'border-slate-700'} shrink-0`}
                    >
                      <CurrentIcon
                        size={20}
                        className={COLOR_MAPS[currentTask.color]?.text || 'text-white'}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg md:text-2xl font-bold text-white leading-tight">
                          {selectedRole}
                        </h3>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300 shadow-lg shadow-emerald-500/10 uppercase tracking-tighter">
                          <ShieldCheck size={12} className="animate-pulse" />
                          PROQUELEC
                        </div>
                      </div>
                      <p className="text-slate-500 text-xs md:text-sm">
                        Cahier des charges opérationnel & technique
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportWord}
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 md:px-5 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border border-white/10 active:scale-95"
                    >
                      <Download size={14} className="text-orange-500" />
                      <span>PDF / DOCX</span>
                    </button>

                    {isAdmin &&
                      (isEditing ? (
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          <Save size={16} /> Enregistrer
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-all border border-slate-700 active:scale-95"
                        >
                          <Edit3 size={16} /> Éditer
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <section className="md:col-span-1">
                  {/* African Style Visual Card */}
                  <div className="relative group mb-8">
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                    <div className="relative aspect-[4/5] bg-slate-950 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/90 z-10" />
                      <img
                        src={currentTask.image}
                        alt={selectedRole}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />

                      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 z-20">
                        <div className="backdrop-blur-md bg-white/5 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                              <CurrentIcon size={18} />
                            </div>
                            <div>
                              <span className="block text-[8px] md:text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">
                                Guide Officiel
                              </span>
                              <span className="block text-sm md:text-lg font-bold text-white tracking-tight">
                                Réalisation : {selectedRole}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Technical Gallery for Standards */}
                  {currentTask.technicalImages && (
                    <div className="mt-8">
                      <div className="flex items-center space-x-2 mb-6">
                        <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                          Schémas & Standards Techniques
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentTask.technicalImages.map((img: any, idx: number) => (
                          <div
                            key={idx}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50"
                          >
                            <img
                              src={img.url}
                              alt={img.label}
                              className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
                              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                                {img.label}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 mb-6">
                    <div className="w-1 h-6 bg-red-500 rounded-full" />
                    <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                      Dispositions Générales du Marché
                    </h4>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 md:p-6 mb-8">
                    <ul className="space-y-3">
                      {GENERAL_CLAUSES.map((clause, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Shield size={14} className="text-red-500 mt-1 shrink-0" />
                          <span className="text-slate-400 text-xs leading-relaxed">{clause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <CahierSection title="Objet & Obligations Techniques" color="#3b82f6">
                    {isEditing ? (
                      <textarea
                        aria-label="Modifier les missions"
                        value={editData.missions}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, missions: e.target.value }))
                        }
                        className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                      />
                    ) : (
                      <ul className="space-y-6">
                        {currentTask.missions.map((m: string, i: number) => (
                          <li key={i} className="flex items-start space-x-3 group">
                            <CheckCircle2
                              size={18}
                              className="text-emerald-500 mt-0.5 shrink-0 transition-transform group-hover:scale-110"
                            />
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-300 text-sm leading-relaxed font-black uppercase tracking-tight">
                                {m.split(' : ')[0]}
                              </span>
                              <span className="text-slate-400 text-xs md:text-sm leading-relaxed">
                                {m.split(' : ')[1]}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CahierSection>
                </section>

                <section>
                  <CahierSection title="Dispositions Contractuelles" color="#6366f1">
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4">
                      {isEditing ? (
                        <textarea
                          title="Modifier l'introduction"
                          value={editData.introduction}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, introduction: e.target.value }))
                          }
                          className="w-full h-24 bg-slate-950 border border-indigo-500/30 rounded-xl p-3 text-indigo-200 text-sm focus:border-indigo-500 outline-none resize-none mb-4 italic"
                        />
                      ) : (
                        <p className="text-indigo-200 text-sm italic font-medium leading-relaxed">
                          {currentTask.introduction}
                        </p>
                      )}
                    </div>
                  </CahierSection>
                  <CahierSection title="Matériel & Moyens Logistiques" color="#f97316">
                    <div className="bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-slate-800 mb-6 font-display">
                      {isEditing ? (
                        <textarea
                          title="Modifier le matériel"
                          value={editData.materials}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, materials: e.target.value }))
                          }
                          className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentTask.materials.map((m: string, i: number) => (
                            <div
                              key={i}
                              className={`flex items-center space-x-3 bg-slate-900/40 text-slate-300 p-3 rounded-xl border border-white/5 text-xs font-bold transition-all hover:border-orange-500/30 ${m.startsWith('Materiel') || m.includes('Réalisation')
                                  ? 'sm:col-span-2 bg-orange-500/10 border-orange-500/20 text-orange-400 mt-2'
                                  : ''
                                }`}
                            >
                              <Package
                                size={14}
                                className={
                                  m.startsWith('Materiel') || m.includes('Réalisation')
                                    ? 'text-orange-500'
                                    : 'text-slate-500'
                                }
                              />
                              <span
                                className={
                                  m.startsWith('Materiel') || m.includes('Réalisation')
                                    ? 'uppercase tracking-wider'
                                    : ''
                                }
                              >
                                {m}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CahierSection>

                  <CahierSection title="Cadre Hygiène & Sécurité (HSE)" color="#f43f5e">
                    <div className="bg-rose-500/5 backdrop-blur-sm border border-rose-500/20 rounded-2xl p-4 md:p-5">
                      {isEditing ? (
                        <textarea
                          title="Modifier les règles HSE"
                          value={editData.hse}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, hse: e.target.value }))
                          }
                          className="w-full h-24 bg-slate-950 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-sm focus:border-rose-500 outline-none resize-none"
                        />
                      ) : (
                        <div className="space-y-3">
                          {currentTask.hse.map((h: string, i: number) => (
                            <div key={i} className="flex items-start space-x-3">
                              <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-1" />
                              <p className="text-[11px] md:text-xs text-rose-200/70 leading-relaxed font-bold">
                                {h}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CahierSection>

                  <CahierSection title="Dispositions Relatives à la Sous-traitance" color="#eab308">
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                      {isEditing ? (
                        <textarea
                          title="Modifier les clauses de sous-traitance"
                          value={editData.subcontracting}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, subcontracting: e.target.value }))
                          }
                          className="w-full h-32 bg-slate-950 border border-yellow-500/30 rounded-xl p-3 text-yellow-200 text-sm focus:border-yellow-500 outline-none resize-none"
                        />
                      ) : (
                        <ul className="space-y-3">
                          {currentTask.subcontracting?.map((clause: string, i: number) => (
                            <li key={i} className="flex items-start space-x-2">
                              <ShieldCheck size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                              <span className="text-yellow-200/90 text-xs font-bold leading-relaxed">
                                {clause}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CahierSection>

                  <CahierSection
                    title="Dispositions Financières, Cautions & Garanties"
                    color="#f59e0b"
                  >
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      {isEditing ? (
                        <textarea
                          aria-label="Modifier les clauses financières"
                          value={editData.finances}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, finances: e.target.value }))
                          }
                          className="w-full h-32 bg-slate-950 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-sm focus:border-amber-500 outline-none resize-none"
                        />
                      ) : (
                        <ul className="space-y-4">
                          {currentTask.finances?.map((f: string, i: number) => (
                            <li
                              key={i}
                              className="flex items-start space-x-3 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 shadow-inner"
                            >
                              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0 animate-pulse" />
                              <div>
                                <p className="text-amber-200 text-xs font-black uppercase tracking-tight">
                                  {f.split(' : ')[0]}
                                </p>
                                <p className="text-amber-100/70 text-[11px] leading-tight font-medium mt-1">
                                  {f.split(' : ')[1]}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CahierSection>

                  <CahierSection title="Configurations & Barèmes Contractuels" color="#10b981">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs text-emerald-400 uppercase font-bold">
                                  Tarif journalier (FCFA)
                                </label>
                                {automatedRate && (
                                  <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">
                                    <RefreshCw size={8} className="animate-spin-slow" />
                                    Sync Paramètres
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  title="Tarif journalier"
                                  value={editData.pricing.dailyRate}
                                  onChange={(e) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      pricing: {
                                        ...prev.pricing,
                                        dailyRate: e.target.valueAsNumber || 0,
                                      },
                                    }))
                                  }
                                  className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                                />
                                {automatedRate && editData.pricing.dailyRate !== automatedRate && (
                                  <button
                                    onClick={() =>
                                      setEditData((prev) => ({
                                        ...prev,
                                        pricing: { ...prev.pricing, dailyRate: automatedRate },
                                      }))
                                    }
                                    title={`Réinitialiser au tarif paramétré (${automatedRate})`}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400 p-1"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">
                                Effectif (Pers.)
                              </label>
                              <input
                                type="number"
                                aria-label="Effectif"
                                value={editData.pricing.personnelCount}
                                onChange={(e) =>
                                  setEditData((prev) => ({
                                    ...prev,
                                    pricing: {
                                      ...prev.pricing,
                                      personnelCount: e.target.valueAsNumber || 0,
                                    },
                                  }))
                                }
                                className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">
                                Durée (Jours)
                              </label>
                              <input
                                type="number"
                                title="Durée"
                                value={editData.pricing.durationDays}
                                onChange={(e) =>
                                  setEditData((prev) => ({
                                    ...prev,
                                    pricing: {
                                      ...prev.pricing,
                                      durationDays: e.target.valueAsNumber || 0,
                                    },
                                  }))
                                }
                                className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">
                              Clauses Pénales & Précisions
                            </label>
                            <textarea
                              title="Modifier les pénalités"
                              value={editData.pricing.penalties}
                              onChange={(e) =>
                                setEditData((prev) => ({
                                  ...prev,
                                  pricing: { ...prev.pricing, penalties: e.target.value },
                                }))
                              }
                              className="w-full h-20 bg-slate-950 border border-emerald-500/30 rounded-lg p-3 text-emerald-300 text-sm outline-none focus:border-emerald-500 resize-none"
                            />
                          </div>
                          <div className="pt-2 flex justify-end">
                            <div className="bg-emerald-500/20 px-4 py-2 rounded-lg border border-emerald-500/30">
                              <span className="text-xs text-emerald-400 font-bold uppercase mr-2">
                                Total Auto :
                              </span>
                              <span className="text-emerald-300 font-black">
                                {(
                                  editData.pricing.dailyRate *
                                  editData.pricing.personnelCount *
                                  editData.pricing.durationDays
                                ).toLocaleString()}{' '}
                                FCFA
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 relative">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs text-slate-500 uppercase font-bold">
                                  Prix Unitaire
                                </p>
                                {automatedRate &&
                                  currentTask.pricing?.dailyRate === automatedRate && (
                                    <span className="text-xs text-emerald-500/50 font-black uppercase tracking-tighter">
                                      Sync ✔
                                    </span>
                                  )}
                              </div>
                              <p className="text-emerald-400 font-bold">
                                {currentTask.pricing?.dailyRate?.toLocaleString()}{' '}
                                <span className="text-xs">{currentTask.pricing?.currency}</span>
                              </p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500 uppercase font-bold mb-1">
                                Ressources
                              </p>
                              <p className="text-white font-bold">
                                {currentTask.pricing?.personnelCount}{' '}
                                <span className="text-xs text-slate-400">Agents</span>
                              </p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500 uppercase font-bold mb-1">
                                Durée
                              </p>
                              <p className="text-white font-bold">
                                {currentTask.pricing?.durationDays}{' '}
                                <span className="text-xs text-slate-400">Jours</span>
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-emerald-500/10 pt-4">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-2">
                              Clauses de pénalités applicables
                            </p>
                            <p className="text-xs text-emerald-500/70 italic leading-relaxed">
                              "{currentTask.pricing?.penalties}"
                            </p>
                          </div>

                          <div className="flex items-center justify-between bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-tighter font-display">
                              Total Prévisionnel du Lot
                            </span>
                            <span className="text-xl font-black text-emerald-400 font-display">
                              {(
                                (currentTask.pricing?.dailyRate || 0) *
                                (currentTask.pricing?.personnelCount || 0) *
                                (currentTask.pricing?.durationDays || 0)
                              ).toLocaleString()}{' '}
                              {currentTask.pricing?.currency}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CahierSection>

                  <CahierSection title="Juridique & Responsabilité" color="#a855f7">
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-8">
                      <ul className="space-y-3">
                        {((currentTask as CahierTask).legal || []).map(
                          (item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 group">
                              <Scale
                                size={14}
                                className="text-purple-500 mt-1 shrink-0 transition-transform group-hover:scale-110"
                              />
                              <span className="text-slate-400 text-[11px] italic leading-relaxed">
                                {item}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </CahierSection>
                </section>
              </div>

              {/* SECTION INNOVATION FULL WIDTH */}
              <div className="mt-12 pt-12 border-t border-slate-800">
                <div className="flex items-center space-x-2 md:space-x-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <ShieldCheck size={24} className="text-indigo-400" />
                  </div>
                  <h4 className="text-base md:text-xl font-black text-indigo-300 uppercase tracking-widest leading-tight">
                    ARTICLE 5 – MODÈLE PROQUELEC INCLUSIF : PERFORMANCE & FLEXIBILITÉ
                  </h4>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-3xl p-6 md:p-10 mb-10 shadow-inner">
                  <p className="text-sm md:text-base text-indigo-200 leading-relaxed font-bold italic text-center max-w-5xl mx-auto">
                    "Il est expressément convenu que le Maître d’œuvre instaure un dispositif de
                    règlement basé sur la{' '}
                    <span className="text-white underline decoration-indigo-400">
                      Réception Finale PROQUELEC
                    </span>
                    . Toute validation rend les prestations éligibles au paiement sous réserve du
                    renseignement quotidien, exact et exhaustif des formulaires numériques via
                    Kobo."
                  </p>
                </div>

                <div className="space-y-6 mb-12">
                  {/* ART 5.1 */}
                  <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-900/60 border border-indigo-500/10 rounded-[2rem] p-8 md:p-10 transition-all hover:bg-slate-900/80 hover:border-indigo-500/30 group shadow-2xl">
                    <div className="w-20 h-20 shrink-0 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <ShieldCheck size={40} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <span className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] block mb-3">
                        ART 5.1 – RÉCEPTION FINALE ET VALIDATION TECHNIQUE
                      </span>
                      <p className="text-sm md:text-base text-slate-400 leading-relaxed">
                        La réception finale est prononcée par{' '}
                        <span className="text-indigo-300 font-bold">PROQUELEC</span> après
                        vérification de la conformité aux exigences contractuelles. Elle peut être
                        prononcée <span className="text-indigo-200 italic">sans réserve</span>{' '}
                        (validation définitive) ou{' '}
                        <span className="text-indigo-200 italic">avec réserves</span> (délai de
                        levée fixé par le Chef de Projet). La validation est matérialisée par le
                        statut{' '}
                        <span className="text-white font-bold italic">
                          « Réceptionné conforme »
                        </span>{' '}
                        dans GEM.
                      </p>
                    </div>
                    <div className="shrink-0 bg-indigo-500/20 px-6 py-3 rounded-2xl border border-indigo-500/30 shadow-lg min-w-[160px] text-center">
                      <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">
                        Réception Conforme
                      </span>
                    </div>
                  </div>

                  {/* ART 5.2 */}
                  <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-900/60 border border-indigo-500/10 rounded-[2rem] p-8 md:p-10 transition-all hover:bg-slate-900/80 hover:border-indigo-500/30 group shadow-2xl">
                    <div className="w-20 h-20 shrink-0 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <Zap size={40} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <span className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] block mb-3">
                        ART 5.2 – OBLIGATION DE SAISIE DES DONNÉES (KOBO)
                      </span>
                      <p className="text-sm md:text-base text-slate-400 leading-relaxed">
                        Le Titulaire assure le renseignement{' '}
                        <span className="text-indigo-300 font-bold">
                          quotidien, exact et exhaustif
                        </span>{' '}
                        des formulaires Kobo. Ces données constituent la base contractuelle de
                        liquidation des prestations. Toute absence, incohérence ou falsification des
                        données peut entraîner la suspension du paiement ou le rejet des prestations
                        concernées.
                      </p>
                    </div>
                    <div className="shrink-0 bg-indigo-500/20 px-6 py-3 rounded-2xl border border-indigo-500/30 shadow-lg min-w-[160px] text-center">
                      <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">
                        Base Contractuelle
                      </span>
                    </div>
                  </div>

                  {/* ART 5.3 */}
                  <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-900/60 border border-indigo-500/10 rounded-[2rem] p-8 md:p-10 transition-all hover:bg-slate-900/80 hover:border-indigo-500/30 group shadow-2xl">
                    <div className="w-20 h-20 shrink-0 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <Scale size={40} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <span className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] block mb-3">
                        ART 5.3 – RETENUE DE GARANTIE ET CAUTIONNEMENTS
                      </span>
                      <p className="text-sm md:text-base text-slate-400 leading-relaxed">
                        Une retenue de garantie est appliquée sur les paiements (taux de 5% à 10%).
                        Le Titulaire peut substituer cette retenue par une caution délivrée par une
                        compagnie d’assurance agréée, notamment{' '}
                        <span className="text-indigo-300 font-bold">SONAM, ASKIA Assurances</span>{' '}
                        ou toute autre structure validée par PROQUELEC.
                      </p>
                    </div>
                    <div className="shrink-0 bg-indigo-500/20 px-6 py-3 rounded-2xl border border-indigo-500/30 shadow-lg min-w-[160px] text-center">
                      <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">
                        Caution Agréée
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-16">
                  <button
                    onClick={handleExportWord}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-blue-500/40 active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                  >
                    <FileText size={24} />
                    EXPORTER LE BORDEREAU CONTRACTUEL (.DOCX)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 pt-12 border-t border-white/5 pb-12">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                <div className="flex flex-col items-center justify-center min-h-[100px]">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    VISA DIRECTION PROQUELEC
                  </span>
                  <div className="mt-8 w-32 h-px bg-slate-800" />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                <div className="flex flex-col items-center justify-center min-h-[100px]">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center">
                    VISA PRESTATAIRE ({selectedRole.toUpperCase()})
                  </span>
                  <div className="mt-8 w-32 h-px bg-slate-800" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
