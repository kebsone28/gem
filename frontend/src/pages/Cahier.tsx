import { useState, useEffect, useMemo } from 'react';
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
    RefreshCw,
    ShieldCheck,
    Shield,
    Scale,
    FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../hooks/useProject';
import { useTeams } from '../hooks/useTeams';
import { exportCahiersToWord } from '../utils/exportWord';
import * as safeStorage from '../utils/safeStorage';
import './Cahier.css';

// Import centralized design system
import {
    PageContainer,
    PageHeader,
    ContentArea,
    ActionBar
} from '../components';

const GENERAL_CLAUSES = [
    "ART 0.1 - PIÈCES CONTRACTUELLES : Le présent cahier des charges, les plans types, les bordereaux quantitatifs et estimatifs (BQE), ainsi que les normes en vigueur (NS 01-001, NFC 15-100, NFC 11-201, doctrine Senelec) constituent les pièces contractuelles opposables au Titulaire.",
    "ART 0.2 - ORDRE DE PRIORITÉ : En cas de contradiction entre les pièces, l'ordre de priorité décroissant est le suivant : 1. Le présent Cahier des Charges ; 2. Les plans techniques validés ; 3. Les normes techniques nationales et internationales.",
    "ART 0.3 - TRAÇABILITÉ NUMÉRIQUE & PREUVE : Toutes les opérations techniques et administratives sont impérativement tracées dans le système GEM-SAAS. Les horodatages et données numériques issus du système font foi entre les parties en cas de litige.",
    "ART 0.4 - OBLIGATION DE RÉSULTAT GLOBALE : Le Titulaire est tenu à une obligation de résultat. Il assume la pleine responsabilité de la conformité finale des ouvrages aux règles de l'art.",
    "ART 0.5 - CERTIFICATION LABEL PROQUELEC : Tout ouvrage validé sans réserve par l'audit GEM bénéficie du Label Qualité PROQUELEC. Tout manquement grave entraîne le retrait immédiat de cette certification et l'exclusion des marchés futurs."
];

const DEFAULT_TASK_LIBRARY = {
    'Préparateur': {
        icon: BoxIcon,
        color: 'indigo',
        image: '/assets/images/preparateur-atelier.png',
        introduction: "ARTICLE 1 - OBJET ET PÉRIMÈTRE TECHNIQUE : Le Titulaire assume la pleine responsabilité de la préparation, de l'assemblage et de la certification interne des kits électriques. Les prestations incluent l'audit amont des composants, le montage modulaire et le conditionnement hermétique garantissant l'intégrité des matériels jusqu'au site de pose.",
        missions: [
            'ART 2.1 - CONTRÔLE QUALITÉ DES COMPOSANTS : Audit exhaustif de chaque lot de matériel reçu. Tout défaut (disjoncteur non fonctionnel, câble sectionné) entraîne un rejet formel notifié sous 24h au Maître d\'Ouvrage.',
            'ART 2.2 - PROTOCOLE D\'ASSEMBLAGE RIGUREUX : Respect impératif de la sélectivité des protections conformément aux courbes de déclenchement validées dans le schéma unifilaire approuvé. Serrage dynamométrique certifié.',
            'ART 2.3 - SÉCURISATION ET MARQUAGE : Chaque kit doit être scellé et identifié par un Code de Validation unique (QR Code GEM). Toute altération du scellé avant livraison engage la responsabilité exclusive du Préparateur.',
            'ART 2.4 - GESTION DES FLUX NUMÉRIQUES : Saisie immédiate des kits prêts-à-livrer dans le Grand Livre GEM-SAAS. Aucun kit ne peut quitter l\'atelier sans validation numérique de sa conformité matérielle.'
        ],
        materials: ['Unités de sertissage hydraulique étalonnées', 'Stations d\'assemblage certifiées', 'Dispositifs de marquage industriel'],
        hse: [
            'ART 3.1 - RESPONSABLE SÉCURITÉ : Désignation d\'un responsable HSE dédié supervisant l\'atelier.',
            'ART 3.2 - DÉCLARATION D\'ACCIDENT : Tout accident de travail doit être déclaré sous 24h avec rapport circonstancié.',
            'ART 3.3 - PLAN HSE : Soumission d\'un plan de prévention des risques liés aux manipulations électriques.'
        ],
        subcontracting: [
            'ART 4.1 - RESPONSABILITÉ SOLIDAIRE : Le Titulaire demeure pleinement responsable des actes de ses sous-traitants, même autorisés préalablement.',
            'ART 4.2 - DÉLAIS D\'EXÉCUTION : Les délais sont fermes et courent dès l\'Ordre de Service. Tout retard entraîne l\'application automatique des pénalités sans mise en demeure.',
            'ART 4.3 - PÉNALITÉS DE RETARD : Pénalité de 5% du montant du lot par semaine de retard, plafonnée à 20% du montant total du lot.',
            'ART 4.4 - RÈGLEMENT DES LITIGES : En cas de différend non résolu à l\'amiable, compétence exclusive est attribuée aux tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - RÉGIME DE L'AVANCE FORFAITAIRE (10%) : Acompte de 10% consenti contre remise d'une garantie de restitution d'acompte (Caution d'Assurance : ASKIA, SONAM ou agréé).",
            "ART 5.2 - DROIT DE SUSPENSION : PROQUELEC se réserve le droit de suspendre les paiements en cas de non-conformité technique ou de réserve non levée.",
            "ART 5.3 - MODALITÉS DE RÈGLEMENT : Le paiement interviendra dans un délai de 30 jours après validation du PV de réception final et réception d'une facture conforme."
        ],
        legal: [
            "ART 6.1 - RESPONSABILITÉ CIVILE : Le Titulaire est responsable de plein droit des dommages matériels, corporels et immatériels causés lors de l'exécution.",
            "ART 6.2 - FORCE MAJEURE : Responsabilité dégagée en cas d'événement imprévisible (notifié sous 48h).",
            "ART 6.3 - CLAUSE RÉSOLUTOIRE : Résiliation immédiate aux torts du Titulaire en cas de manquement grave aux obligations de sécurité."
        ],
        pricing: {
            dailyRate: 25000,
            personnelCount: 5,
            durationDays: 20,
            penalties: "5% par semaine (Plafond 20%).",
            currency: "FCFA"
        }
    },
    'Livreur': {
        icon: Truck,
        color: 'teal',
        image: '/assets/images/livreur-distribution.png',
        introduction: "ARTICLE 1 - OBJET ET OBLIGATION DE RÉSULTAT : Le présent lot régit la chaîne logistique de transport et de distribution des kits. Le Titulaire est tenu par une obligation de résultat quant à la remise physique des matériels aux bénéficiaires finaux dans les délais impartis.",
        missions: [
            'ART 2.1 - INTÉGRITÉ DU TRANSPORT : Le Titulaire assure le gardiennage et le transfert sécurisé. Il répond de tout vol, casse ou perte survenant entre l\'enlèvement au dépôt et la remise au bénéficiaire.',
            'ART 2.2 - AUTHENTIFICATION DES DESTINATAIRES : Vérification systématique de l\'identité du client. La remise ne peut s\'effectuer qu\'après matching avec le registre numérique GEM.',
            'ART 2.3 - PREUVE DE LIVRAISON : Capture obligatoire de la signature numérique du bénéficiaire. Les données GPS du terminal GEM font foi de la date et du lieu de livraison.',
        ],
        materials: ['Vecteurs de transport habilités (Assurance marchandises incluse)', 'Unités mobiles de saisie numérique synchronisées', 'Bordereaux de livraison à sécurisation renforcée'],
        hse: [
            'ART 3.1 - SÉCURITÉ ROUTIÈRE : Respect strict du Code de la Route. Signalisation haute visibilité obligatoire.',
            'ART 3.2 - GESTION DES INCIDENTS : Rapport d\'incident de transport obligatoire sous 12h (panne, accident, vol).'
        ],
        subcontracting: [
            'ART 4.1 - INTUITU PERSONAE : Le présent contrat est conclu en considération de la personne du Titulaire. Toute cession est prohibée.',
            'ART 4.2 - PÉNALITÉS DE RETARD : Pénalité de 5% par semaine de retard, plafonnée à 20%.',
            'ART 4.3 - ATTRIBUTION DE JURIDICTION : Tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - GARANTIES DE MOBILISATION (10%) : Avance de 10% contre caution d'assurance couvrant la totalité de l'acompte.",
            "ART 5.2 - DROIT DE RÉTENTION : PROQUELEC peut retenir les paiements en cas de défaut de transmission des preuves de livraison numériques.",
            "ART 5.3 - DÉLAI DE PAIEMENT : 30 jours après validation du PV de réception global mensuel."
        ],
        legal: [
            "ART 6.1 - RESPONSABILITÉ CIVILE : Responsabilité totale pour les dommages causés aux tiers lors du transit.",
            "ART 6.2 - FORCE MAJEURE : Notification sous 48h obligatoire pour suspension des délais."
        ],
        pricing: {
            dailyRate: 35000,
            personnelCount: 2,
            durationDays: 15,
            penalties: "10% par unité non livrée ou endommagée.",
            currency: "FCFA"
        }
    },
    'Maçonnerie': {
        icon: Hammer,
        color: 'emerald',
        image: '/assets/images/maconnerie-base.png',
        introduction: "ARTICLE 1 - OBJET ET NORMES DE CONSTRUCTION : Le Titulaire s'engage à la réalisation des socles et ancrages supports. Les travaux doivent garantir une pérennité décennale et une résistance mécanique certifiée sur chaque point de descente réseau.",
        missions: [
            'ART 2.1 - EXÉCUTION DES FONDATIONS : Coulage de semelles béton (65x65x10 cm) assurant une assise indéformable conformément aux plans types validés par la Senelec.',
            'ART 2.2 - GÉOMÉTRIE DES OUVRAGES : Respect strict de l\'alignement et de la verticalité des supports. Tolérance maximale de déviation d\'aplomb fixée à 1%.',
            'ART 2.3 - PROTECTION CORROSION : Traitement anticorrosion des potelets par galvanisation à chaud certifiée ISO 1461.',
            'ART 2.4 - RÉCEPTION TECHNIQUE IA : La validation de l\'ouvrage est subordonnée au constat visuel IA de la qualité du béton et de la profondeur de scellement.'
        ],
        materials: ['Agrégats de carrière certifiés', 'Liants hydrauliques de haute performance', 'Instruments de mesure topographique de haute précision'],
        hse: [
            'ART 3.1 - SÉCURISATION DES CHANTIERS : Balisage systématique des zones d\'excavation. Gardiennage des sites isolés.',
            'ART 3.2 - PROTECTION INDIVIDUELLE : EPI complets classe 3 pour l\'ensemble du personnel de gros œuvre.'
        ],
        subcontracting: [
            'ART 4.1 - RESPONSABILITÉ DU TITULAIRE : Le Titulaire répond de la conformité des matériaux fournis par ses sous-traitants.',
            'ART 4.2 - PÉNALITÉS : 5% par semaine de retard, plafonné à 20%.',
            'ART 4.3 - JURIDICTION : Tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - AVANCE (10%) : Avance de 10% contre caution d'assurance (SONAM/ASKIA).",
            "ART 5.2 - SUSPENSION DES PAIEMENTS : Possible en cas de non-respect manifeste des plans types ou des dosages béton.",
            "ART 5.3 - PAIEMENT : 30 jours après signature du PV de réception final."
        ],
        legal: [
            "ART 6.1 - GARANTIE DÉCENNALE : Responsabilité contractuelle pour la stabilité des ouvrages pendant 10 ans.",
            "ART 6.2 - FORCE MAJEURE : Notification sous 48h obligatoire."
        ],
        pricing: {
            dailyRate: 30000,
            personnelCount: 2,
            durationDays: 20,
            penalties: "Refoulement des ouvrages non conformes sans indemnité.",
            currency: "FCFA"
        }
    },
    'Réseau': {
        icon: Zap,
        color: 'blue',
        image: '/assets/images/reseau-poteau.png',
        introduction: "ARTICLE 1 - OBJET ET CONTINUITÉ DE SERVICE : Le présent lot régit le raccordement au réseau de distribution Basse Tension. Le Titulaire garantit la sécurité des biens lors des raccordements sous tension et la conformité aux normes NFC 11-201.",
        missions: [
            'ART 2.1 - DÉPLOIEMENT AÉRIEN : Pose de câbles torsadés aluminium (2x16mm²) avec respect des flèches et tensions de pose fixées par la Senelec.',
            'ART 2.2 - CONNEXIONS TECHNIQUES : Utilisation de connecteurs à perforation d\'isolant étanches. Contrôle de l\'impédance de chaque branchement réalisé (R < 100 Ohms).',
            'ART 2.3 - VALIDATION NUMÉRIQUE : Chaque point de connexion doit être photographié et validé dans GEM-SAAS avant mise sous tension effective.'
        ],
        materials: ['Conducteurs torsadés aluminium conformes aux normes NFC', 'Pièces de jonction et connectique homologuées Senelec', 'Équipements de travaux sous tension (TST) et travaux en hauteur certifiés'],
        hse: [
            'ART 3.1 - HABILITATION ÉLECTRIQUE : Titularisation obligatoire B1V / H1V en cours de validité pour tout personnel intervenant sur le réseau.',
            'ART 3.2 - TRAVAUX EN HAUTEUR : Utilisation d\'échelles isolantes et harnais anti-chute certifiés conformes.'
        ],
        subcontracting: [
            'ART 4.1 - RESPONSABILITÉ CIVILE ET PÉNALE : Le Titulaire demeure responsable des désordres survenus par suite d\'un non-respect des distances de sécurité.',
            'ART 4.2 - PÉNALITÉS : 5% par semaine de retard, plafonné à 20%.',
            'ART 4.3 - JURIDICTION : Tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - CAUTIONNEMENT (10%) : Avance de 10% versée contre caution d'assurance.",
            "ART 5.2 - SUSPENSION DE PAIEMENT : En cas de défaut d'attestation d'habilitation électrique du personnel sur site.",
            "ART 5.3 - RÈGLEMENT : 30 jours après PV Final de Réception technique."
        ],
        legal: [
            "ART 6.1 - RESPONSABILITÉ : Responsabilité totale sur les dommages au réseau public existant.",
            "ART 6.2 - FORCE MAJEURE : Notification sous 48h obligatoire."
        ],
        pricing: {
            dailyRate: 40000,
            personnelCount: 2,
            durationDays: 15,
            penalties: "Amende substantielle pour non-respect des normes NF/Senelec.",
            currency: "FCFA"
        }
    },
    'Installation Intérieure': {
        icon: HardHat,
        color: 'orange',
        image: '/assets/images/installation-terre.png',
        introduction: "ARTICLE 1 - OBJET ET SÉCURITÉ DES USAGERS : Le présent lot concerne l'intégralité des installations électriques intérieures. Le Titulaire devient garant de la sécurité électrique du ménage, avec une obligation de conformité stricte à la norme NFC 15-100.",
        missions: [
            'ART 2.1 - MISE À LA TERRE : Confection de la prise de terre garantissant une résistance inférieure à 50 Ohms. Mesure certifiée par telluromètre requise pour chaque foyer.',
            'ART 2.2 - TABLEAU DE DISTRIBUTION : Installation du tableau modulaire incluant la protection différentielle 30mA haute sensibilité conforme à la norme NS 01-001.',
            'ART 2.3 - CONFORMITÉ IA : La validation et le paiement du lot ménage sont subordonnés à l\'attestation de conformité visuelle IA du tableau et de la boucle de terre.'
        ],
        materials: ['Composants certifiés NF / CE', 'Appareillage modulaire de marque agréée', 'Conducteurs cuivre de section normalisée'],
        hse: [
            'ART 3.1 - PERSONNEL QUALIFIÉ : Emploi exclusif d\'électriciens certifiés. Port des EPI de classe 1 et 2 obligatoire.',
            'ART 3.2 - SÉCURITÉ DES TIERS : Protection de l\'usager pendant le chantier. Balisage des zones d\'intervention.'
        ],
        subcontracting: [
            'ART 4.1 - RESPONSABILITÉ SOLIDAIRE : Tout manquement de la sous-traitance est imputable au Titulaire principal.',
            'ART 4.2 - PÉNALITÉS : 5% par semaine de retard, plafonné à 20%.',
            'ART 4.3 - JURIDICTION : Tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - AVANCE (10%) : Avance de 10% contre caution d'assurance (SONAM/ASKIA).",
            "ART 5.2 - DROIT DE SUSPENSION : Possible pour tout tableau électrique non conforme aux tests différentiels 30mA.",
            "ART 5.3 - PAIEMENT : 30 jours après signature du PV de réception ménage."
        ],
        legal: [
            "ART 6.1 - RESPONSABILITÉ : Garantie totale contre les risques d'incendie ou d'électrocution liés à l'installation.",
            "ART 6.2 - FORCE MAJEURE : Notification sous 48h obligatoire."
        ],
        pricing: {
            dailyRate: 35000,
            personnelCount: 2,
            durationDays: 20,
            penalties: "Nullité du service fait pour tout défaut de terre.",
            currency: "FCFA"
        }
    },
    'Contrôle & Validation': {
        icon: Glasses,
        color: 'pink',
        image: '/assets/images/controle-validation.png',
        introduction: "ARTICLE 1 - OBJET ET CERTIFICATION FINALE : Le Titulaire assure la mission de contrôle indépendant avant mise en service. Son intervention conditionne l'admission définitive du projet et l'obtention des certificats de conformité Cossuel.",
        missions: [
            'ART 2.1 - AUDIT DE CONFORMITÉ : Examen exhaustif de l\'adéquation entre le réalisé et les normes NFC 15-100 / NFC 11-201.',
            'ART 2.2 - MESURES ET ESSAIS ÉLECTRIQUES : Réalisation des mesures de boucle de terre, d\'isolement et de temps de déclenchement des différentiels avec appareils étalonnés.',
            'ART 2.3 - FORCE PROBANTE DU RAPPORT : Tout avis négatif bloque irrévocablement les paiements des installateurs jusqu\'à levée totale des réserves.'
        ],
        materials: ['Appareillage de mesure haute précision étalonné par un laboratoire agréé', 'Système expert de validation analytique GEM-SAAS'],
        hse: [
            'ART 3.1 - SÉCURITÉ DES ESSAIS : Application stricte des procédures de consignation électrique lors des essais diélectriques.',
            'ART 3.2 - EPI CATÉGORIE 3 : Obligatoires pour les mesures sous tension réseau.'
        ],
        subcontracting: [
            'ART 4.1 - INDÉPENDANCE : Absence totale de lien d\'intérêt avec les installateurs. Clause d\'éthique anti-corruption.',
            'ART 4.2 - JURIDICTION : Tribunaux de Dakar, Sénégal.'
        ],
        finances: [
            "ART 5.1 - RÉMUNÉRATION À LA PERFORMANCE : Paiement lié à la qualité et à la célérité des dossiers de certification Cossuel.",
            "ART 5.2 - EXEMPTION DE RETENUE (0%) : Nature intellectuelle de la mission.",
            "ART 5.3 - RÈGLEMENT : 30 jours après signature du PV Final de Réception technique global."
        ],
        legal: [
            "ART 6.1 - RESPONSABILITÉ PROFESSIONNELLE : Responsabilité exclusive en cas de validation indue entraînant un sinistre.",
            "ART 6.2 - FORCE MAJEURE : Notification sous 48h."
        ],
        pricing: {
            dailyRate: 30000,
            personnelCount: 2,
            durationDays: 15,
            penalties: "Retenue intégrale des honoraires pour rapport frauduleux.",
            currency: "FCFA"
        }
    }
};

const ROLE_TO_TRADE_MAPPING: Record<string, string> = {
    'Maçonnerie': 'macons',
    'Réseau': 'reseau',
    'Installation Intérieure': 'interieur_type1',
    'Contrôle & Validation': 'controle',
    'Préparateur': 'preparateurs',
    'Livreur': 'logistics'
};

export default function Cahier() {
    const { user } = useAuth();
    const isAdmin = (user?.role || '').includes('ADMIN') ||
        (user?.role || '').includes('DG') ||
        (user?.role || '').includes('DIRECTEUR') ||
        user?.email === 'admingem' ||
        user?.role === 'CLIENT_LSE';

    const { project } = useProject();
    const { teams: allTeams } = useTeams(project?.id);

    const [selectedRole, setSelectedRole] = useState('Installation Intérieure');
    const [isEditing, setIsEditing] = useState(false);

    // Get automated rate for the current role from project settings
    const automatedRate = useMemo(() => {
        if (!project?.config?.costs?.staffRates) return null;
        const tradeKey = ROLE_TO_TRADE_MAPPING[selectedRole];
        if (!tradeKey) return null;

        const staffRates = project.config.costs.staffRates;
        for (const regionId in staffRates) {
            for (const teamId in staffRates[regionId]) {
                const team = (allTeams || []).find((t: any) => t.id === teamId);
                // We match by tradeKey to get the standard rate for this type of work
                if (team?.tradeKey === tradeKey) {
                    return staffRates[regionId][teamId].amount || null;
                }
            }
        }
        return null;
    }, [project, allTeams, selectedRole]);

    // Load local overrides or fallback to default
    const [customLibrary, setCustomLibrary] = useState(() => {
        try {
            const saved = safeStorage.getItem('gem_cahier_library');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Si la librairie sauvegardée n'a pas les nouvelles clés ou n'a pas les images, on force l'abandon
                if (!parsed['Installation Intérieure'] || !parsed['Préparateur'] || !parsed['Préparateur'].image) {
                    safeStorage.removeItem('gem_cahier_library');
                    return DEFAULT_TASK_LIBRARY;
                }
                // JSON.parse destroys React component refs (icons), so we restore them from the default library
                Object.keys(parsed).forEach(key => {
                    if (DEFAULT_TASK_LIBRARY[key as keyof typeof DEFAULT_TASK_LIBRARY]) {
                        parsed[key].icon = DEFAULT_TASK_LIBRARY[key as keyof typeof DEFAULT_TASK_LIBRARY].icon;
                    }
                });
                return parsed;
            }
        } catch (e) { }
        return DEFAULT_TASK_LIBRARY;
    });

    const currentRoleKey = customLibrary[selectedRole as keyof typeof customLibrary] ? selectedRole : 'Installation Intérieure';
    const currentTask = customLibrary[currentRoleKey as keyof typeof customLibrary] || DEFAULT_TASK_LIBRARY['Installation Intérieure'];
    const CurrentIcon = currentTask.icon || Hammer;

    const [editIntroduction, setEditIntroduction] = useState(currentTask.introduction || '');
    const [editMissions, setEditMissions] = useState(currentTask.missions.join('\n'));
    const [editMaterials, setEditMaterials] = useState(currentTask.materials.join('\n'));
    const [editHse, setEditHse] = useState(currentTask.hse.join('\n'));
    const [editSubcontracting, setEditSubcontracting] = useState(currentTask.subcontracting?.join('\n') || '');
    const [editFinances, setEditFinances] = useState(currentTask.finances?.join('\n') || '');

    // Pricing states
    const [editPricingDailyRate, setEditPricingDailyRate] = useState(currentTask.pricing?.dailyRate || 0);
    const [editPricingPersonnel, setEditPricingPersonnel] = useState(currentTask.pricing?.personnelCount || 0);
    const [editPricingDuration, setEditPricingDuration] = useState(currentTask.pricing?.durationDays || 0);
    const [editPricingPenalties, setEditPricingPenalties] = useState(currentTask.pricing?.penalties || '');

    // Sync automated rate to state if available and in edit mode
    useEffect(() => {
        if (automatedRate && isEditing && editPricingDailyRate === 0) {
            setEditPricingDailyRate(automatedRate);
        }
    }, [automatedRate, isEditing, editPricingDailyRate]);

    // Reset editable fields when role changes
    const handleRoleChange = (role: string) => {
        setSelectedRole(role);
        setIsEditing(false);
        const task = customLibrary[role as keyof typeof customLibrary] || DEFAULT_TASK_LIBRARY['Installation Intérieure'];
        setEditIntroduction(task.introduction || '');
        setEditMissions(task.missions.join('\n'));
        setEditMaterials(task.materials.join('\n'));
        setEditHse(task.hse.join('\n'));
        setEditSubcontracting(task.subcontracting?.join('\n') || '');
        setEditFinances(task.finances?.join('\n') || '');
        setEditPricingDailyRate(task.pricing?.dailyRate || 0);
        setEditPricingPersonnel(task.pricing?.personnelCount || 0);
        setEditPricingDuration(task.pricing?.durationDays || 0);
        setEditPricingPenalties(task.pricing?.penalties || '');
    };

    const handleSave = () => {
        const updatedLibrary = { ...customLibrary };
        updatedLibrary[selectedRole as keyof typeof customLibrary] = {
            ...currentTask,
            introduction: editIntroduction,
            missions: editMissions.split('\n').filter(Boolean),
            materials: editMaterials.split('\n').filter(Boolean),
            hse: editHse.split('\n').filter(Boolean),
            subcontracting: editSubcontracting.split('\n').filter(Boolean),
            finances: editFinances.split('\n').filter(Boolean),
            pricing: {
                ...currentTask.pricing,
                dailyRate: editPricingDailyRate,
                personnelCount: editPricingPersonnel,
                durationDays: editPricingDuration,
                penalties: editPricingPenalties
            }
        };
        setCustomLibrary(updatedLibrary);
        safeStorage.setItem('gem_cahier_library', JSON.stringify(updatedLibrary));
        setIsEditing(false);
    };

    const handleExportWord = async () => {
        await exportCahiersToWord([{
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
            pricing: currentTask.pricing
        }], false, GENERAL_CLAUSES);
    };

    const exportAllWord = async () => {
        const allData = Object.entries(customLibrary).map(([role, task]) => ({
            role,
            introduction: (task as any).introduction,
            missions: (task as any).missions,
            materials: (task as any).materials,
            hse: (task as any).hse,
            subcontracting: (task as any).subcontracting || [],
            finances: (task as any).finances || [],
            legal: (task as any).legal || [],
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            responsible: '',
            contact: '',
            imagePath: (task as any).image,
            pricing: (task as any).pricing
        }));
        await exportCahiersToWord(allData, true, GENERAL_CLAUSES);
    };

    const filteredRoles = Object.entries(customLibrary).filter(([name]) => {
        if (isAdmin) return true;
        // Si l'utilisateur est un chef d'équipe, on essaie de matcher son nom ou ses responsabilités
        // On peut vérifier si son rôle technique est défini, sinon on filtre par mot clé
        const userSearch = (user?.name + ' ' + user?.role).toLowerCase();
        return userSearch.includes(name.toLowerCase()) ||
            (name === 'Maçonnerie' && userSearch.includes('macon')) ||
            (name === 'Installation Intérieure' && userSearch.includes('elect')) ||
            (name === 'Réseau' && userSearch.includes('res'));
    });

    // Effet pour forcer le rôle sélectionné si l'actuel n'est pas autorisé
    if (!filteredRoles.find(([n]) => n === selectedRole)) {
        if (filteredRoles.length > 0) {
            setSelectedRole(filteredRoles[0][0]);
        }
    }

    return (
        <PageContainer>
            <PageHeader
                title="Cahier des Charges"
                subtitle="Opérationnel & Technique"
                icon={HardHat}
                actions={
                    <ActionBar>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 border border-orange-600 dark:border-orange-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-xs font-black text-orange-900 dark:text-orange-100 uppercase tracking-widest leading-none">NS 01-001</span>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={exportAllWord}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 rounded-lg text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10"
                            >
                                <Download size={16} className="group-hover:rotate-12 transition-transform" />
                                LOT COMPLET (.DOCX)
                            </button>
                        )}
                    </ActionBar>
                }
            />

            <ContentArea className="p-0">
                <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8 p-8">

                    {/* Left Navigation: Role Selection with enhanced style */}
                    <div className="xl:col-span-1 space-y-3">
                        <div className="px-4 py-2 border-b border-slate-800 mb-4">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sélection du Métier</span>
                        </div>
                        {filteredRoles.map(([name, data]: [string, any]) => {
                            const Icon = data.icon;
                            const isSelected = selectedRole === name;
                            return (
                                <button
                                    key={name}
                                    onClick={() => handleRoleChange(name)}
                                    className={`
                                        w-full group relative flex items-center p-4 rounded-2xl transition-all duration-300
                                        ${isSelected
                                            ? 'bg-orange-500 text-white shadow-[0_10px_30px_rgba(249,115,22,0.3)] scale-[1.02] z-10'
                                            : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent hover:border-slate-700'}
                                    `}
                                >
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110
                                        ${isSelected ? 'bg-white/20' : 'bg-slate-800'}
                                    `}>
                                        <Icon size={22} className={isSelected ? 'text-white' : `text-${data.color}-500`} />
                                    </div>
                                    <div className="ml-4 text-left">
                                        <span className={`block font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                                            {name}
                                        </span>
                                        <span className={`text-xs uppercase font-bold tracking-widest ${isSelected ? 'text-orange-100' : 'text-slate-500 opacity-60'}`}>
                                            Cahier Lot n°24
                                        </span>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute right-4 w-1.5 h-6 bg-white dark:bg-slate-900 rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Details Content */}
                    <main className="xl:col-span-3 space-y-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className={`p-8 bg-gradient-to-br from-${currentTask.color}-500/10 to-transparent border-b border-slate-800`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-14 h-14 bg-${currentTask.color}-500/20 rounded-2xl flex items-center justify-center border border-${currentTask.color}-500/30`}>
                                            <CurrentIcon size={28} className={`text-${currentTask.color}-400`} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white">{selectedRole}</h3>
                                            <p className="text-slate-500">Détails des missions techniques et logistiques</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleExportWord}
                                            aria-label="Télécharger ce cahier"
                                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-all border border-slate-700 active:scale-95"
                                        >
                                            <Download size={16} className="text-orange-500" />
                                            <span className="hidden md:inline">Télécharger</span>
                                        </button>

                                        {isAdmin && (
                                            isEditing ? (
                                                <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                    <Save size={16} /> Enregistrer
                                                </button>
                                            ) : (
                                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-all border border-slate-700 active:scale-95">
                                                    <Edit3 size={16} /> Éditer
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                                <section className="md:col-span-1">
                                    {/* African Style Visual Card */}
                                    <div className="relative group mb-8">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                                        <div className="relative aspect-[4/5] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                                            {/* Pattern overlay */}
                                            <div className="senelec-dots-pattern" />

                                            <img
                                                src={currentTask.image}
                                                alt={selectedRole}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />

                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                                                        <CurrentIcon size={20} />
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-black text-orange-400 uppercase tracking-widest">Guide Officiel</span>
                                                        <span className="block text-lg font-bold text-white tracking-tight">Réalisation : {selectedRole}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-red-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Dispositions Générales du Marché</h4>
                                    </div>
                                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 mb-8">
                                        <ul className="space-y-3">
                                            {GENERAL_CLAUSES.map((clause, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <Shield size={14} className="text-red-500 mt-1 shrink-0" />
                                                    <span className="text-slate-400 text-xs leading-relaxed">{clause}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Objet & Obligations Techniques</h4>
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            aria-label="Modifier les missions"
                                            value={editMissions}
                                            onChange={(e) => setEditMissions(e.target.value)}
                                            className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                    ) : (
                                        <ul className="space-y-4">
                                            {currentTask.missions.map((m: string, i: number) => (
                                                <li key={i} className="flex items-start space-x-3 group">
                                                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0 transition-transform group-hover:scale-110" />
                                                    <span className="text-slate-300 text-sm leading-relaxed font-bold">{m.split(' : ')[0]}</span>
                                                    <span className="text-slate-400 text-xs leading-relaxed">{m.split(' : ')[1]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-2">Dispositions Contractuelles</h3>
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4">
                                        {isEditing ? (
                                            <textarea
                                                title="Modifier l'introduction"
                                                value={editIntroduction}
                                                onChange={(e) => setEditIntroduction(e.target.value)}
                                                className="w-full h-24 bg-slate-950 border border-indigo-500/30 rounded-xl p-3 text-indigo-200 text-sm focus:border-indigo-500 outline-none resize-none mb-4 italic"
                                            />
                                        ) : (
                                            <p className="text-indigo-200 text-sm italic font-medium leading-relaxed">{currentTask.introduction}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-orange-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Matériel & Moyens Logistiques</h4>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-800 mb-6">
                                        {isEditing ? (
                                            <textarea
                                                title="Modifier le matériel"
                                                value={editMaterials}
                                                onChange={(e) => setEditMaterials(e.target.value)}
                                                className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                                            />
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {currentTask.materials.map((m: string, i: number) => (
                                                    <span key={i} className="flex items-center space-x-2 bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold">
                                                        <Package size={14} className="text-orange-500" />
                                                        <span>{m}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-rose-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Cadre Hygiène & Sécurité (HSE)</h4>
                                    </div>
                                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                                        {isEditing ? (
                                            <textarea
                                                title="Modifier les règles HSE"
                                                value={editHse}
                                                onChange={(e) => setEditHse(e.target.value)}
                                                className="w-full h-24 bg-slate-950 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-sm focus:border-rose-500 outline-none resize-none"
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                {currentTask.hse.map((h: string, i: number) => (
                                                    <div key={i} className="flex items-start space-x-3">
                                                        <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                                                        <p className="text-[12px] text-rose-300/80 leading-relaxed font-bold">
                                                            {h}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6 mt-8">
                                        <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Dispositions Relatives à la Sous-traitance</h4>
                                    </div>
                                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                                        {isEditing ? (
                                            <textarea
                                                title="Modifier les clauses de sous-traitance"
                                                value={editSubcontracting}
                                                onChange={(e) => setEditSubcontracting(e.target.value)}
                                                className="w-full h-32 bg-slate-950 border border-yellow-500/30 rounded-xl p-3 text-yellow-200 text-sm focus:border-yellow-500 outline-none resize-none"
                                            />
                                        ) : (
                                            <ul className="space-y-3">
                                                {currentTask.subcontracting?.map((clause: string, i: number) => (
                                                    <li key={i} className="flex items-start space-x-2">
                                                        <ShieldCheck size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                                                        <span className="text-yellow-200/90 text-xs font-bold leading-relaxed">{clause}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6 mt-8">
                                        <div className="w-1 h-6 bg-amber-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Dispositions Financières, Cautions & Garanties</h4>
                                    </div>
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                        {isEditing ? (
                                            <textarea
                                                aria-label="Modifier les clauses financières"
                                                value={editFinances}
                                                onChange={(e) => setEditFinances(e.target.value)}
                                                className="w-full h-32 bg-slate-950 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-sm focus:border-amber-500 outline-none resize-none"
                                            />
                                        ) : (
                                            <ul className="space-y-4">
                                                {currentTask.finances?.map((f: string, i: number) => (
                                                    <li key={i} className="flex items-start space-x-3 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 shadow-inner">
                                                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0 animate-pulse" />
                                                        <div>
                                                            <p className="text-amber-200 text-xs font-black uppercase tracking-tight">{f.split(' : ')[0]}</p>
                                                            <p className="text-amber-100/70 text-[11px] leading-tight font-medium mt-1">{f.split(' : ')[1]}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6 mt-8">
                                        <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Configurations & Barèmes Contractuels</h4>
                                    </div>
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <label className="block text-xs text-emerald-400 uppercase font-bold">Tarif journalier (FCFA)</label>
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
                                                                value={editPricingDailyRate}
                                                                onChange={(e) => setEditPricingDailyRate(e.target.valueAsNumber || 0)}
                                                                className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                                                            />
                                                            {automatedRate && editPricingDailyRate !== automatedRate && (
                                                                <button
                                                                    onClick={() => setEditPricingDailyRate(automatedRate)}
                                                                    title={`Réinitialiser au tarif paramétré (${automatedRate})`}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400 p-1"
                                                                >
                                                                    <RefreshCw size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">Effectif (Pers.)</label>
                                                        <input
                                                            type="number"
                                                            aria-label="Effectif"
                                                            value={editPricingPersonnel}
                                                            onChange={(e) => setEditPricingPersonnel(e.target.valueAsNumber || 0)}
                                                            className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">Durée (Jours)</label>
                                                        <input
                                                            type="number"
                                                            title="Durée"
                                                            value={editPricingDuration}
                                                            onChange={(e) => setEditPricingDuration(e.target.valueAsNumber || 0)}
                                                            className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 text-sm outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-emerald-400 uppercase mb-1.5 font-bold">Clauses Pénales & Précisions</label>
                                                    <textarea
                                                        title="Modifier les pénalités"
                                                        value={editPricingPenalties}
                                                        onChange={(e) => setEditPricingPenalties(e.target.value)}
                                                        className="w-full h-20 bg-slate-950 border border-emerald-500/30 rounded-lg p-3 text-emerald-300 text-sm outline-none focus:border-emerald-500 resize-none"
                                                    />
                                                </div>
                                                <div className="pt-2 flex justify-end">
                                                    <div className="bg-emerald-500/20 px-4 py-2 rounded-lg border border-emerald-500/30">
                                                        <span className="text-xs text-emerald-400 font-bold uppercase mr-2">Total Auto :</span>
                                                        <span className="text-emerald-300 font-black">{(editPricingDailyRate * editPricingPersonnel * editPricingDuration).toLocaleString()} FCFA</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 relative">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <p className="text-xs text-slate-500 uppercase font-bold">Prix Unitaire</p>
                                                            {automatedRate && currentTask.pricing?.dailyRate === automatedRate && (
                                                                <span className="text-xs text-emerald-500/50 font-black uppercase tracking-tighter">Sync ✔</span>
                                                            )}
                                                        </div>
                                                        <p className="text-emerald-400 font-bold">{currentTask.pricing?.dailyRate?.toLocaleString()} <span className="text-xs">{currentTask.pricing?.currency}</span></p>
                                                    </div>
                                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ressources</p>
                                                        <p className="text-white font-bold">{currentTask.pricing?.personnelCount} <span className="text-xs text-slate-400">Agents</span></p>
                                                    </div>
                                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Durée</p>
                                                        <p className="text-white font-bold">{currentTask.pricing?.durationDays} <span className="text-xs text-slate-400">Jours</span></p>
                                                    </div>
                                                </div>

                                                <div className="border-t border-emerald-500/10 pt-4">
                                                    <p className="text-xs text-slate-500 uppercase font-bold mb-2">Clauses de pénalités applicables</p>
                                                    <p className="text-xs text-emerald-500/70 italic leading-relaxed">
                                                        "{currentTask.pricing?.penalties}"
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">
                                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-tighter font-display">Total Prévisionnel du Lot</span>
                                                    <span className="text-xl font-black text-emerald-400 font-display">
                                                        {((currentTask.pricing?.dailyRate || 0) * (currentTask.pricing?.personnelCount || 0) * (currentTask.pricing?.durationDays || 0)).toLocaleString()} {currentTask.pricing?.currency}
                                                    </span>
                                                </div>

                                                <div className="flex items-center space-x-2 mb-6 mt-8">
                                                    <div className="w-1 h-6 bg-purple-500 rounded-full" />
                                                    <h4 className="font-bold text-white uppercase tracking-wider text-sm">Juridique & Responsabilité</h4>
                                                </div>
                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-8">
                                                    <ul className="space-y-3">
                                                        {(currentTask as any).legal?.map((item: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2 group">
                                                                <Scale size={14} className="text-purple-500 mt-1 shrink-0 transition-transform group-hover:scale-110" />
                                                                <span className="text-slate-400 text-[11px] italic leading-relaxed">{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={handleExportWord}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <FileText size={18} />
                                                        EXPORTER (.DOCX)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 grayscale pointer-events-none">
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                                <div className="h-20 flex flex-col items-center justify-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">VISA DIRECTION PROQUELEC</span>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                                <div className="h-20 flex flex-col items-center justify-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-center">VISA PRESTATAIRE ({selectedRole.toUpperCase()})</span>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </ContentArea>
        </PageContainer>
    );
}