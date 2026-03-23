import { useState } from 'react';
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
    Glasses
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportCahiersToWord } from '../utils/exportWord';
import * as safeStorage from '../utils/safeStorage';
import './Cahier.css';

const DEFAULT_TASK_LIBRARY = {
  'Préparateur': {
    icon: BoxIcon,
    color: 'indigo',
    image: '/assets/images/preparateur-atelier.png',
    introduction: "Le présent lot définit les exigences et modalités opérationnelles liées à la préparation en atelier, l'assemblage et le conditionnement logistique des équipements électriques, en stricte conformité avec la norme NS 01-001 et les spécifications techniques de Senelec.",
    missions: [
      'PHASE 1 - INVENTAIRE & CONTRÔLE KITS : Réception des fournitures selon nomenclature NS 01-001. Contrôle quantitatif et qualitatif (conformité Senelec) avant montage.',
      'PHASE 2 - ATELIER DE PRÉCÂBLAGE : Équipement des coffrets modulaires. Pose et pontage des disjoncteurs C10, C20, différentiel 25A/30mA, et disjoncteur de branchement 5/15A.',
      'PHASE 3 - CONDITIONNEMENT & MARQUAGE : Séparation en Kits Principaux et Secondaires (Option). Intégration des composants annexes (accessoires, prises, terre).',
      'PHASE 4 - LOGISTIQUE DÉPART : Conditionnement hermétique et étiquetage (ID Ménage / Code Kobo). Préparation des bons de sortie magasin.'
    ],
    materials: ['Coffrets', 'Disjoncteurs et Interrupteurs', 'Filerie', 'Outillage (Sertissage)'],
    hse: ['Gants de manutention', 'Poste ergonomique'],
    subcontracting: [
      'Reporting GEM-SAAS : Obligation de validation numérique en temps réel.',
      'Non Sous-traitance : Interdiction du second rang.',
      'Qualité Senelec : Respect strict des normes NS 01-001.',
      'Pénalités & Délais : Rappel de l\'importance du calendrier LSE.'
    ]
  },
  'Livreur': {
    icon: Truck,
    color: 'teal',
    image: '/assets/images/livreur-distribution.png',
    introduction: "Ce volet encadre la chaîne logistique de transport, l'arrimage sécurisé et la distribution des kits complets (sur site) destinés à chaque ménage bénéficiaire, garantissant l'intégrité du matériel et la traçabilité des livraisons.",
    missions: [
      'PHASE 1 - CHARGEMENT & ARRIMAGE : Prise en charge des kits au dépôt. Disposition sécurisée dans les véhicules pour éviter toute détérioration des appareillages.',
      'PHASE 2 - ACHEMINEMENT ROUTIER : Transport du matériel et du personnel vers les zones d\'intervention ciblées.',
      'PHASE 3 - DÉPLOIEMENT TERRAIN : Distribution exacte (clé en main) des kits par ménage identifié sur la liste locale.',
      'PHASE 4 - RESTITUTION : Signature obligatoire du bordereau / accusé de réception par le bénéficiaire. Signalement des anomalies Kobo.'
    ],
    materials: ['Véhicule', 'Tablette', 'Bordereaux de livraison/réception'],
    hse: ['Vigilance routière', 'Chaussures de sécurité'],
    subcontracting: [
      'Reporting GEM-SAAS : Suivi journalier obligatoire.',
      'Non Sous-traitance : Livraison exclusivement par l\'équipe interne.',
      'Qualité Senelec : Vérification intégrale des bordereaux.',
      'Pénalités & Délais : Respect strict du planning LSE.'
    ]
  },
  'Maçonnerie': {
    icon: Hammer,
    color: 'emerald',
    image: '/assets/images/maconnerie-base.png',
    introduction: "Le présent document décrit les prescriptions techniques obligatoires pour les travaux de génie civil, incluant la réalisation des fondations, l'élévation des murets de comptage, le scellement des potelets galvanisés et les tranchées de raccordement.",
    missions: [
      'PHASE 1 - GÉNIE CIVIL & FONDATIONS (Briques Pleines) : Décaissement et coulage d\'une semelle de béton de propreté 65x65x10 cm. Pose des 8 briques pleines en guise de socle porteur incompressible.',
      'PHASE 2 - ÉLÉVATION & JOINTOIEMENT (Briques Creuses) : Montage des 32 briques creuses de qualité supérieure. Application d\'un jointoiement "tiré au fer", lissé, dense et sans coulures (mortier riche en ciment).',
      'PHASE 3 - REMPLISSAGE INTERNE : Remplissage hermétique par strates successives (Absence absolue de câblage interne). Niveau Bas: Ciment. Niveau Médian: Sable propre. Niveau Haut: Bouchon en ciment profilé en pente pour ruissellement des eaux.',
      'PHASE 4 - SCELLEMENT DU POTELET GALVA : Fixation en façade avec patte de scellement. Réglage strict de l\'aplomb et de la verticalité aux deux axes (Niveau à bulle & fil à plomb). Le mortier doit fusionner avec l\'appareillage pour contrer la tension de ligne.',
      'PHASE 5 - TRANCHÉES DE RACCORDEMENT : Fouille normalisée (Prof: 50cm, Larg: 30cm) entre coffret compteur et coffret principal avec pose de grillage avertisseur. (2ème tranchée applicable pour kits secondaires).'
    ],
    materials: ['8 briques pleines & 32 briques creuses (Format 15)', 'Ciment de grade 32.5 min', 'Sable de mer ou carrière tamisé', 'Niveau à bulle & Fil à plomb', 'Potelet Galva 4m et accessoires (tube PVC, pattes, etc)'],
    hse: ['Port obligatoire des EPI (Casque, chaussures de sécurité)', 'Balisage obligatoire de la zone de tranchée/fouille', 'Personnel formé et aucune sous-traitance tolérée'],
    subcontracting: [
      'Reporting GEM-SAAS : Suivi obligatoire pour chaque phase de maçonnerie.',
      'Non Sous-traitance : Tous travaux réalisés par l\'équipe interne.',
      'Qualité Senelec : Respect strict des normes NS 01-001.',
      'Pénalités & Délais : Respect du calendrier LSE impératif.'
    ]
  },
  'Réseau': {
    icon: Zap,
    color: 'blue',
    image: '/assets/images/reseau-poteau.png',
    introduction: "Ce chapitre détaille les procédures techniques de raccordement des ménages au réseau aérien public basse tension (branchement monophasé), incluant le tirage de câble, la pose des organes d'ancrage et la connexion sécurisée.",
    missions: [
      'PHASE 1 - CONSIGNATION & PRÉPARATION : Balisage de la zone d\'intervention en aval du réseau aérien public basse tension.',
      'PHASE 2 - TIRAGE DE LIGNE : Déroulage et tension du câble aluminium torsadé préassemblé 2x16 mm² depuis l\'armement de poteau (portée ~20m).',
      'PHASE 3 - FIXATION MÉCANIQUE : Ancrage via pinces 25 et mise en place des arrêtoirs et brides de serrage autour du potelet.',
      'PHASE 4 - CONNEXION ÉLECTRIQUE : Fixation des connecteurs homologués à perforation d\'isolant (CPB1/CT70). Raccordement en interface ménage / Senelec. (Note: Compteur pris en charge par Senelec ERA).'
    ],
    materials: ['Câble aluminium torsadé 2x16 mm²', 'Outillage isolé', 'Échelle 3m'],
    hse: ['Port des EPI : Gants isolants, Écran facial, Casque sécurité, Chaussures de sécurité', 'Habilitation électrique obligatoire', 'Véhicule et échelle 3m conformes'],
    subcontracting: [
      'Reporting GEM-SAAS : Obligation de suivi en temps réel pour chaque ligne.',
      'Non Sous-traitance : Interdiction de déléguer le tirage ou la connexion.',
      'Qualité Senelec : Contrôle obligatoire de chaque connexion.',
      'Pénalités & Délais : Respect strict du planning LSE.'
    ]
  },
  'Installation Intérieure': {
    icon: HardHat,
    color: 'orange',
    image: '/assets/images/installation-terre.png',
    introduction: "Ces spécifications fixent le cadre d'exécution pour le déploiement des branchements électriques intérieurs, de la pose du coffret jusqu'à l'équipement des terminaux et la mise à la terre, en respect absolu des normes de sécurité pour la protection des usagers.",
    missions: [
      'PHASE 1 - TRAÇAGE & FIXATION : Détermination des cheminements de câbles. Pose en apparent ou saigné sous fourreaux des câbles 2x6mm² FRN05 (15m) et 3x1.5mm² (4m) selon NS 01-001.',
      'PHASE 2 - RACCORDEMENT COFFRET : Fixation murale. Connexion des appareillages modulaires avec serrage dynamométrique (C10, C20, Inter-Différentiel 30mA, Disjoncteur 5/15A).',
      'PHASE 3 - ÉQUIPEMENT TERMINAL : Câblage et pose des douilles, hublots, lampes LED LBC et socles de prises de courant étanches.',
      'PHASE 4 - KIT SECONDAIRE (Optionnel) : Extension de l\'installation via câble armé 3x1.5mm² (10m) pour éclairage déporté.',
      'PHASE 5 - MISE À LA TERRE : Creusement et enfoncement du piquet cuivre. Intégration de la barrette de coupure, tube annelé et liaison via cuivre nu Ø25 puis conducteur sous gaine V/J 6mm² vers le bornier principal.'
    ],
    materials: ['Kit principal complet', 'Kit secondaire (option)', 'Dispositif de mise à la terre complet'],
    hse: ['Aptitude physique confirmée et bonne moralité', 'Respect des nouvelles dispositions Senelec', 'Outillage isolé'],
    subcontracting: [
      'Reporting GEM-SAAS : Suivi numérique obligatoire à chaque étape.',
      'Non Sous-traitance : Travaux exclusivement réalisés par l’équipe interne.',
      'Qualité Senelec : Respect strict des normes NS 01-001 et inspection obligatoire.',
      'Pénalités & Délais : Suivi impératif du planning LSE.'
    ]
  },
  'Contrôle & Validation': {
    icon: Glasses,
    color: 'pink',
    image: '/assets/images/controle-validation.png',
    introduction: "Le présent volet encadre l'ultime phase d'audit technique, de contrôle de conformité et de certification (mesures d'isolement, continuité électrique) requise préalablement à la mise sous tension et à l'obtention de l'attestation Cossuel.",
    missions: [
      'PHASE 1 - INSPECTION VISUELLE : Examen systématique de l\'ingéniosité, des serrages, et du respect drastique des normes NS 01-001 et prescriptions Senelec.',
      'PHASE 2 - ESSAIS MESURES : Vérification d\'Absence de Tension (VAT). Prise de valeur de la résistance de terre au telluromètre. Test de déclenchement différentiel et mesureurs d\'isolement 500V.',
      'PHASE 3 - ENREGISTREMENTS : Restitution des valeurs trouvées sur KoboCollect. Élaboration du rapport analytique de réception pour chaque ménage validé.',
      'PHASE 4 - APPROBATION : Validation définitive pour soumission au Cossuel (comité pour la sécurité des usagers). Signature du PV avec le bénéficiaire.'
    ],
    materials: ['Mesureur d’isolement 500V', 'Vérificateur d\'Absence de Tension (VAT)', 'Telluromètre', 'Multimètre', 'Ligne téléphonique/GSM fonctionnel'],
    hse: ['Obligation d’aviser en cas d’accident électrique', 'Assurance accident obligatoire', 'Responsabilité totale des risques'],
    subcontracting: [
      'Reporting GEM-SAAS : Enregistrement obligatoire de tous les contrôles.',
      'Non Sous-traitance : Contrôle exclusivement réalisé par l’équipe interne certifiée.',
      'Qualité Senelec : Respect strict des normes NS 01-001 pour la validation finale.',
      'Pénalités & Délais : Suivi rigoureux du planning LSE pour la réception finale.'
    ]
  }
};

export default function Cahier() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN_PROQUELEC' || user?.role === 'DG_PROQUELEC' || user?.role === 'CLIENT_LSE';

    const [selectedRole, setSelectedRole] = useState('Installation Intérieure');
    const [isEditing, setIsEditing] = useState(false);

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
    };

    const handleSave = () => {
        const updatedLibrary = { ...customLibrary };
        updatedLibrary[selectedRole as keyof typeof customLibrary] = {
            ...currentTask,
            introduction: editIntroduction,
            missions: editMissions.split('\n').filter(Boolean),
            materials: editMaterials.split('\n').filter(Boolean),
            hse: editHse.split('\n').filter(Boolean),
            subcontracting: editSubcontracting.split('\n').filter(Boolean)
        };
        setCustomLibrary(updatedLibrary);
        safeStorage.setItem('gem_cahier_library', JSON.stringify(updatedLibrary));
        setIsEditing(false);
    };



    const exportSingleRole = async () => {
        await exportCahiersToWord([{
            role: selectedRole,
            introduction: currentTask.introduction,
            missions: currentTask.missions,
            materials: currentTask.materials,
            hse: currentTask.hse,
            subcontracting: currentTask.subcontracting || [],
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            responsible: user?.name || '',
            contact: '',
            imagePath: currentTask.image
        }], false);
    };

    const exportAllWord = async () => {
        const allData = Object.entries(customLibrary).map(([role, task]) => ({
            role,
            introduction: (task as any).introduction,
            missions: (task as any).missions,
            materials: (task as any).materials,
            hse: (task as any).hse,
            subcontracting: (task as any).subcontracting || [],
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            responsible: '',
            contact: '',
            imagePath: (task as any).image
        }));
        await exportCahiersToWord(allData, true);
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
    if (!isAdmin && !filteredRoles.find(([n]) => n === selectedRole)) {
        if (filteredRoles.length > 0) {
            setSelectedRole(filteredRoles[0][0]);
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            <header className="bg-slate-900 border-b border-slate-800 p-8 shrink-0 relative overflow-hidden">
                {/* Background Branding */}
                <div className="cahier-header-branding" />
                <div className="cahier-header-stripe" />

                <div className="flex justify-between items-center max-w-7xl mx-auto relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-px w-12 bg-orange-500" />
                            <span className="text-orange-500 font-black tracking-[0.2em] text-xs uppercase">Document Technique Officiel</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
                            Cahier des Charges <span className="text-orange-500">Opérationnel</span>
                        </h1>
                        <p className="text-slate-400 max-w-2xl font-medium leading-relaxed">
                            Référentiel technique pour le lot <span className="text-white">Génie Civil & Installation Intérieure</span>.
                            Conformité stricte aux normes <span className="text-orange-400 font-bold">NS 01-001</span> et procédures de branchement ERA/Senelec.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex flex-col items-end mr-6 border-r border-slate-800 pr-6">
                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Version du Système</span>
                            <span className="text-white font-mono text-sm tracking-tighter">GEM-SAAS v2.4.0</span>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={exportAllWord}
                                className="group relative flex items-center space-x-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
                            >
                                <Download size={20} className="group-hover:rotate-12 transition-transform" />
                                <span>LOT COMPLET (.DOCX)</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">

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
                                        <span className={`text-[10px] uppercase font-bold tracking-widest ${isSelected ? 'text-orange-100' : 'text-slate-500 opacity-60'}`}>
                                            Cahier Lot n°24
                                        </span>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute right-4 w-1.5 h-6 bg-white rounded-full" />
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
                                            onClick={exportSingleRole}
                                            title="Télécharger ce cahier"
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
                                        <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Missions Principales</h4>
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            title="Modifier les missions"
                                            value={editMissions}
                                            onChange={(e) => setEditMissions(e.target.value)}
                                            className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                    ) : (
                                        <ul className="space-y-4">
                                            {currentTask.missions.map((m: string, i: number) => (
                                                <li key={i} className="flex items-start space-x-3 group">
                                                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0 transition-transform group-hover:scale-110" />
                                                    <span className="text-slate-300 text-sm leading-relaxed">{m}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-2">1. Spécifications du lot & Missions techniques</h3>
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4">
                                        {isEditing ? (
                                            <textarea
                                                title="Modifier l'introduction"
                                                value={editIntroduction}
                                                onChange={(e) => setEditIntroduction(e.target.value)}
                                                className="w-full h-24 bg-slate-950 border border-indigo-500/30 rounded-xl p-3 text-indigo-200 text-sm focus:border-indigo-500 outline-none resize-none mb-4 italic"
                                            />
                                        ) : (
                                            <p className="text-indigo-200 text-sm italic">{currentTask.introduction}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-orange-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Matériel & Logistique</h4>
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
                                                    <span key={i} className="flex items-center space-x-2 bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                                                        <Package size={14} className="text-slate-500" />
                                                        <span>{m}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-rose-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Sécurité & HSE</h4>
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
                                                        <p className="text-[12px] text-rose-300/80 leading-relaxed font-medium">
                                                            {h}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 mb-6 mt-8">
                                        <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Clauses de Sous-traitance</h4>
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
                                            <ul className="space-y-2 list-disc list-inside text-yellow-200 text-sm">
                                                {currentTask.subcontracting?.map((clause: string, i: number) => (
                                                    <li key={i}>{clause}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 grayscale pointer-events-none">
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                                <div className="h-20 flex flex-col items-center justify-center">
                                    <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">VISA DIRECTION PROQUELEC</span>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl border-dashed">
                                <div className="h-20 flex flex-col items-center justify-center">
                                    <span className="text-xs text-slate-600 font-bold uppercase tracking-widest text-center">VISA PRESTATAIRE ({selectedRole.toUpperCase()})</span>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
