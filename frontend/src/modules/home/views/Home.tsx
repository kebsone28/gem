import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useProject } from '../../../contexts/ProjectContext';
import { normalizeRole, ROLES, isPlatformAdmin } from '../../../core/security/permissions';
import { useProjectSelector } from '../../../hooks/useProjectSelector';
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

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const { refreshProjects, deleteProject, setActiveProjectId } = useProject();

  const normalizedRole = normalizeRole(user?.role || '');

  const isGlobalAdmin =
    (user ? isPlatformAdmin(user as any) : false) ||
    normalizedRole === ROLES.ADMIN ||
    normalizedRole === ROLES.DIRECTEUR;

  const availableProjects = filteredProjects;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    navigate('/dashboard');
  };

  const handleProjectDelete = async (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${projectName}" ?`)) {
      try {
        const result = await deleteProject(projectId, '');
        if (result.success) {
          toast.success('Projet supprimé');
          refreshProjects();
        } else {
          toast.error(result.error || 'Erreur lors de la suppression');
        }
      } catch (err) {
        toast.error('Erreur lors de la suppression');
      }
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
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className={`absolute inset-0 opacity-10 ${styles.geometricBackground}`} />
        <motion.div
          animate={{
            opacity: [0.1, 0.2, 0.1],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] z-0"
        />
        <motion.div
          animate={{
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] z-0"
        />
      </div>

      {/* Header Premium */}
      <header className="bg-slate-950/40 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[1rem] flex items-center justify-center shadow-lg shadow-blue-500/20">
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
              >
                <Bell size={18} className="text-slate-300 group-hover:text-white transition-colors" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-900"></span>
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
                <button className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">
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
                <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-emerald-400 bg-clip-text text-transparent">
                  Opérations
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl leading-relaxed font-medium mx-auto lg:mx-0">
                L'écosystème intelligent pour connecter le terrain, automatiser vos flux et piloter l'avenir de vos projets.
              </p>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                {isGlobalAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/admin/project-creation')}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Nouveau Projet
                  </motion.button>
                )}
                <button 
                  onClick={() => navigate('/dashboard')}
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
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 sm:w-72 sm:h-72 bg-blue-600/20 rounded-full blur-[80px] -z-10" />
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
                value: (isGlobalAdmin ? projects : availableProjects).filter(p => p.status === 'active').length,
                icon: Activity,
                color: 'from-emerald-500/20 to-emerald-600/5',
                border: 'border-emerald-500/20',
                text: 'text-emerald-400'
              },
              { 
                label: 'Accès Ouverts', 
                value: (isGlobalAdmin ? projects : availableProjects).filter(p => !p.isArchived).length,
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
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className={`bg-gradient-to-br ${stat.color} border ${stat.border} rounded-[1.5rem] p-5 md:p-6 backdrop-blur-xl transition-all shadow-lg shadow-black/20`}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`p-2 rounded-xl bg-white/5 ${stat.text}`}>
                    <stat.icon size={20} />
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-white">{stat.value}</span>
                </div>
                <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</h3>
              </motion.div>
            ))}
          </div>

          {/* Search and Filters - Compact & Glassy */}
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Rechercher un projet par nom ou client..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchTerm(e.target.value);
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
                    onClick={() => setProjectFilter(f.id as any)}
                    className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
                      projectFilter === f.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
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
                    viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Affichage grille"
                  aria-label="Afficher en grille"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
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
              <h2 className="text-2xl font-black text-white mb-3">Territoire inconnu</h2>
              <p className="text-slate-400 mb-10 max-w-sm mx-auto font-medium">
                Aucun projet ne correspond à vos critères. C'est le moment idéal pour en créer un nouveau.
              </p>
              {isGlobalAdmin ? (
                <button
                  onClick={() => navigate('/admin/project-creation')}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl"
                >
                  <Plus size={20} />
                  Démarrer un Projet
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
              {availableProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -8, shadow: '0 20px 40px -20px rgba(0,0,0,0.5)' }}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`group relative overflow-hidden bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] cursor-pointer transition-all hover:border-blue-500/30 ${
                    viewMode === 'list' ? 'p-4 flex items-center gap-5' : 'p-5'
                  }`}
                >
                  {/* Decorative Gradient Background on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 via-purple-600/0 to-emerald-600/0 group-hover:from-blue-600/5 group-hover:via-purple-600/5 group-hover:to-emerald-600/5 transition-all duration-500 opacity-0 group-hover:opacity-100 pointer-events-none" />

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
                        <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors tracking-tight line-clamp-1">{project.name}</h3>
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
                            className="p-2 rounded-lg bg-white/5 hover:bg-indigo-600 text-slate-400 hover:text-white border border-white/5 transition-all"
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
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
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
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 relative"
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
                    path: '/admin/project-creation'
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

      {/* Mobile Sticky CTA for Global Admin */}
      {isGlobalAdmin && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/admin/project-creation')}
            className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-600/40 border-4 border-slate-950"
          >
            <Plus size={32} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
