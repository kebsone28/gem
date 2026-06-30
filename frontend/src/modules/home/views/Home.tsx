import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { normalizeRole, ROLES, isPlatformAdmin } from '@core/security/permissions';
import { useProjectSelector } from '@hooks/useProjectSelector';
import { projectService } from '@services/projectService';
import styles from './Home.module.css';
import {
  Plus,
  Search,
  Grid,
  List,
  Target,
  Clock,
  Activity,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Pencil,
  Trash2,
  Lock,
  Building,
  Users,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractApiError } from '@utils/format';
import { Modal, Button, Pagination } from '@components/UI';

const getProjectDomain = (p: any): string => {
  const sector = p.config?.sector || '';
  if (sector.startsWith('mes_')) return 'mes';
  if (sector.startsWith('gem_') || sector.startsWith('elec_')) return 'gem';
  return '';
};

const SECTOR_META: Record<string, { label: string; title: string; accent: string }> = {
  gem: {
    label: 'GEM',
    title: 'Secteur GEM',
    accent: 'text-amber-300',
  },
  mes: {
    label: 'MES',
    title: 'Secteur MES',
    accent: 'text-sky-300',
  },
};

const HOME_THEME = {
  default: {
    pageGradient: 'from-slate-950 via-slate-900 to-slate-950',
    orbTop: 'bg-blue-600/10',
    orbBottom: 'bg-purple-600/10',
    logoGradient: 'from-blue-500 to-purple-600',
    logoShadow: 'shadow-blue-500/20',
    indicator: 'bg-blue-500',
    linkText: 'text-blue-400 hover:text-blue-300',
    heroGradient: 'from-blue-400 via-purple-500 to-emerald-400',
    primaryButton: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20',
    searchFocus: 'group-focus-within:text-blue-400',
    filterActive: 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20',
    toggleActive: 'bg-blue-600 text-white shadow-lg',
    emptyBadge: 'text-slate-300',
    emptyButtonHover: 'hover:bg-blue-500',
    cardHoverBorder: 'hover:border-blue-500/30',
    cardOverlay: 'group-hover:from-blue-600/5 group-hover:via-purple-600/5 group-hover:to-emerald-600/5',
    cardTitleHover: 'group-hover:text-blue-400',
    cardEditHover: 'hover:bg-indigo-600',
    cardArrow: 'group-hover:text-blue-400',
    cardArrowBg: 'group-hover:bg-blue-500/10',
    progressGradient: 'from-blue-500 to-purple-600',
    floatingCta: 'bg-blue-600 shadow-blue-600/40',
    heroAccent: 'text-blue-300',
    stats: [
      { color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/20', text: 'text-blue-400' },
      { color: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/20', text: 'text-emerald-400' },
      { color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/20', text: 'text-purple-400' },
      { color: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/20', text: 'text-amber-400' },
    ],
  },
  gem: {
    pageGradient: 'from-slate-950 via-[#221407] to-slate-950',
    orbTop: 'bg-amber-500/12',
    orbBottom: 'bg-orange-500/10',
    logoGradient: 'from-amber-400 to-orange-500',
    logoShadow: 'shadow-amber-500/20',
    indicator: 'bg-amber-400',
    linkText: 'text-amber-300 hover:text-amber-200',
    heroGradient: 'from-amber-300 via-orange-400 to-yellow-200',
    primaryButton: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20',
    searchFocus: 'group-focus-within:text-amber-300',
    filterActive: 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20',
    toggleActive: 'bg-amber-500 text-slate-950 shadow-lg',
    emptyBadge: 'text-amber-200',
    emptyButtonHover: 'hover:bg-amber-500',
    cardHoverBorder: 'hover:border-amber-400/30',
    cardOverlay: 'group-hover:from-amber-500/10 group-hover:via-orange-500/5 group-hover:to-yellow-400/5',
    cardTitleHover: 'group-hover:text-amber-200',
    cardEditHover: 'hover:bg-amber-500',
    cardArrow: 'group-hover:text-amber-300',
    cardArrowBg: 'group-hover:bg-amber-500/10',
    progressGradient: 'from-amber-400 to-orange-500',
    floatingCta: 'bg-amber-500 shadow-amber-500/40',
    heroAccent: 'text-amber-200',
    stats: [
      { color: 'from-amber-500/20 to-orange-500/5', border: 'border-amber-500/20', text: 'text-amber-300' },
      { color: 'from-emerald-500/20 to-lime-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300' },
      { color: 'from-orange-500/20 to-amber-500/5', border: 'border-orange-500/20', text: 'text-orange-300' },
      { color: 'from-yellow-500/20 to-amber-500/5', border: 'border-yellow-500/20', text: 'text-yellow-300' },
    ],
  },
  mes: {
    pageGradient: 'from-slate-950 via-[#081425] to-slate-950',
    orbTop: 'bg-sky-500/12',
    orbBottom: 'bg-indigo-500/10',
    logoGradient: 'from-sky-400 to-indigo-500',
    logoShadow: 'shadow-sky-500/20',
    indicator: 'bg-sky-400',
    linkText: 'text-sky-300 hover:text-sky-200',
    heroGradient: 'from-sky-300 via-cyan-300 to-indigo-300',
    primaryButton: 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20',
    searchFocus: 'group-focus-within:text-sky-300',
    filterActive: 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/20',
    toggleActive: 'bg-sky-500 text-slate-950 shadow-lg',
    emptyBadge: 'text-sky-200',
    emptyButtonHover: 'hover:bg-sky-500',
    cardHoverBorder: 'hover:border-sky-400/30',
    cardOverlay: 'group-hover:from-sky-500/10 group-hover:via-cyan-500/5 group-hover:to-indigo-500/5',
    cardTitleHover: 'group-hover:text-sky-200',
    cardEditHover: 'hover:bg-sky-500',
    cardArrow: 'group-hover:text-sky-300',
    cardArrowBg: 'group-hover:bg-sky-500/10',
    progressGradient: 'from-sky-400 to-indigo-500',
    floatingCta: 'bg-sky-500 shadow-sky-500/40',
    heroAccent: 'text-sky-200',
    stats: [
      { color: 'from-sky-500/20 to-indigo-500/5', border: 'border-sky-500/20', text: 'text-sky-300' },
      { color: 'from-emerald-500/20 to-cyan-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300' },
      { color: 'from-indigo-500/20 to-sky-500/5', border: 'border-indigo-500/20', text: 'text-indigo-300' },
      { color: 'from-cyan-500/20 to-sky-500/5', border: 'border-cyan-500/20', text: 'text-cyan-300' },
    ],
  },
} as const;

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const domainTypeParam = searchParams.get('domainType') || '';
  const projectSelectorData = useProjectSelector();
  const {
    projects,
    filteredProjects,
    loading,
    switchProject,
    setProjectFilter,
    setSearchTerm,
    projectFilter,
  } = projectSelectorData;

  const { refreshProjects, setActiveProjectId } = useProject();

  const normalizedRole = normalizeRole(user?.role || '');

  const isGlobalAdmin =
    (user ? isPlatformAdmin(user as any) : false) ||
    normalizedRole === ROLES.ADMIN ||
    normalizedRole === ROLES.DIRECTEUR;

  const storedSector = typeof window !== 'undefined' ? localStorage.getItem('selectedSector') || '' : '';
  const activeSectorKey = (domainTypeParam || storedSector || '').toLowerCase();
  const activeSectorMeta = SECTOR_META[activeSectorKey];
  const theme = HOME_THEME[activeSectorKey as keyof typeof HOME_THEME] || HOME_THEME.default;

  const availableProjects = useMemo(() => {
    if (!domainTypeParam) return filteredProjects;
    return filteredProjects.filter(p => getProjectDomain(p) === domainTypeParam);
  }, [filteredProjects, domainTypeParam]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const [deleteModal, setDeleteModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(availableProjects.length / ITEMS_PER_PAGE));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return availableProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [availableProjects, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (projects.length === 0) {
      refreshProjects().catch(console.error);
    }
  }, [user, navigate, projects.length]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case ROLES.PLATFORM_ADMIN:
      case ROLES.ADMIN:
      case ROLES.DIRECTEUR:
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case ROLES.CHEF_PROJET:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case ROLES.COMPTABLE:
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case ROLES.PATRIMOINE:
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case ROLES.SUPERVISEUR:
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case ROLES.CONTROLEUR:
        return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'planning':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      case 'paused':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setActiveProjectId(projectId);
    switchProject(projectId);
    navigate('/executive/dashboard');
  };

  const handleProjectDelete = async (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    setDeleteModal({ projectId, projectName });
    setDeletePassword('');
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { projectId, projectName } = deleteModal;

    if (!deletePassword.trim()) {
      toast.error('Mot de passe requis pour confirmer la suppression.');
      return;
    }

    setDeleteLoading(true);
    try {
      await projectService.deleteProject(projectId, deletePassword.trim());
      toast.success(`Projet "${projectName}" supprimé avec succès.`);
      setDeleteModal(null);
      setDeletePassword('');
      await refreshProjects();
    } catch (err: any) {
      toast.error(extractApiError(err, 'Erreur lors de la suppression'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const getNotifications = () => {
    return [
      {
        id: 1,
        type: 'project_update',
        title: 'Nouveau projet assigné',
        description: 'Vous avez été assigné au projet "Infrastructure LSE"',
        time: 'Il y a 2 heures',
        icon: Target,
        color: 'text-blue-400',
      },
      {
        id: 2,
        type: 'mission_complete',
        title: 'Mission terminée',
        description: 'La mission "Maintenance Senelec" a été complétée',
        time: 'Il y a 5 heures',
        icon: CheckCircle2,
        color: 'text-emerald-400',
      },
      {
        id: 3,
        type: 'deadline',
        title: 'Échéance approche',
        description: 'Le projet "Proquelec Internal" arrive à échéance',
        time: 'Il y a 1 jour',
        icon: AlertTriangle,
        color: 'text-amber-400',
      },
    ];
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-outfit">
      {/* Modern Geometric Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.pageGradient}`} />
        <div className={`absolute inset-0 opacity-10 ${styles.geometricBackground}`} />
        <motion.div
          animate={{
            opacity: [0.1, 0.2, 0.1],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className={`absolute -top-20 -right-20 w-[600px] h-[600px] ${theme.orbTop} rounded-full blur-[120px] z-0`}
        />
        <motion.div
          animate={{
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className={`absolute -bottom-20 -left-20 w-[500px] h-[500px] ${theme.orbBottom} rounded-full blur-[100px] z-0`}
        />
      </div>

      {/* Header Premium */}
      <header className="bg-slate-950/40 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br ${theme.logoGradient} rounded-[1rem] flex items-center justify-center shadow-lg ${theme.logoShadow}`}>
                  <Building size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-white tracking-tight">GED OS</h1>
                  <p className="text-[10px] md:text-xs text-slate-400 font-medium">Gestion Multi-Projets</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-4">
                <div
                  className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider ${getRoleColor(normalizedRole ?? '')}`}
                >
                  {normalizedRole || 'Utilisateur'}
                </div>
                <div className="text-sm text-slate-300 font-medium truncate max-w-[150px]">{user.name}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                title="Notifications"
                aria-label="Afficher les notifications"
                aria-expanded={showNotifications}
              >
                <Bell size={18} className="text-slate-300 group-hover:text-white transition-colors" />
                <span className={`absolute top-2.5 right-2.5 w-2 h-2 ${theme.indicator} rounded-full border-2 border-slate-900`}></span>
              </button>

              <button 
                onClick={() => navigate('/aide')}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group hidden xs:block"
                title="Aide"
              >
                <HelpCircle size={18} className="text-slate-300 group-hover:text-white transition-colors" />
              </button>

              <button 
                onClick={() => navigate('/admin/hub')}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                title="Paramètres"
              >
                <Settings size={18} className="text-slate-300 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={logout}
                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl transition-all group"
                title="Déconnexion"
              >
                <LogOut size={18} className="text-red-400 group-hover:text-red-300 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-4 md:right-6 top-16 md:top-20 w-[calc(100vw-2rem)] md:w-96 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-5 border-b border-white/5 bg-white/5">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Notifications</h3>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {getNotifications().map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <motion.div
                      key={notification.id}
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                      className="p-4 border-b border-white/5 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notification.color} bg-white/5`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white leading-tight">{notification.title}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{notification.description}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-2">{notification.time}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="p-4 text-center bg-white/5">
                <button className={`text-xs font-black transition-colors uppercase tracking-widest ${theme.linkText}`}>
                  Tout marquer comme lu
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="px-4 md:px-6 py-8 md:py-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-16 mb-12 md:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left flex-1"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.1] tracking-tight">
                Pilotez vos <br className="hidden md:block" />
                <span className={`bg-gradient-to-r ${theme.heroGradient} bg-clip-text text-transparent`}>
                  Opérations
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl leading-relaxed font-medium mx-auto lg:mx-0">
                L'écosystème intelligent pour connecter le terrain, automatiser vos flux et piloter l'avenir de vos projets.
              </p>
              {activeSectorMeta && (
                <div className={`mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${theme.heroAccent}`}>
                  {activeSectorMeta.label}
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-300">Espace Projets</span>
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                {isGlobalAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(activeSectorKey ? `/projects/create?domainType=${encodeURIComponent(activeSectorKey)}` : '/projects/create')}
                    className={`px-6 py-3.5 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 ${theme.primaryButton}`}
                  >
                    <Plus size={18} />
                    Nouveau Projet
                  </motion.button>
                )}
                <button 
                  onClick={() => navigate('/executive/dashboard')}
                  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
                >
                  Dashboard Global
                </button>
              </div>
            </motion.div>

            {/* Mascot Container - Dynamic and Responsive on Mobile/Tablet/Desktop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="relative shrink-0 flex flex-col items-center mt-16 lg:mt-0"
            >
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <img
                  src="/assets/mascot.png"
                  alt="GEM Mascot"
                  className="w-48 sm:w-56 lg:w-80 h-auto drop-shadow-[0_32px_64px_rgba(59,130,246,0.4)]"
                />
              </motion.div>

              {/* Glass Bubble - Premium, Responsive & Pixel-Perfect Speech Indicator */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="absolute -top-20 left-1/2 -translate-x-1/2 lg:-top-12 lg:-left-36 lg:translate-x-0 bg-white/10 backdrop-blur-2xl border border-white/20 p-4 sm:p-5 rounded-[1.5rem] shadow-2xl w-[200px] xs:w-[220px] sm:w-[240px] z-20"
              >
                <p className="text-xs sm:text-sm font-bold text-white italic leading-relaxed text-center lg:text-left">
                  "Bonjour {user.name.split(' ')[0]} ! Prêt à transformer vos objectifs en réalité ?"
                </p>
                {/* Mobile Pointer - Bottom Centered (Visible on mobile/tablet) */}
                <div 
                  className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white/10 backdrop-blur-2xl border-r border-b border-white/20 rotate-45 lg:hidden" 
                  style={{ clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%)' }}
                />
                {/* Desktop Pointer - Right Centered (Visible on desktop) */}
                <div 
                  className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white/10 backdrop-blur-2xl border-t border-r border-white/20 rotate-45 hidden lg:block" 
                  style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                />
              </motion.div>
              
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 sm:w-72 sm:h-72 ${theme.orbTop.replace('/12', '/20').replace('/10', '/20')} rounded-full blur-[80px] -z-10`} />
            </motion.div>
          </div>

          {/* Stats Cards - Optimized 2x2 Grid on Mobile */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12 md:mb-16">
            {[
              { 
                label: isGlobalAdmin ? 'Projets Totaux' : 'Mes Projets', 
                value: isGlobalAdmin ? projects.length : availableProjects.length,
                icon: Target,
                color: 'from-blue-500/20 to-blue-600/5',
                border: 'border-blue-500/20',
                text: 'text-blue-400'
              },
              {
                label: 'Projets Actifs', 
                value: (domainTypeParam && !isGlobalAdmin ? availableProjects : isGlobalAdmin ? projects : availableProjects).filter(p => p.status === 'active').length,
                icon: Activity,
                color: 'from-emerald-500/20 to-emerald-600/5',
                border: 'border-emerald-500/20',
                text: 'text-emerald-400'
              },
              {
                label: 'Accès Ouverts', 
                value: (domainTypeParam && !isGlobalAdmin ? availableProjects : isGlobalAdmin ? projects : availableProjects).filter(p => !p.isArchived).length,
                icon: Users,
                color: 'from-purple-500/20 to-purple-600/5',
                border: 'border-purple-500/20',
                text: 'text-purple-400'
              },
              { 
                label: 'En Attente', 
                value: (isGlobalAdmin ? projects : availableProjects).filter(p => p.status === 'planning').length,
                icon: Clock,
                color: 'from-amber-500/20 to-amber-600/5',
                border: 'border-amber-500/20',
                text: 'text-amber-400'
              }
            ].map((stat, idx) => {
              const themedStat = theme.stats[idx] || theme.stats[0];
              return (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className={`bg-gradient-to-br ${themedStat.color} border ${themedStat.border} rounded-[1.5rem] p-5 md:p-6 backdrop-blur-xl transition-all shadow-lg shadow-black/20`}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`p-2 rounded-xl bg-white/5 ${themedStat.text}`}>
                    <stat.icon size={20} />
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-white">{stat.value}</span>
                </div>
                <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</h3>
              </motion.div>
            )})}
          </div>

          {/* Search and Filters - Compact & Glassy */}
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search
                  className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors ${theme.searchFocus}`}
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Rechercher un projet par nom ou client..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/10 transition-all font-medium"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'Tous', color: 'blue' },
                  { id: 'active', label: 'Actifs', color: 'emerald' },
                  { id: 'completed', label: 'Terminés', color: 'slate' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setProjectFilter(f.id as any); setCurrentPage(1); }}
                    className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
                      projectFilter === f.id
                        ? theme.filterActive
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 shrink-0 ml-auto md:ml-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'grid' ? theme.toggleActive : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Affichage grille"
                  aria-label="Afficher en grille"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'list' ? theme.toggleActive : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Affichage liste"
                  aria-label="Afficher en liste"
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Projects List/Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-purple-500/10 border-b-purple-500 rounded-full animate-spin-slow"></div>
                </div>
              </div>
              <p className="mt-6 text-slate-500 font-black uppercase tracking-[0.2em] text-xs">Initialisation...</p>
            </div>
          ) : availableProjects.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 bg-white/5 border border-white/5 rounded-[2rem] backdrop-blur-xl"
            >
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Target size={32} className="text-slate-600" />
              </div>
              <div className="mb-4 flex justify-center">
                <span className={`rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] ${activeSectorMeta?.accent || 'text-slate-300'}`}>
                  {activeSectorMeta ? `${activeSectorMeta.label} selectionne` : 'Aucun secteur filtre'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mb-3">
                {activeSectorMeta ? `Aucun projet dans ${activeSectorMeta.title}` : 'Aucun projet disponible'}
              </h2>
              <p className="text-slate-400 mb-10 max-w-sm mx-auto font-medium">
                {activeSectorMeta
                  ? `Le secteur choisi est pret, mais aucun projet ${activeSectorMeta.label} n'a encore ete cree dans cette organisation.`
                  : "Aucun projet ne correspond a vos criteres. C'est le moment ideal pour en creer un nouveau."}
              </p>
              {isGlobalAdmin ? (
                <button
                  onClick={() => navigate(activeSectorKey ? `/projects/create?domainType=${encodeURIComponent(activeSectorKey)}` : '/projects/create')}
                  className={`inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest ${theme.emptyButtonHover} hover:text-white transition-all shadow-xl`}
                >
                  <Plus size={20} />
                  {activeSectorMeta ? `Creer un projet ${activeSectorMeta.label}` : 'Demarrer un Projet'}
                </button>
              ) : (
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Contactez votre administrateur pour obtenir un accès
                </p>
              )}
            </motion.div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8'
                  : 'space-y-4'
              }
            >
              {paginatedProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -8, shadow: '0 20px 40px -20px rgba(0,0,0,0.5)' }}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`group relative overflow-hidden bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] cursor-pointer transition-all ${theme.cardHoverBorder} ${
                    viewMode === 'list' ? 'p-4 flex items-center gap-5' : 'p-5'
                  }`}
                >
                  {/* Decorative Gradient Background on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-blue-600/0 via-purple-600/0 to-emerald-600/0 ${theme.cardOverlay} transition-all duration-500 opacity-0 group-hover:opacity-100 pointer-events-none`} />

                  <div className={`flex items-start justify-between ${viewMode === 'list' ? 'flex-1' : 'mb-4'}`}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg ${getStatusColor(project.status)} bg-white/5`}
                      >
                        {project.status === 'active' && <Activity size={20} />}
                        {project.status === 'planning' && <Calendar size={20} />}
                        {project.status === 'completed' && <CheckCircle2 size={20} />}
                        {project.status === 'paused' && <AlertTriangle size={20} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-lg font-black text-white transition-colors tracking-tight line-clamp-1 ${theme.cardTitleHover}`}>{project.name}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mt-0.5 truncate">
                          {(project as any).config?.client || project.client || 'Client Privé'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {isGlobalAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/project-edit/${project.id}`);
                            }}
                            className={`p-2 rounded-lg bg-white/5 ${theme.cardEditHover} text-slate-400 hover:text-white border border-white/5 transition-all`}
                            title="Modifier"
                          >
                            <Pencil size={12} />
                          </button>
                          {project.name === 'GEM SAAS' ? (
                            <div className="p-2 rounded-lg bg-white/5 text-amber-500/40 border border-white/5">
                              <Lock size={12} />
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleProjectDelete(e, project.id, project.name)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-red-600 text-slate-400 hover:text-white border border-white/5 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 ${theme.cardArrow} ${theme.cardArrowBg} transition-all`}>
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>

                  {viewMode === 'grid' && (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getStatusColor(project.status)}`}>
                            {project.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getPriorityColor(project.priority)}`}>
                            {project.priority}
                          </span>
                        </div>
                        <div className="text-[11px] font-black text-white/90">
                          {Math.round(project.progress || 0)}%
                        </div>
                      </div>

                      {/* Progress Bar Premium - More compact */}
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress || 0}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className={`h-full bg-gradient-to-r ${theme.progressGradient} relative`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        </motion.div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-slate-600" />
                          <span>{(project.assignedUsers || []).length} Membre{(project.assignedUsers || []).length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-600" />
                          <span>{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('fr-FR') : '---'}</span>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {!loading && availableProjects.length > 0 && totalPages > 1 && (
            <div className="mt-10">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}

          {/* Quick Actions Global Area */}
          {(normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.DIRECTEUR) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-20 md:mt-32"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-[0.25em]">Centre de Contrôle</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Gestion Projets',
                    desc: 'Modèles, configurations et archives',
                    icon: Building,
                    color: 'text-blue-400',
                    bg: 'from-blue-500/10 to-transparent',
                    path: '/projects/create'
                  },
                  {
                    title: 'Utilisateurs',
                    desc: 'Permissions et annuaire global',
                    icon: Users,
                    color: 'text-purple-400',
                    bg: 'from-purple-500/10 to-transparent',
                    path: '/admin/users'
                  },
                  {
                    title: 'Hub Global',
                    desc: 'Paramètres système et modules',
                    icon: Settings,
                    color: 'text-emerald-400',
                    bg: 'from-emerald-500/10 to-transparent',
                    path: '/admin/hub'
                  }
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(action.path)}
                    className={`bg-gradient-to-br ${action.bg} border border-white/5 rounded-[2rem] p-8 text-left transition-all group`}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 ${action.color} group-hover:scale-110 transition-transform`}>
                      <action.icon size={28} />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 tracking-tight">{action.title}</h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{action.desc}</p>
                    <div className="mt-6 flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">
                      Accéder <ArrowRight size={14} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => { setDeleteModal(null); setDeletePassword(''); }}
        title="Confirmer la suppression"
        aria-describedby="delete-desc"
      >
        <p id="delete-desc" className="text-slate-300 mb-4">
          Êtes-vous sûr de vouloir supprimer le projet <strong className="text-white">{deleteModal?.projectName}</strong>&nbsp;? Cette action est irréversible.
        </p>
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
            Confirmez votre mot de passe
          </label>
          <input
            type="password"
            autoFocus
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 outline-none focus:border-red-500/40 focus:ring-4 focus:ring-red-500/5 transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter') confirmDelete(); }}
          />
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <Button
            variant="ghost"
            onClick={() => { setDeleteModal(null); setDeletePassword(''); }}
            disabled={deleteLoading}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            isLoading={deleteLoading}
          >
            Supprimer
          </Button>
        </div>
      </Modal>

      {/* Mobile Sticky CTA for Global Admin */}
      {isGlobalAdmin && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/projects/create')}
            className={`w-16 h-16 ${theme.floatingCta} text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-950`}
          >
            <Plus size={32} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
