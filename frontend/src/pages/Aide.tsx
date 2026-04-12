import { useState } from 'react';
import {
  Map as MapIcon,
  Truck,
  DollarSign,
  FileText,
  LayoutDashboard,
  HelpCircle,
  ChevronDown,
  Zap,
  Users,
  Bell,
  ShieldCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  Calculator,
  ClipboardList,
  Target,
  CloudSync,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

// Import centralized design system
import {
  PageContainer,
  PageHeader,
  Section,
  ContentArea,
  DESIGN_TOKENS,
  COMMON_CLASSES,
} from '../components';

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
    label: "Dashboard Chef d'Équipe",
    desc: 'Pipeline des 4 équipes, KPIs personnalisés et alerte de dépendance.',
  },
  {
    src: '/aide_pdf_rapport.png',
    label: 'Rapport PDF Multi-Pages',
    desc: '4 modèles PDF avec en-tête PROQUELEC, barres de progression et pied de page Page N/Total.',
  },
];

function ScreenshotGallery() {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const prev = () => setActive((i) => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
  const next = () => setActive((i) => (i + 1) % SCREENSHOTS.length);

  const s = SCREENSHOTS[active];

  return (
    <div className={`${COMMON_CLASSES.card} overflow-hidden shadow-md`}>
      {/* Main image */}
      <div className="relative group cursor-zoom-in" onClick={() => setLightbox(true)}>
        <img
          src={s.src}
          alt={s.label}
          className="w-full h-64 md:h-80 object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
          onError={(e) => {
            e.currentTarget.classList.add('bg-slate-800');
            e.currentTarget.src = '';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-5 right-5">
          <h4 className={`${DESIGN_TOKENS.typography.sizes.lg} text-white font-black`}>
            {s.label}
          </h4>
          <p className={`${DESIGN_TOKENS.typography.sizes.sm} text-white/70 mt-0.5`}>{s.desc}</p>
        </div>
        <div className="absolute top-3 right-3 bg-black/40 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
          {active + 1} / {SCREENSHOTS.length}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between p-4">
        <button
          aria-label="Image précédente"
          onClick={prev}
          className={`${COMMON_CLASSES.btnSecondary} p-2 rounded-xl`}
        >
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
        <button
          aria-label="Image suivante"
          onClick={next}
          className={`${COMMON_CLASSES.btnSecondary} p-2 rounded-xl`}
        >
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
            <button
              aria-label="Fermer"
              className="absolute top-6 right-6 text-white hover:text-slate-300 transition-colors"
            >
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
      bg: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100',
      zap: 'text-indigo-900 dark:text-indigo-100',
      content: [
        'KPIs en temps réel : total ménages, % avancement, zones actives, alertes terrain — source de vérité PostgreSQL.',
        'SaaS Multi-Tenant : Isolation stricte des données par organisation.',
        "Journal d'audit : Tracabilité complète de chaque action critique sur le serveur.",
        'Accès rapide : Rapports / Gestion Utilisateurs / Carte Terrain.',
        'Backend Haute Performance : Node.js avec moteur Prisma et accélération Redis.',
      ],
    },
    {
      id: 'team_dash',
      title: "Dashboard Chef d'Équipe",
      icon: Users,
      color: 'blue',
      bg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100',
      zap: 'text-blue-900 dark:text-blue-100',
      content: [
        'Identifie automatiquement votre équipe via votre compte (Maçons, Réseau, Électricien, Livreur).',
        'Pipeline des 4 sous-équipes : % calculé depuis statuts réels synchronisés.',
        "Alerte dépendance : avertissement si l'équipe précédente est < 80%.",
        "Performance : Cache Redis pour un chargement instantané des KPIs d'équipe.",
      ],
    },
    {
      id: 'lse',
      title: 'Dashboard LSE (Suivi Client)',
      icon: BarChart3,
      color: 'emerald',
      bg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100',
      zap: 'text-emerald-900 dark:text-emerald-100',
      content: [
        'Bandeau de progression global animé — X% des ménages raccordés.',
        'Répartition par région et liste des 5 dernières validations terrain.',
        'Accès direct au Rapport PDF depuis le bouton Générer.',
      ],
    },
    {
      id: 'notifications',
      title: 'Alertes & Notifications',
      icon: Bell,
      color: 'amber',
      bg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100',
      zap: 'text-amber-900 dark:text-amber-100',
      content: [
        'Bannière ambre automatique si la dernière sync Kobo date de > 24h.',
        'Notifications Push WebSockets : alertes temps réel lors des synchronisations terrains.',
        "Bouton 'Sync maintenant' intégré, se ferme avec ✕.",
        'Revérification automatique toutes les 5 minutes.',
      ],
    },
    {
      id: 'terrain',
      title: 'Carte Terrain — Mode Google Maps Entreprise',
      icon: MapIcon,
      color: 'rose',
      bg: 'bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-100',
      zap: 'text-rose-900 dark:text-rose-100',
      content: [
        'Architecture Vector Tiles (MapLibre MVT) : rendu GPU fluide de 100 000+ points avec clustering natif automatique.',
        "Routing OSRM natif : Tracé d'itinéraire précis et calcul de distance entre votre position GPS et n'importe quel ménage.",
        '100% Mobile Responsive : Interface et panneaux tactiles optimisés pour une utilisation fluides sur smartphone.',
        'Géolocalisation continue : Suivi en temps réel de votre position avec bouton de recentrage dynamique.',
        'Outils intégrés : Zoom, Carte satellite/rues, Heatmap thermique, Légende interactive, Régionalisation (Grappes).',
      ],
    },
    {
      id: 'tournee',
      title: 'Planification de Tournées Camion',
      icon: Truck,
      color: 'cyan',
      bg: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-900 dark:text-cyan-100',
      zap: 'text-cyan-900 dark:text-cyan-100',
      content: [
        "Panneau multi-stops : sélectionnez les ménages à visiter dans l'ordre que vous souhaitez.",
        'Calcul automatique de la distance totale et estimation du coût carburant en FCFA.',
        "Bouton 'Lancer la tournée' : ouvre Google Maps avec l'itinéraire optimisé pour le chauffeur.",
        "Activé depuis l'icône Camion 🚛 dans la barre d'outils de la carte.",
      ],
    },
    {
      id: 'geofencing',
      title: 'Alertes GPS & Galerie Photos Kobo',
      icon: Bell,
      color: 'orange',
      bg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-100',
      zap: 'text-orange-900 dark:text-orange-100',
      content: [
        'Détection géofencing : alerte automatique si un ménage actif est à plus de 2km de sa zone assignée.',
        'Chaque alerte inclut un lien direct Google Maps pour vérifier la position réelle sur le terrain.',
        "Galerie photos Kobo : cliquez sur une photo de ménage pour l'afficher en plein écran (lightbox).",
        'Navigation clavier dans le lightbox : flèches ← → pour passer de la photo maison à la photo compteur.',
      ],
    },
    {
      id: 'logistique',
      title: 'Logistique & Opérations',
      icon: Truck,
      color: 'teal',
      bg: 'bg-teal-100 dark:bg-teal-900/50 text-teal-900 dark:text-teal-100',
      zap: 'text-teal-900 dark:text-teal-100',
      content: [
        'Stock & Matériel : calcul BOM automatique + corrections manuelles admin.',
        'Atelier : IA prédictive pour estimer la date de fin de projet.',
        'Grappes & Affectations : assignez plusieurs équipes par zone.',
      ],
    },
    {
      id: 'rapports',
      title: 'Rapports PDF Multi-Pages',
      icon: BarChart3,
      color: 'purple',
      bg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-100',
      zap: 'text-purple-900 dark:text-purple-100',
      content: [
        '4 modèles : Avancement, Analyse Économique, Logistique, Kobo Sync.',
        "S'adapte au rôle connecté (Kobo Sync masqué pour chefs d'équipe).",
        "Pied de page dynamique 'Page N / Total' sur chaque page.",
        'Chiffres FCFA format ASCII-safe (1.234.567 FCFA) — plus de caractères & parasites.',
      ],
    },
    {
      id: 'finances',
      title: 'Finances & Audit',
      icon: DollarSign,
      color: 'amber',
      bg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100',
      zap: 'text-amber-900 dark:text-amber-100',
      content: [
        'Graphiques camembert dynamiques : répartition du budget.',
        'Tableau Devis VS Réel : identifiez les postes déficitaires.',
      ],
    },
    {
      id: 'parametres',
      title: 'Sécurité & Contrôle Administrateur',
      icon: ShieldCheck,
      color: 'slate',
      bg: 'bg-slate-100 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100',
      zap: 'text-slate-900 dark:text-slate-100',
      content: [
        "God Mode Administrateur : L'Admin possède un accès 'Passe-Partout' total sur toutes les fonctions de sécurité.",
        "Maître des Permissions : L'Admin peut outrepasser les rôles par défaut pour donner n'importe quel accès spécifique (ex: Terrain au Comptable).",
        'Double Authentification (2FA) : Forçage de sécurité par compte avec question secrète hachée via Bcrypt.',
        'Isolation SaaS : Chaque organisation possède sa propre configuration cloud étanche.',
      ],
    },
    {
      id: 'cahier',
      title: 'Cahier des Charges Opérationnel',
      icon: FileText,
      color: 'fuchsia',
      bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-900 dark:text-fuchsia-100',
      zap: 'text-fuchsia-900 dark:text-fuchsia-100',
      content: [
        'Synoptiques métier : missions détaillées par phases techniques (Génie civil, Réseau, Intérieur, etc).',
        "Matériel & HSE : listes exhaustives par corps d'état avec consignes de sécurité Senelec.",
        'Export Word (.doc) pro : inclut le logo Proquelec, introductions officielles et bloc de signatures.',
        "Export groupé : générez l'intégralité du dossier technique (tous les métiers) en un seul clic.",
      ],
    },
    {
      id: 'simulation',
      title: 'Moteur de Simulation & Optimisation',
      icon: Calculator,
      color: 'cyan',
      bg: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-900 dark:text-cyan-100',
      zap: 'text-cyan-900 dark:text-cyan-100',
      content: [
        'IA de planification avec prise en compte des aléas (Hivernage, Trésorerie, Logistique, Retards internes).',
        "Graphiques d'impact temporel animés et calcul du surcoût lié aux risques.",
        "Ajustements interactifs de scénarios via une interface 'Glassmorphism' premium.",
      ],
    },
    {
      id: 'mission',
      title: 'Cockpit DG & Ordres de Mission (OM)',
      icon: ClipboardList,
      color: 'orange',
      bg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-100',
      zap: 'text-orange-900 dark:text-orange-100',
      content: [
        "Workflow Décisionnel : Circuit court 'Initiateur → Direction Générale' pour une validation instantanée.",
        'Cockpit DG : Dashboard dédié avec KPIs financiers, coûts membres et archives certifiées.',
        "Certification Immuable : Une fois approuvée par le DG, la mission est verrouillée et reçoit son numéro d'ordre officiel.",
        "Notifications Automatiques : Emails envoyés à la Direction (Soumission) et à l'Initiateur (Certification).",
        'Gestion des Perdiems : Calcul structuré par zones (1, 2, 3) selon les barèmes officiels.',
      ],
    },
    {
      id: 'hub',
      title: 'Le Hub Central & Command Palette',
      icon: Target,
      color: 'indigo',
      bg: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100',
      zap: 'text-indigo-900 dark:text-indigo-100',
      content: [
        'Navigation ultra-rapide et accès direct via raccourci clavier universel (Ctrl+K ou Cmd+K).',
        'Tableau de bord organisé par pôles stratégiques (Exploration, Intelligence, Outils Experts).',
        "Recherche instantanée et exécution d'actions systèmes directes à la volée.",
      ],
    },
    {
      id: 'synchronisation',
      title: 'Synchronisation Cloud & Master Local',
      icon: CloudSync,
      color: 'indigo',
      bg: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100',
      zap: 'text-indigo-900 dark:text-indigo-100',
      content: [
        'Stratégie Master Local : Votre PC est la source de vérité pour les imports massifs (Excel).',
        "Commande PUSH (PC -> Cloud) : 'npm run sync-up' pour envoyer vos ménages vers Railway.",
        "Commande PULL (Cloud -> PC) : 'npm run sync-down' pour récupérer les validations du terrain.",
        'Protection Intelligente : Le système compare les dates (updatedAt) et ne remplace jamais une donnée plus récente.',
        "Auto-Sync : L'interface synchronise les petites modifications en temps réel sans action de votre part.",
      ],
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Aide & Tour d'Horizon"
        subtitle="Guide complet de GEM SaaS v3 PRO — architecture cloud avec backend PostgreSQL & performance temps réel."
        icon={HelpCircle}
      />

      <Section title="📸 Aperçu de l'Interface">
        <ScreenshotGallery />
      </Section>

      <Section title="📖 Documentation par Module">
        <ContentArea>
          <div className="space-y-3">
            {overviewData.map((section) => (
              <div
                key={section.id}
                className={`${COMMON_CLASSES.card} overflow-hidden transition-all duration-300`}
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-black/5 dark:hover:bg-white/5 dark:bg-slate-900/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${section.bg}`}>
                      <section.icon size={18} />
                    </div>
                    <h3 className={`${COMMON_CLASSES.heading3} font-bold`}>{section.title}</h3>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-300 ${openSection === section.id ? 'rotate-180' : ''}`}
                  />
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out ${openSection === section.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                >
                  <div
                    className={`p-5 pt-0 border-t ${isDarkMode ? 'border-slate-800/50' : 'border-slate-100'}`}
                  >
                    <ul className="space-y-2.5 mt-4">
                      {section.content.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Zap size={14} className={`shrink-0 mt-0.5 ${section.zap}`} />
                          <span className={`${COMMON_CLASSES.body} leading-relaxed font-medium`}>
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
        </ContentArea>
      </Section>

      <div
        className={`${COMMON_CLASSES.card} text-center ${isDarkMode ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}
      >
        <p
          className={`${COMMON_CLASSES.body} font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}
        >
          GEM SaaS v3.9 — Routing OSRM · Tuiles MVT · Geofencing · Mobile Responsive · Redis BullMQ
        </p>
      </div>
    </PageContainer>
  );
}
