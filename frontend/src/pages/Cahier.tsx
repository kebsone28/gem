import { useState } from 'react';
import {
    Download,
    CheckCircle2,
    AlertTriangle,
    HardHat,
    Zap,
    Hammer,
    ClipboardCheck,
    Package,
    Edit3,
    Save,
    Truck,
    Box,
    Glasses
} from 'lucide-react';
import { exportCahierToWord } from '../utils/exportWord';

const DEFAULT_TASK_LIBRARY = {
    'Préparateur': {
        icon: Box,
        color: 'indigo',
        missions: [
            'Précâbler les coffrets principaux : installation des disjoncteurs (C10, C20, 25A/30mA, 5/15A), connecteurs et filerie.',
            'Préparer les kits de raccordement réseau (Potelet, accessoires, connecteurs, câble 2x16mm²).',
            'Organiser et charger l’ensemble du matériel dans les véhicules des transporteurs.',
            'Renseigner l’application (Kobo/App) sur le nombre de kits finalisés et chargés.',
            'Étiqueter et conditionner les kits par ménage pour faciliter la livraison terrain.'
        ],
        materials: ['Coffrets', 'Disjoncteurs et Interrupteurs', 'Outils de sertissage', 'Filerie (TH 6mm², 3x1.5mm²)'],
        hse: ['Port des gants de manutention', 'Poste de câblage ergonomique']
    },
    'Livreur': {
        icon: Truck,
        color: 'teal',
        missions: [
            'Charger les kits complets (Intérieur + Réseau + Terre) depuis le dépôt jusqu’aux ménages.',
            'Livrer chaque kit au ménage ciblé et obtenir le bordereau / accusé de réception signé.',
            'Signaler les anomalies terrain (absence, accès, refus) et replanifier.'
        ],
        materials: ['Véhicule de transport', 'Tablette de suivi', 'Bordereaux de livraison/réception'],
        hse: ['Vigilance routière', 'Chaussures de sécurité', 'Arrimage de sécurité du chargement']
    },
    'Maçon': {
        icon: Hammer,
        color: 'emerald',
        missions: [
            'Réalisation d\'un pan de mur en forme de cheminée pour support coffret compteur par ménage.',
            'Fondation : Creuser une fouille de 70×70 cm sur 50 cm de profondeur. Couler béton de propreté (10cm).',
            'Montage mur : ~40 briques creuses + 8 briques pleines. Hauteur ~2,2m.',
            'Placer le potelet au centre du mur, verticalité parfaite, avec queue de cochon orientée vers le réseau.',
            'Remplissage intérieur du mur (Bas: béton+pierres, Milieu: sable compacté, Haut: béton de blocage).'
        ],
        materials: ['8 briques pleines (20X15X40cm)', '40 Briques creuses', '1.5 Sac de Ciment', 'Sable (dune/mer)', 'Gravillons/Béton', '200L d\'eau (1 fût)'],
        hse: ['Port du casque et gants', 'Balisage de la fouille si laissée ouverte', 'Stabilisation des matériaux']
    },
    'Réseau': {
        icon: Zap,
        color: 'blue',
        missions: [
            'Installation et raccordement au réseau des coffrets compteurs par ménage.',
            'Pose Potelet Galva 4m, Tube PVC, Arrêtoir, Bride de serrage, Queue de cochon, Coude Ф25 sectionné + 2kg ciment plâtre.',
            'Fixation de la Patte de scellement.',
            'Tirage Câble Préassemblé 2x16mm² (Portée 20m).',
            'Mise en place des Connecteurs CPB1/CT70 et de la Pince d\'Ancrage 25.'
        ],
        materials: ['Potelet Galva 4m', 'Câble 2x16mm² (20m)', 'Tube PVC & Accessoires', 'Connecteurs CPB1/CT70', 'Pince d\'Ancrage 25', '2kg ciment plâtre'],
        hse: ['Harnais de sécurité pour travaux en hauteur', 'Gants isolants BT']
    },
    'Intérieur': {
        icon: HardHat,
        color: 'orange',
        missions: [
            'Réalisation de tranchées (30x50cm) et pose de câble armé FRN05 VV-U ou R 2x6 mm² (15m) avec grillage avertisseur.',
            'Installation et raccordement du Coffret modulaire : Hublot, Câble 3x1.5mm² (4m), Lampe LBC + douille, 2 interrupteurs simples, 1 prise électrique.',
            'Connexion des Modulaires : C10, C20, Différentiel 25A/30mA, Disjoncteur de branchement 5/15A, Bornier.',
            'Réalisation de la mise à la terre : Tube annelé, barrette de terre, Fil TH vert-jaune 6 mm² (4m), Conducteur Cu nu Ф25 mm² (3m), Piquet de terre 1,5m cuivre.',
            'Option : Installation du kit secondaire avec lampe LBC, douille, interrupteur simple, prise, câble armé 3x1.5 mm².'
        ],
        materials: ['Coffret modulaire complet', 'Disjoncteurs', 'Câble FRN05 2x6mm² (15m)', 'Grillage avertisseur', 'Appareillage (Hublot, LBC, Prises)', 'Kit de mise à la terre complet'],
        hse: ['Lunettes de protection', 'Testeur de tension', 'Serrage vigoureux des bornes']
    },
    'Contrôleur': {
        icon: Glasses,
        color: 'pink',
        missions: [
            'Contrôle de conformité des installations par ménage.',
            'Mesures électriques (Prise de terre, différentiel).',
            'Signature du PV de réception avec l\'usager.'
        ],
        materials: ['Testeur de terre', 'Multimètre', 'Tablette'],
        hse: ['Vérification des EPI des équipes', 'Interdiction de mise sous tension si danger']
    },
    'Superviseur': {
        icon: ClipboardCheck,
        color: 'purple',
        missions: [
            'Coordonner les équipes sur zone',
            'Arbitrer les conflits techniques',
            'Garantir l\'application des règles HSE'
        ],
        materials: ['Tablette de terrain', 'Véhicule 4x4', 'EPI complet'],
        hse: ['Leadership sécurité', 'Audit constant des outils et véhicules']
    }
};

export default function Cahier() {
    const [selectedRole, setSelectedRole] = useState('Maçon');
    const [isEditing, setIsEditing] = useState(false);

    // Load local overrides or fallback to default
    const [customLibrary, setCustomLibrary] = useState(() => {
        try {
            const saved = localStorage.getItem('gem_cahier_library');
            if (saved) {
                const parsed = JSON.parse(saved);
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

    const currentTask = customLibrary[selectedRole as keyof typeof customLibrary];
    const CurrentIcon = currentTask.icon || Hammer;

    // Local state for the editable fields of the currently selected role
    const [editMissions, setEditMissions] = useState(currentTask.missions.join('\n'));
    const [editMaterials, setEditMaterials] = useState(currentTask.materials.join('\n'));
    const [editHse, setEditHse] = useState(currentTask.hse.join('\n'));

    // Reset editable fields when role changes
    const handleRoleChange = (role: string) => {
        setSelectedRole(role);
        setIsEditing(false);
        const task = customLibrary[role as keyof typeof customLibrary];
        setEditMissions(task.missions.join('\n'));
        setEditMaterials(task.materials.join('\n'));
        setEditHse(task.hse.join('\n'));
    };

    const handleSave = () => {
        const updatedLibrary = { ...customLibrary };
        updatedLibrary[selectedRole as keyof typeof customLibrary] = {
            ...currentTask,
            missions: editMissions.split('\n').filter(Boolean),
            materials: editMaterials.split('\n').filter(Boolean),
            hse: editHse.split('\n').filter(Boolean)
        };
        setCustomLibrary(updatedLibrary);
        localStorage.setItem('gem_cahier_library', JSON.stringify(updatedLibrary));
        setIsEditing(false);
    };

    const exportWord = () => {
        exportCahierToWord({
            role: selectedRole,
            missions: currentTask.missions,
            materials: currentTask.materials,
            hse: currentTask.hse,
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            responsible: '',
            contact: ''
        });
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            <header className="bg-slate-900 border-b border-slate-800 p-8 shrink-0">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Cahier des Charges</h2>
                        <p className="text-slate-500 mt-1">Spécifications techniques et missions par métier</p>
                    </div>
                    <button
                        onClick={exportWord}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        <Download size={20} />
                        <span>Exporter Word (Complet)</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Navigation Métiers */}
                    <aside className="lg:col-span-1 space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-4">Métiers du Projet</h4>
                        {Object.keys(customLibrary).map((role) => {
                            const Icon = customLibrary[role as keyof typeof customLibrary].icon || Hammer;
                            const color = customLibrary[role as keyof typeof customLibrary].color;
                            const isActive = selectedRole === role;

                            return (
                                <button
                                    key={role}
                                    onClick={() => handleRoleChange(role)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isActive
                                        ? `bg-${color}-500/10 border border-${color}-500/30 text-white shadow-xl`
                                        : 'hover:bg-slate-900 border border-transparent text-slate-400'
                                        }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <Icon size={18} className={isActive ? `text-${color}-400` : 'text-slate-600'} />
                                        <span className="font-semibold">{role}</span>
                                    </div>
                                    {isActive && <div className={`w-1.5 h-1.5 rounded-full bg-${color}-400 animate-pulse`} />}
                                </button>
                            );
                        })}
                    </aside>

                    {/* Details Content */}
                    <main className="lg:col-span-3 space-y-8">
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

                                    {isEditing ? (
                                        <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                            <Save size={16} /> Enregistrer
                                        </button>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-all border border-slate-700 active:scale-95">
                                            <Edit3 size={16} /> Éditer
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                                <section>
                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Missions Principales</h4>
                                    </div>
                                    {isEditing ? (
                                        <textarea
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
                                    <div className="flex items-center space-x-2 mb-6">
                                        <div className="w-1 h-6 bg-orange-500 rounded-full" />
                                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">Matériel & Logistique</h4>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-800 mb-6">
                                        {isEditing ? (
                                            <textarea
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
