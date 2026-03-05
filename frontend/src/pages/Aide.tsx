import { useState } from 'react';
import {
    Map as MapIcon,
    Truck,
    Settings,
    DollarSign,
    FileText,
    LayoutDashboard,
    HelpCircle,
    ChevronDown,
    Zap,
    Users,
    Bell,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    X,
    Calculator,
    ClipboardList,
    Target,
    CloudSync
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Screenshot gallery data ─────────────────────────────────────── */
const SCREENSHOTS = [
    {
        src: '/aide_dashboard_admin.png',
        label: 'Dashboard Admin',
        desc: 'KPIs temps réel, avancement régional et journal de synchronisation Kobo.',
    },
    {
        src: '/aide_terrain_map.png',
        label: 'Terrain & Grappes',
        desc: 'Carte interactive avec grappes colorées, filtres de statut et popups par groupe.',
    },
    {
        src: '/aide_team_dashboard.png',
        label: 'Dashboard Chef d\'Équipe',
        desc: 'Pipeline des 4 équipes, KPIs personnalisés et alerte de dépendance.',
    },
    {
        src: '/aide_pdf_rapport.png',
        label: 'Rapport PDF Multi-Pages',
        desc: '4 modèles PDF avec en-tête PROQUELEC, barres de progression et pied de page Page N/Total.',
    },
];

function ScreenshotGallery({ isDarkMode }: { isDarkMode: boolean }) {
    const [active, setActive] = useState(0);
    const [lightbox, setLightbox] = useState(false);

    const prev = () => setActive(i => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
    const next = () => setActive(i => (i + 1) % SCREENSHOTS.length);

    const s = SCREENSHOTS[active];

    return (
        <div className={`rounded-[2rem] border overflow-hidden ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
            {/* Main image */}
            <div className="relative group cursor-zoom-in" onClick={() => setLightbox(true)}>
                <img
                    src={s.src}
                    alt={s.label}
                    className="w-full h-64 md:h-80 object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                    onError={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.src = ''; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                    <h4 className="text-white font-black text-base">{s.label}</h4>
                    <p className="text-white/70 text-xs mt-0.5">{s.desc}</p>
                </div>
                <div className="absolute top-3 right-3 bg-black/40 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                    {active + 1} / {SCREENSHOTS.length}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between p-4">
                <button title="Image précédente" aria-label="Image précédente" onClick={prev} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    <ChevronLeft size={18} />
                </button>
                <div className="flex gap-2">
                    {SCREENSHOTS.map((_, i) => (
                        <button
                            key={i}
                            title={SCREENSHOTS[i].label}
                            aria-label={SCREENSHOTS[i].label}
                            onClick={() => setActive(i)}
                            className={`transition-all rounded-full ${i === active ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-500/40 hover:bg-slate-400'}`}
                        />
                    ))}
                </div>
                <button title="Image suivante" aria-label="Image suivante" onClick={next} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {lightbox && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-lg"
                        onClick={() => setLightbox(false)}
                    >
                        <button title="Fermer" aria-label="Fermer l'aperçu" className="absolute top-6 right-6 text-white hover:text-slate-300 transition-colors">
                            <X size={28} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            src={s.src}
                            alt={s.label}
                            className="max-w-5xl w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export default function Aide() {
    const { isDarkMode } = useTheme();
    const [openSection, setOpenSection] = useState<string | null>('dashboard');
    const toggleSection = (id: string) => setOpenSection(openSection === id ? null : id);

    const overviewData = [
        {
            id: 'dashboard',
            title: 'Dashboard Global (Admin / DG)',
            icon: LayoutDashboard,
            color: 'indigo',
            bg: 'bg-indigo-500/10 text-indigo-500',
            zap: 'text-indigo-400',
            content: [
                "KPIs en temps réel : total ménages, % avancement, zones actives, alertes terrain — source de vérité PostgreSQL.",
                "SaaS Multi-Tenant : Isolation stricte des données par organisation.",
                "Journal d'audit : Tracabilité complète de chaque action critique sur le serveur.",
                "Accès rapide : Rapports / Gestion Utilisateurs / Carte Terrain.",
                "Backend Haute Performance : Node.js avec moteur Prisma et accélération Redis.",
            ]
        },
        {
            id: 'team_dash',
            title: 'Dashboard Chef d\'Équipe',
            icon: Users,
            color: 'blue',
            bg: 'bg-blue-500/10 text-blue-500',
            zap: 'text-blue-400',
            content: [
                "Identifie automatiquement votre équipe via votre compte (Maçons, Réseau, Électricien, Livreur).",
                "Pipeline des 4 sous-équipes : % calculé depuis statuts réels synchronisés.",
                "Alerte dépendance : avertissement si l'équipe précédente est < 80%.",
                "Performance : Cache Redis pour un chargement instantané des KPIs d'équipe.",
            ]
        },
        {
            id: 'lse',
            title: 'Dashboard LSE (Suivi Client)',
            icon: BarChart3,
            color: 'emerald',
            bg: 'bg-emerald-500/10 text-emerald-500',
            zap: 'text-emerald-400',
            content: [
                "Bandeau de progression global animé — X% des ménages raccordés.",
                "Répartition par région et liste des 5 dernières validations terrain.",
                "Accès direct au Rapport PDF depuis le bouton Générer.",
            ]
        },
        {
            id: 'notifications',
            title: 'Alertes & Notifications',
            icon: Bell,
            color: 'amber',
            bg: 'bg-amber-500/10 text-amber-500',
            zap: 'text-amber-400',
            content: [
                "Bannière ambre automatique si la dernière sync Kobo date de > 24h.",
                "Notifications Push WebSockets : alertes temps réel lors des synchronisations terrains.",
                "Bouton 'Sync maintenant' intégré, se ferme avec ✕.",
                "Revérification automatique toutes les 5 minutes.",
            ]
        },
        {
            id: 'terrain',
            title: 'Terrain — Cartographie Interactive',
            icon: MapIcon,
            color: 'rose',
            bg: 'bg-rose-500/10 text-rose-500',
            zap: 'text-rose-400',
            content: [
                "Architecture Vector Tiles (MapLibre GL) : rendu fluide de 50 000+ points via GPU.",
                "Organisation K-Means : regroupement automatique en Grappes et Sous-grappes.",
                "Filtres de statut et popups d'information par grappe avec clustering natif.",
                "Routage : calcul d'itinéraires pour les livreurs.",
            ]
        },
        {
            id: 'logistique',
            title: 'Logistique & Opérations',
            icon: Truck,
            color: 'teal',
            bg: 'bg-teal-500/10 text-teal-500',
            zap: 'text-teal-400',
            content: [
                "Stock & Matériel : calcul BOM automatique + corrections manuelles admin.",
                "Atelier : IA prédictive pour estimer la date de fin de projet.",
                "Grappes & Affectations : assignez plusieurs équipes par zone.",
            ]
        },
        {
            id: 'rapports',
            title: 'Rapports PDF Multi-Pages',
            icon: BarChart3,
            color: 'purple',
            bg: 'bg-purple-500/10 text-purple-500',
            zap: 'text-purple-400',
            content: [
                "4 modèles : Avancement, Analyse Économique, Logistique, Kobo Sync.",
                "S'adapte au rôle connecté (Kobo Sync masqué pour chefs d'équipe).",
                "Pied de page dynamique 'Page N / Total' sur chaque page.",
                "Chiffres FCFA format ASCII-safe (1.234.567 FCFA) — plus de caractères &amp; parasites.",
            ]
        },
        {
            id: 'finances',
            title: 'Finances & Audit',
            icon: DollarSign,
            color: 'amber',
            bg: 'bg-amber-500/10 text-amber-500',
            zap: 'text-amber-400',
            content: [
                "Graphiques camembert dynamiques : répartition du budget.",
                "Tableau Devis VS Réel : identifiez les postes déficitaires.",
            ]
        },
        {
            id: 'parametres',
            title: 'Paramètres & Administration',
            icon: Settings,
            color: 'slate',
            bg: 'bg-slate-500/10 text-slate-400',
            zap: 'text-slate-400',
            content: [
                "Gestion multi-utilisateurs avec Rôles & Permissions (RBAC/ABAC).",
                "Sécurité Avancée : Mots de passe et 2FA hachés via Bcrypt sur le serveur.",
                "Migration : Outils pour basculer les données locales vers le SaaS Cloud.",
            ]
        },
        {
            id: 'cahier',
            title: 'Cahier des Charges Opérationnel',
            icon: FileText,
            color: 'fuchsia',
            bg: 'bg-fuchsia-500/10 text-fuchsia-500',
            zap: 'text-fuchsia-400',
            content: [
                "Synoptiques métier : missions détaillées par phases techniques (Génie civil, Réseau, Intérieur, etc).",
                "Matériel & HSE : listes exhaustives par corps d'état avec consignes de sécurité Senelec.",
                "Export Word (.doc) pro : inclut le logo Proquelec, introductions officielles et bloc de signatures.",
                "Export groupé : générez l'intégralité du dossier technique (tous les métiers) en un seul clic.",
            ]
        },
        {
            id: 'simulation',
            title: 'Moteur de Simulation & Optimisation',
            icon: Calculator,
            color: 'cyan',
            bg: 'bg-cyan-500/10 text-cyan-500',
            zap: 'text-cyan-400',
            content: [
                "IA de planification avec prise en compte des aléas (Hivernage, Trésorerie, Logistique, Retards internes).",
                "Graphiques d'impact temporel animés et calcul du surcoût lié aux risques.",
                "Ajustements interactifs de scénarios via une interface 'Glassmorphism' premium.",
            ]
        },
        {
            id: 'mission',
            title: 'Ordres de Mission (OM)',
            icon: ClipboardList,
            color: 'orange',
            bg: 'bg-orange-500/10 text-orange-500',
            zap: 'text-orange-400',
            content: [
                "Génération automatisée des Ordres de Mission avec calcul structuré des perdiems.",
                "Prise en charge des Zones (1, 2, 3) selon les barèmes nationaux en vigueur.",
                "Export PDF officiel (prêt à signer) et stockage sécurisé offline-first.",
            ]
        },
        {
            id: 'hub',
            title: 'Le Hub Central & Command Palette',
            icon: Target,
            color: 'indigo',
            bg: 'bg-indigo-500/10 text-indigo-500',
            zap: 'text-indigo-400',
            content: [
                "Navigation ultra-rapide et accès direct via raccourci clavier universel (Ctrl+K ou Cmd+K).",
                "Tableau de bord organisé par pôles stratégiques (Exploration, Intelligence, Outils Experts).",
                "Recherche instantanée et exécution d'actions systèmes directes à la volée.",
            ]
        },
        {
            id: 'synchronisation',
            title: 'Synchronisation Cloud & Master Local',
            icon: CloudSync,
            color: 'indigo',
            bg: 'bg-indigo-500/10 text-indigo-500',
            zap: 'text-indigo-400',
            content: [
                "Stratégie Master Local : Votre PC est la source de vérité pour les imports massifs (Excel).",
                "Commande PUSH (PC -> Cloud) : 'npm run sync-up' pour envoyer vos ménages vers Railway.",
                "Commande PULL (Cloud -> PC) : 'npm run sync-down' pour récupérer les validations du terrain.",
                "Protection Intelligente : Le système compare les dates (updatedAt) et ne remplace jamais une donnée plus récente.",
                "Auto-Sync : L'interface synchronise les petites modifications en temps réel sans action de votre part.",
            ]
        },
    ];

    return (
        <div className="p-6 md:p-8 space-y-6 pb-20 max-w-5xl mx-auto">
            {/* Header */}
            <header className="flex flex-col gap-2">
                <h1 className={`text-4xl font-black italic tracking-tighter flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                        <HelpCircle size={24} />
                    </div>
                    AIDE & TOUR D'HORIZON
                </h1>
                <p className={`text-[14px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Guide complet de GEM SaaS v3 PRO — architecture cloud avec backend PostgreSQL & performance temps réel.
                </p>
            </header>

            {/* Screenshot gallery */}
            <section>
                <h2 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    📸 Aperçu de l'Interface
                </h2>
                <ScreenshotGallery isDarkMode={isDarkMode} />
            </section>

            {/* Accordion sections */}
            <section>
                <h2 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    📖 Documentation par Module
                </h2>
                <div className="space-y-3">
                    {overviewData.map((section) => (
                        <div
                            key={section.id}
                            className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
                        >
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${section.bg}`}>
                                        <section.icon size={18} />
                                    </div>
                                    <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {section.title}
                                    </h3>
                                </div>
                                <ChevronDown
                                    size={18}
                                    className={`text-slate-400 transition-transform duration-300 ${openSection === section.id ? 'rotate-180' : ''}`}
                                />
                            </button>

                            <div className={`transition-all duration-300 ease-in-out ${openSection === section.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                <div className={`p-5 pt-0 border-t ${isDarkMode ? 'border-slate-800/50' : 'border-slate-100'}`}>
                                    <ul className="space-y-2.5 mt-4">
                                        {section.content.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <Zap size={14} className={`shrink-0 mt-0.5 ${section.zap}`} />
                                                <span className={`text-[13px] leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {item}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className={`p-6 rounded-2xl border text-center ${isDarkMode ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                    GEM SaaS v3 PRO — Backend PostgreSQL · PostGIS · Sécurité Bcrypt · BullMQ Workers · Multi-Tenancy
                </p>
            </div>
        </div>
    );
}
