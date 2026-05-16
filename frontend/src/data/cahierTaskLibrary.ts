import { Zap, Home, Network, Truck, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { TaskLibrary } from '@utils/types';

export const ROLE_TO_TRADE_MAPPING: Record<string, string> = {
  Maçonnerie: 'macons',
  'Réseau Extérieur': 'reseau',
  Électricien: 'interieur_type1',
  Logistique: 'logistics',
  'Audit & Contrôle Qualité (PROQUELEC)': 'controle',
  'Contrôle & Validation': 'controle',
  Préparateur: 'preparateurs',
};

export const DEFAULT_TASK_LIBRARY: TaskLibrary = {
  Électricien: {
    color: 'blue',
    icon: Zap as any,
    image: '/assets/images/installation-terre.png',
    defaultCadence: 'Cadence : 3-5 Foyers / Jour',
    introduction:
      'ARTICLE 1 - OBJET ET NORMES : Le présent lot couvre l’installation électrique intérieure complète des ménages éligibles, incluant le Kit Principal & Secondaire, la pose du disjoncteur de branchement, et la réalisation des tranchées, le tout conforme aux normes NFC 15-100, NS 01-001, et à la doctrine Senelec. Le Titulaire garantit la conformité de l’installation aux règles de l’art et aux exigences du présent Cahier des Charges, sous peine de rejet et de pénalités.',
    missions: [
      'ART 1.1 - DIVISIONNAIRE PRINCIPAL : Pose d’un disjoncteur de branchement 5/15A, certifié et scellé, assurant la protection et le sectionnement de l’installation intérieure. Le disjoncteur doit être conforme à la norme NFC 15-100 et porter le marquage CE.',
      'ART 1.2 - TABLEAU MODULAIRE : Montage d’un coffret modulaire équipé d’un différentiel 25A/30mA et de modulaires C10/C20 certifiés, avec étiquetage clair des circuits. Le tableau doit être fixé à 1,50 m du sol et protégé contre les intempéries.',
      'ART 1.3 - MISE À LA TERRE : Réalisation obligatoire d’un dispositif de terre conforme à la NS 01-001, incluant un piquet en acier cuivré de 1,5 m, une barrette de coupure accessible, et un conducteur en cuivre nu Ø25 mm2. La résistance de terre mesurée doit être < 1500 Ohms pour un dispositif différentiel de 30mA. Toute valeur supérieure entraîne une reprise immédiate aux frais du Titulaire.',
      'ART 1.4 - GÉNIE CIVIL LÉGER : Réalisation des tranchées pour le passage des câbles (profondeur minimale 50 cm, largeur 30 cm), avec enfouissement sécurisé de la prise de terre et protection mécanique des câbles. Les tranchées doivent être rebouchées avec du sable compacté et signalées par un ruban avertisseur.',
      'ART 1.5 - REPORTING JOURNALIER : Le Chef d’équipe est responsable de la mise à jour quotidienne, avant 18h00, du formulaire Kobo intégré à GED OS-PROQUELEC, incluant : état d’avancement (en %), photographies géolocalisées des ouvrages, liste des matériaux utilisés, et incidents éventuels. Toute omission ou retard entraîne une pénalité de 2% du montant journalier du lot.',
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
    technicalImages: [
      {
        url: '/assets/images/schema-principe-installation-monophasee.png',
        label: 'Synoptique séquentiel - installation monophasée',
        notes: [
          {
            title: '1. Arrivée et comptage',
            lines: [
              'Réseau monophasé 230 V ~ 50 Hz.',
              'Câble préassemblé 2x16 mm2 vers le coffret de comptage extérieur.',
              'Coffret de comptage avec compteur monophasé DTM96 et coupe-circuit monophasé.',
              'Sortie du coupe-circuit vers le coffret principal par câble armé 2x4 mm2.',
            ],
          },
          {
            title: '2. Coffret principal',
            lines: [
              'Disjoncteur général 63/15 A type Baco.',
              'Interrupteur différentiel 30 mA type AC.',
              'Deux disjoncteurs modulaires : C10 A pour lumières, C16 A pour prises et secondaire.',
              'Bornier triplet : rouge phase, bleu neutre, vert/jaune terre.',
            ],
          },
          {
            title: '3. Circuits terminaux',
            lines: [
              'Circuit lumières : C10 A, câble armé 3x1,5 mm2 vers lampes et interrupteurs.',
              'Circuit prises : C16 A, câble armé 3x2,5 mm2 vers prises murales.',
              'Circuit secondaire : C16 A, câble armé 3x2,5 mm2 vers boîte secondaire.',
              'Chaque départ est identifié sur le bornier phase, neutre et terre.',
            ],
          },
          {
            title: '4. Mise à la terre',
            lines: [
              'Bornier de terre interne vers conducteur vert/jaune 6 mm2.',
              'Conducteur vers barrette de terre extérieure.',
              'Barrette de terre vers piquet par fil cuivre nu 25 mm2.',
              'Tous les conducteurs PE des circuits terminaux sont reliés au bornier de terre.',
            ],
          },
        ],
        legend: ['Rouge = Phase (L)', 'Bleu = Neutre (N)', 'Vert/Jaune = Terre (PE)'],
      },
    ],
    koboGuide: [
      {
        title: 'Étape intérieure dans Kobo',
        intro:
          "Le formulaire Kobo n'ouvre la validation intérieure qu'après confirmation du branchement conforme.",
        checks: [
          "Confirmer que le branchement est réalisé et conforme avant de commencer l'installation intérieure.",
          "Renseigner l'état de l'installation intérieure et compléter les observations libres si un écart n'entre pas dans les choix prédéfinis.",
          "Valider la fin d'étape uniquement lorsque l'installation intérieure est terminée et contrôlable.",
        ],
        blockers: [
          'Branchement non réalisé.',
          'Branchement non conforme.',
          'Installation intérieure encore incomplète au moment de la validation Kobo.',
        ],
      },
      {
        title: 'Tableau, protections et séparation des circuits',
        checks: [
          "Présence d'un disjoncteur général en tête d'installation.",
          'Type de disjoncteur général correctement identifié et installation protégée par DDR 30 mA.',
          "Protection à l'origine de chaque circuit avec séparation claire entre lumière et prise.",
        ],
        blockers: [
          'Absence de disjoncteur général.',
          'Différentiel 30 mA absent, détérioré ou mal positionné.',
          'Absence de modulaire lumière ou prise, ou calibre non adapté.',
        ],
      },
      {
        title: 'Appareillage, câblage et finition de pose',
        checks: [
          'Coffret, prises, interrupteurs, boîtes et câbles correctement posés, fixés et protégés.',
          'Code couleur des conducteurs respecté et aucun point nu sous tension accessible.',
          "Câble d'alimentation enterré, adapté au sol et section minimale respectée.",
        ],
        blockers: [
          'Boîte de dérivation sans couvercle ou absente.',
          'Prise, interrupteur ou douille détérioré, mal fixé ou mal câblé.',
          'Câble 1,5 mm2 ou 2,5 mm2 jonctionné par épissure.',
          "Câblage intérieur passé en aérien, mal fixé ou section d'alimentation inférieure au minimum requis.",
          'Coffret disjoncteur mal fixé ou placé hors zone couverte.',
        ],
      },
      {
        title: 'Protection mécanique et réseau de terre',
        checks: [
          'Aucun conducteur visible sur les câbles 1,5 mm2, 2,5 mm2 et 4 mm2.',
          'Conducteur principal vert/jaune protégé mécaniquement sur tout son parcours.',
          'Piquet, barrette, dominos et continuité du réseau de terre contrôlés.',
          'Valeur de résistance de terre ou de boucle renseignée dans Kobo.',
        ],
        blockers: [
          'Absence de piquet de terre ou de barrette de terre.',
          'Terre non raccordée au coffret ou à la boîte de dérivation.',
          'Piquet déconnecté ou réseau de terre non raccordé.',
          'Absence de continuité du conducteur de protection.',
        ],
        completion: [
          'La validation finale intérieure suppose une terre complète, continue et mesurée dans le formulaire.',
        ],
      },
    ],
    subcontracting: [
      "ART 4.1 - RESPONSABILITÉ : Le Titulaire reste pleinement responsable de la conformité des installations, même en cas de sous-traitance. Il doit obtenir l'accord écrit du Maître d'Ouvrage pour toute sous-traitance et vérifier que le sous-traitant dispose des certifications requises (qualification Senelec, assurance RC Pro).",
    ],
    finances: [
      'ART 5.1 - VALIDATION PAR RÉCEPTION FINALE : La réception finale, prononcée par PROQUELEC après vérification de la conformité aux exigences contractuelles, déclenche l\'exigibilité du paiement. Elle est matérialisée par le statut "Réceptionné conforme" dans GED OS-PROQUELEC et la signature d\'un PVR.',
      "ART 5.2 - OBLIGATION DE SAISIE KOBO : Le Titulaire a l'obligation contractuelle de renseigner quotidiennement le formulaire Kobo avant 18h00. Le Chef de Projet assure la liquidation des règlements hebdomadaires sur la base des données validées dans GED OS-PROQUELEC.",
      "ART 5.3 - CAUTIONNEMENT FLEXIBLE : La retenue de garantie est limitée à 5-10% du montant des prestations. Le Titulaire peut la substituer par une caution d'assurance délivrée par une compagnie agréée (SONAM, ASKIA), sous réserve de transmission de l’attestation correspondante.",
    ],
    legal: [
      'ART E.1 - RESPONSABILITÉ TECHNIQUE : L’électricien est responsable de la conformité totale de l’installation intérieure aux normes NFC 15-100 et NS 01-001. Toute non-conformité engage sa responsabilité civile et pénale.',
      'ART E.2 - RISQUE ÉLECTRIQUE : Toute installation non sécurisée engage sa responsabilité en cas d’incendie, d’électrocution ou de dommage matériel, conformément au Code pénal sénégalais.',
      'ART E.3 - MISE À LA TERRE : L’absence ou la défaillance du systeme de terre (résistance > 1500 Ohms, conducteur section insuffisante) constitue une faute grave, entraînant le rejet de l’ouvrage et l’application de pénalités de 15% du montant du lot par jour de retard dans la correction.',
      'ART E.5 - ESSAIS OBLIGATOIRES : Avant validation, des essais de continuité, d’isolement (R > 0,5 MOhms) et de déclenchement du différentiel (IΔn <= 30 mA) doivent être réalisés et consignés dans GED OS-PROQUELEC. Leur absence entraîne le rejet systématique de l’ouvrage.',
    ],
    pricing: {
      dailyRate: 25000,
      personnelCount: 5,
      durationDays: 20,
      penalties:
        '**PÉNALITÉS POUR RETARD OU NON-CONFORMITÉ**\n- **Retard de réalisation** : 5% du montant du lot par semaine de retard (plafonné à 20%).\n- **Non-conformité majeure** (ex : absence de mise à la terre, résistance > 1500 Ohms) : 10% du montant du lot **par jour** jusqu’à correction, sans dépasser 50% du montant total.\n- **Absence de reporting quotidien (Kobo/GED OS-PROQUELEC)** : 2% du montant journalier du lot par omission, avec blocage des paiements jusqu’à régularisation.\n- **Falsification des données** (ex : photos truquées, essais non réalisés) : Résiliation immédiate du marché + pénalités de 100% du montant du lot concerné.\n- **Non-respect des EPI** : Arrêt immédiat des travaux + pénalité de 5% du montant journalier du lot par infraction constatée.',
      currency: 'FCFA',
    },
  },
  Maçonnerie: {
    color: 'orange',
    icon: Home as any,
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
      "**HSE 2.5 - PREMIERS SECOURS** : Présence obligatoire d'une trousse de secours (norme NF EN 12870) et d'un point d'eau potable on chaque chantier. Leur absence est passible d'une pénalité de 5% du montant journalier du lot.",
    ],
    legal: [
      'ART M.1 - STABILITÉ MÉCANIQUE : Le maçon est responsable de la stabilité des ouvrages réalisés. Toute fissuration (> 0,2 mm) ou tout affaissement détecté dans les 30 jours suivant la réception entraîne une reprise intégrale aux frais du Titulaire.',
      'ART M.2 - SUPPORT DES COFFRETS : Tout défaut du support (muret, socle) affectant la fixation ou l’étanchéité du coffret de comptage engage la responsabilité décennale du Titulaire.',
      'ART M.3 - DOSAGE DU BÉTON : Le non-respect des dosages prescrits (350 kg/m3 pour les fondations, 1:2:4 pour les enduits) constitue une non-conformité majeure, entraînant le rejet de l’ouvrage et des pénalités de 10% par jour de retard dans la correction.',
      'ART M.4 - FISSURATION POST-RÉCEPTION : Toute fissuration apparue dans les 12 mois suivant la réception engage la responsabilité du Titulaire et donne lieu à une reprise gratuite sous 15 jours, sous peine de pénalités de 5% par semaine de retard.',
    ],
    finances: [
      'ART 5.1 - VALIDATION PAR RÉCEPTION FINALE : La réception finale est prononcée par PROQUELEC après vérification de la conformité dimensionnelle, mécanique et esthétique des murets. Elle est matérialisée par le statut "Réceptionné conforme" dans GED OS-PROQUELEC et la signature d’un PVR.',
      'ART 5.2 - OBLIGATION KOBO : Saisie quotidienne obligatoire des murets réalisés (dimensions, photos, contrôles) pour permettre le pilotage de la trésorerie par le Chef de Projet via GED OS-PROQUELEC. Toute absence de saisie entraîne un blocage des paiements jusqu’à régularisation.',
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
    icon: Network as any,
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
    koboGuide: [
      {
        title: 'Prérequis avant branchement',
        intro:
          "Le groupe Kobo réseau commence par la conformité du mur et l'état global du branchement avant tout contrôle détaillé.",
        checks: [
          'Vérifier et déclarer la conformité du mur avant toute pose réseau.',
          "Renseigner l'état du branchement puis joindre une photo d'anomalie si un écart existe.",
          "Escalader le dossier dès qu'une extension réseau est nécessaire.",
        ],
        blockers: [
          'Mur non réalisé ou non conforme.',
          'Coffret compteur non encore posé.',
          'Potelet non encore posé.',
          'Câble préassemblé non encore tiré.',
        ],
      },
      {
        title: 'Position, longueur et hauteur du branchement',
        checks: [
          'Contrôler la position et la longueur du branchement selon le contexte urbain ou rural.',
          'Contrôler la hauteur du branchement et la hauteur du coffret.',
          'Maintenir le hublot du coffret dans la plage 1,20 m à 1,60 m.',
        ],
        blockers: [
          'Branchement au-delà de la position 2 en zone urbaine.',
          'Branchement au-delà de la position 3 en zone rurale.',
          'Longueur supérieure à 40 m en zone urbaine ou 50 m en zone rurale.',
          'Hauteur du coffret inférieure à 1,20 m ou supérieure à 1,60 m.',
        ],
      },
      {
        title: 'Coupe-circuit, protection PVC et mode de pose',
        checks: [
          "Présence d'un coupe-circuit en bon état avec calibre maîtrisé.",
          'Protection mécanique de la descente par tube PVC sur toute la longueur.',
          'Mode de pose propre : coffret en limite de propriété, câble non jonctionné, potelet stable.',
        ],
        blockers: [
          'Absence ou détérioration du coupe-circuit, ou calibre fusible supérieur à 25 A.',
          'Pas de tube PVC ou protection mécanique incomplète sur la descente.',
          'Coffret percé ou posé à l’intérieur de la propriété.',
          'Câble préassemblé jonctionné.',
          "Potelet trop incliné, absence de pince d'ancrage ou de queue de cochon.",
        ],
      },
      {
        title: 'Validation Kobo de fin d’étape',
        checks: [
          'Ne cocher la validation finale que si le branchement est terminé, conforme et transmissible au lot intérieur.',
          'Renseigner toutes les observations libres quand le défaut constaté dépasse les choix proposés.',
        ],
        completion: [
          'Une validation finale réseau correspond à un mur conforme, un coffret correctement posé et un branchement extérieur sans réserve bloquante.',
        ],
      },
    ],
    legal: [
      'ART R.1 - INTÉGRITÉ DU RÉSEAU SENELEC : Toute dégradation du réseau Senelec (poteaux, câbles, hublots) imputable au Titulaire sera réparée à ses frais, sous 48h après notification, sous peine de pénalités de 20% du montant du lot par jour de retard.',
      'ART R.2 - DISTANCES DE SÉCURITÉ : Le non-respect des distances minimales (3 m au-dessus des voies, 1 m en propriété privée) ou des règles de tension mécanique des câbles constitue une faute grave, entraînant le rejet du branchement et une pénalité de 15% du montant du lot.',
      'ART R.3 - BRANCHEMENT ILLICITE : Tout branchement non conforme aux plans validés ou réalisé sans autorisation est strictement interdit. En cas de fraude avérée, le Titulaire sera exclu du marché et poursuivi conformément au Code pénal sénégalais.',
      'ART R.4 - SÉCURITÉ PUBLIQUE : Le Titulaire est responsable des risques pour les tiers (chute de câble, électrocution) liés à ses installations. Il doit souscrire une assurance spécifique couvrant ces risques et en fournir la preuve avant le démarrage des travaux.',
    ],
    finances: [
      'ART 5.1 - RÉCEPTION FINALE : Paiement hebdomadaire à l\'unité (par branchement) après réception finale par PROQUELEC et obtention du statut "Réceptionné conforme" dans GED OS-PROQUELEC. Le PVR signé est obligatoire pour le déclenchement du paiement.',
      "ART 5.2 - FACILITATION GED OS : Le systeme GED OS-PROQUELEC permet un suivi en temps réel des flux de trésorerie, sur la base des formulaires Kobo renseignés quotidiennement par le prestataire. Les retards de saisie bloquent les paiements jusqu'à régularisation.",
    ],
    pricing: {
      dailyRate: 40000,
      personnelCount: 2,
      durationDays: 15,
      penalties:
        "**PÉNALITÉS POUR NON-RESPECT DES NORMES DE SÉCURITÉ ET DE DÉLAIS**\n- **Retard de branchement** : 10% du montant du lot par semaine (plafonné à 30%).\n- **Non-respect des distances de sécurité** (ex : câble à < 3 m au-dessus d'une voie) : Reprise immédiate + 15% du montant du lot par jour jusqu'à conformité.\n- **Absence de harnais en hauteur** : Arrêt immédiat des travaux + pénalité de 20% du montant journalier du lot.\n- **Branchement non conforme** (ex : absence de coupe-circuit) : Refus de mise en service par Senelec + 10% du montant du lot par jour de retard.\n- **Non-tracabilité des livraisons** (Kobo/GED OS-PROQUELEC) : Blocage des paiements + 3% du montant journalier du lot par omission.\n- **Dégâts sur le réseau Senelec** : Réparation aux frais du Titulaire sous 48h, sinon pénalités de 20% du montant du lot par jour.",
      currency: 'FCFA',
    },
  },
  Logistique: {
    color: 'amber',
    icon: Truck as any,
    image: '/assets/images/livreur-distribution.png',
    defaultCadence: 'Flux : 20-30 Ménages / Jour',
    introduction:
      "ARTICLE 1 - OBJET : Gestion des flux de matériel, transport sécurisé, tracabilité des équipements, et gestion des rebuts, conformément aux exigences de tracabilité numérique du projet. Le Titulaire garantit la livraison intacte et dans les délais des matériaux, ainsi que leur stockage sécurisé sur les sites d'intervention.",
    missions: [
      'ART 4.1 - TRACABILITÉ NUMÉRIQUE : Enregistrement systématique des mouvements de stock (entrées/sorties) dans GED OS-PROQUELEC via les identifiants NumeroOrdre, avec scan des codes-barres et géolocalisation des livraisons. Toute discordance entre les stocks physiques et numériques entraîne un audit immédiat et des pénalités de 5% du montant du lot concerné.',
      "ART 4.2 - TRANSPORT SÉCURISÉ : Acheminement des matériaux vers les sites d'intervention avec arrimage certifié des bobines (sangle 2T, protection anti-abrasion), respect des limites de vitesse (40 km/h en zone habitée), et signalisation du convoi. Les véhicules doivent être équipés de systèmes de géolocalisation et de kits de sécurité (extincteurs, trousses de secours).",
      'ART 4.3 - GESTION DES REBUTS : Récupération et tri des chutes de câbles, emballages et matériaux usagés pour traitement centralisé (recyclage ou élimination conforme). Un bordereau de suivi des déchets doit être établi et transmis hebdomadairement au Chef de Projet.',
      'ART 4.4 - CONTRÔLE DES FLUX : Reporting quotidien des quantités livrées vs prévisionnel, avec alerte immédiate en cas de risque de rupture. Les écarts > 10% doivent être justifiés sous 24h, sous peine de pénalités de 3% du montant du lot.',
      "ART 4.5 - REPORTING JOURNALIER : Le Chef d'équipe logistique doit mettre à jour quotidiennement les flux et livraisons dans le formulaire Kobo, incluant : heures de départ/arrivée, kilométrage, état des matériaux à la livraison, et incidents éventuels. Toute omission entraîne une pénalité de 2% du montant journalier du lot.",
    ],
    materials: [
      '- Véhicules de transport équipés (géolocalisation, arrimage certifié, extincteurs)',
      '- Systèmes de protection des bobines (sangles, bâches, caisses de transport)',
      '- Terminaux mobiles de scan et logiciels de tracabilité (GED OS-PROQUELEC, Kobo)',
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
      "ART L.1 - RESPONSABILITÉ DU TRANSPORT : Le Titulaire est responsable des équipements et matériaux du départ du dépôt jusqu'à leur réception sur site. Toute perte, vol ou détérioration sera facturée au prix du marché majoré de 20%.",
      "ART L.2 - TRACABILITÉ OBLIGATOIRE : Toute sortie de matériel doit être enregistrée dans GED OS-PROQUELEC avant le départ du dépôt. L'absence de tracabilité bloque les paiements jusqu'à régularisation.",
      "ART L.3 - GESTION DES DÉCHETS : Le non-respect des procédures de tri et d'élimination des rebuts (câbles, emballages) entraîne une pénalité de 5% du montant du lot et peut donner lieu à une exclusion du marché pour non-respect des normes environnementales.",
      "ART L.4 - STOCKAGE SÉCURISÉ : Les matériaux doivent être stockés sur site dans des conditions préservant leur intégrité (abri, protection contre l'humidité). Tout dommage dû à un stockage défectueux est à la charge du Titulaire.",
    ],
    finances: [
      'ART 5.1 - PAIEMENT : Règlement hebdomadaire après réception finale des flux de matériel et validation des données dans GED OS-PROQUELEC par le Chef de Projet. Les bordereaux de livraison signés et les preuves de tracabilité sont obligatoires.',
      "ART 5.2 - OBLIGATION KOBO : La tracabilité des livraisons via les formulaires Kobo est obligatoire pour déclencher les facilités de trésorerie. Toute absence de saisie bloque les paiements jusqu'à régularisation.",
      "ART 5.3 - GARANTIE : Retenue de garantie limitée à 5-10%, libérable par caution d'assurance (SONAM/ASKIA) sur présentation de l'attestation correspondante.",
    ],
    pricing: {
      dailyRate: 35000,
      personnelCount: 2,
      durationDays: 15,
      penalties:
        '**PÉNALITÉS POUR PERTE, RETARD OU NON-TRACABILITÉ**\n- **Perte ou endommagement de matériel** : Remboursement au prix du marché majoré de 20% + pénalité de 10% du montant du lot par unité perdue.\n- **Retard de livraison** (> 24h) : 5% du montant du lot par jour de retard (plafonné à 30%).\n- **Non-respect des procédures de tracabilité** (Kobo/GED OS-PROQUELEC) : Blocage des paiements + 5% du montant journalier du lot par omission.\n- **Excès de vitesse ou infraction routière** : 5% du montant journalier du lot par infraction, cumulable en cas de récidive.\n- **Transport de passagers non autorisés** : Immobilisation du véhicule + pénalité de 10% du montant du lot.\n- **Non-gestion des rebuts** (câbles, emballages) : Pénalité de 7% du montant du lot + obligation de nettoyage aux frais du Titulaire.',
      currency: 'FCFA',
    },
  },
  'Audit & Contrôle Qualité (PROQUELEC)': {
    color: 'emerald',
    icon: ShieldCheck as any,
    image: '/assets/images/controleur-final.png',
    defaultCadence: 'Cadence : Selon volume / Jour',
    introduction:
      "ARTICLE 1 - OBJET : Surveillance, essai et validation finale de l'ensemble des ouvrages (Génie Civil, Réseau, Intérieur) pour garantir leur conformité aux normes techniques (NFC 15-100, NS 01-001, doctrine Senelec) et aux exigences du présent Cahier des Charges. Le contrôleur PROQUELEC agit en totale indépendance et son avis est souverain pour la réception des travaux.",
    missions: [
      "ART 5.1 - AUDIT MAÇONNERIE : Vérification de la verticalité des murs (+/- 2 mm/m), du dosage du béton (350 kg/m3 pour les fondations), de la solidité mécanique des potelets, et de l'étanchéité des coffrets. Les essais de charge (1,5x la charge nominale) sont réalisés en présence du Titulaire.",
      "ART 5.2 - AUDIT RÉSEAU : Contrôle du branchement (tension mécanique du câble, présence et calibrage du coupe-circuit, étanchéité du hublot Senelec). Les mesures de résistance d'isolement (R > 0,5 MOhms) et de continuité sont consignées dans GED OS-PROQUELEC.",
      "ART 5.3 - AUDIT ÉLECTRICIEN : Test de déclenchement du différentiel 30mA, vérification du disjoncteur 5/15A, et mesure de la résistance de terre (< 1500 Ohms). Les essais sont réalisés conformément à la norme NFC 15-100 et leurs résultats sont transmis au Maître d'Ouvrage sous 24h.",
      "ART 5.4 - CONFORMITÉ LOT 24 : Inspection visuelle des gaines, canalisations et fixations pour prévenir tout risque d'incendie ou d'électrocution. Les non-conformités sont consignées dans un Procès-Verbal de Non-Conformité (PVNC) et notifiées au Titulaire sous 48h.",
      "ART 5.5 - VALIDATION NUMÉRIQUE : Signature électronique du PV de réception dans Kobo/GED OS-PROQUELEC, incluant les photographies géolocalisées des ouvrages, les résultats des essais, et l'avis du contrôleur. Ce PV est une condition préalable à tout paiement.",
    ],
    materials: [
      '- Tablette tactile avec applications GED OS-PROQUELEC/Kobo (géolocalisation, signature électronique)',
      '- Multimètre et telluromètre (étalonnés, certificat de conformité valide)',
      "- VAT (Vérificateur d'Absence de Tension) conforme à la norme NFC 18-510",
      '- Appareil photo haute résolution avec horodatage et géolocalisation.',
    ],
    hse: [
      '**HSE 5.1 - ÉQUIPEMENTS DE PROTECTION** : Port obligatoire des EPI de catégorie 3 (combinaison anti-arc, gants isolants 1000V, casque avec jugulaire) et vérification de leur conformité avant chaque intervention.',
      "**HSE 5.2 - VÉRIFICATION D'ABSENCE DE TENSION** : Utilisation systématique d'un VAT (norme NFC 18-510) avant tout contact avec une installation électrique. Le non-respect de cette procédure est considéré comme une faute grave.",
      "**HSE 5.3 - SÉCURITÉ EN HAUTEUR** : Pour les contrôles en hauteur, utilisation obligatoire d'un harnais (norme EN 361) et d'une ligne de vie. Les infractions sont sanctionnées par une pénalité de 20% des honoraires journaliers.",
      "**HSE 5.4 - SIGNALISATION DES ZONES DE CONTRÔLE** : Balisage des ouvrages en attente de validation et isolement des zones non conformes. L'absence de signalisation expose à une pénalité de 5% des honoraires journaliers.",
      "**HSE 5.5 - FORMATION ET HABILITATION** : Le contrôleur doit être titulaire d'une habilitation électrique (BR ou BC) en cours de validité. Son absence est passible d'une de exclusion du marché et de poursuites pour exercice illégal.",
    ],
    legal: [
      'ART C.1 - INDÉPENDANCE DU CONTRÔLEUR : Le contrôleur PROQUELEC agit de manière autonome et indépendante des équipes de réalisation. Ses décisions sont souveraines et ne peuvent faire l’objet de pression ou d’influence.',
      'ART C.2 - POUVOIR DE REFUS : Tout ouvrage non conforme aux normes ou présentant un risque pour la sécurité est rejeté jusqu’à reprise complète et validation par PROQUELEC. Le Titulaire ne peut contester ce rejet sans preuve écrite de conformité.',
      'ART C.3 - CERTIFICATION FINALE : La validation dans GED OS-PROQUELEC par le contrôleur PROQUELEC constitue le seul acte déclenchant le processus de paiement. Aucune réception verbale ou partielle n’est opposable au Maître d’Ouvrage.',
      'ART C.4 - RESPONSABILITÉ DU CONTRÔLEUR : Le contrôleur engage sa responsabilité en cas de validation d’un ouvrage dangereux ou non conforme. Il doit signaler toute tentative de fraude ou de falsification des données.',
    ],
    finances: [
      'ART 5.1 - HONORAIRES : Règlement basé sur le volume d’ouvrages audités et validés, selon un barème fixe par type de contrôle (maçonnerie, réseau, électricité). Les honoraires sont dus dès la signature du PV de réception.',
      'ART 5.2 - FACILITATION GED OS : Utilisation de GED OS-PROQUELEC pour le suivi des audits et l’accélération des validations. Les retards de saisie des rapports bloquent les paiements jusqu’à régularisation.',
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
