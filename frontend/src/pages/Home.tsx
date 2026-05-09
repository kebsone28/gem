import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES, isPlatformAdmin } from '../utils/permissions';
import { useProjectSelector } from '../hooks/useProjectSelector';
import {
  Building,
  Users,
  Target,
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Bell,
  Search,
  Filter,
  ArrowRight,
  Star,
  Award,
  Zap,
  Shield,
  Eye,
  EyeOff,
  Plus,
  Grid,
  List,
  LogOut,
  User,
  HelpCircle,
  FileText,
  Activity,
} from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const projectSelectorData = useProjectSelector();
  const {
    projects,
    selectedProject,
    filteredProjects,
    projectStats,
    loading,
    canAccessProjects,
    switchProject,
    setProjectFilter,
    setSearchTerm,
    refreshProjects,
  } = projectSelectorData;

  const normalizedRole = normalizeRole(user?.role || '');
  
  // Déterminer si l'utilisateur est admin ou DG pour voir tous les projets
  // 🛡️ Phase 5 : Utilisation de isPlatformAdmin pour le bypass total
  const isGlobalAdmin = isPlatformAdmin(user) || normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.DG;
  
  // Pour admin/DG : tous les projets, pour autres : seulement les projets assignés
  const availableProjects = isGlobalAdmin ? projects : filteredProjects;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // L'utilisateur reste sur Home pour choisir son projet activement
  }, [user, navigate]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case ROLES.PLATFORM_ADMIN:
      case ROLES.ADMIN:
      case ROLES.DG:
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
    switchProject(projectId);
    navigate('/dashboard');
  };

  const getRecentProjects = () => {
    return filteredProjects
      .filter(p => !p.isArchived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Modern Geometric Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        
        {/* Diagonal Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 48%, rgba(59, 130, 246, 0.03) 49%, rgba(59, 130, 246, 0.03) 51%, transparent 52%),
              linear-gradient(-45deg, transparent 48%, rgba(147, 51, 234, 0.02) 49%, rgba(147, 51, 234, 0.02) 51%, transparent 52%),
              linear-gradient(45deg, transparent 48%, rgba(34, 197, 94, 0.02) 49%, rgba(34, 197, 94, 0.02) 51%, transparent 52%)
            `,
            backgroundSize: '100px 100px, 150px 150px, 200px 200px',
            backgroundPosition: '0 0, 50px 50px, 100px 100px'
          }}
        />
        
        {/* Dot Pattern */}
        <div 
          className="absolute inset-0 opacity-6"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              radial-gradient(circle, rgba(59, 130, 246, 0.03) 1px, transparent 1px),
              radial-gradient(circle, rgba(147, 51, 234, 0.02) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px, 120px 120px, 160px 160px',
            backgroundPosition: '0 0, 40px 40px, 80px 80px'
          }}
        />
        
        {/* Glow Points */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/20 rounded-full blur-sm" />
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-purple-400/15 rounded-full blur-md" />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-emerald-400/15 rounded-full blur-sm" />
        <div className="absolute top-2/3 right-1/4 w-1 h-1 bg-blue-300/10 rounded-full blur-xs" />
        <div className="absolute bottom-1/3 right-2/3 w-2 h-2 bg-purple-300/10 rounded-full blur-sm" />
        
        {/* Subtle Gradient Overlays */}
        <div 
          className="absolute inset-0 opacity-4"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at top left, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
              radial-gradient(ellipse at bottom right, rgba(147, 51, 234, 0.06) 0%, transparent 40%),
              radial-gradient(ellipse at center, rgba(34, 197, 94, 0.04) 0%, transparent 30%)
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%',
            backgroundPosition: '0 0, 0 0, 0 0'
          }}
        />
      </div>
            {/* Header Premium */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Building size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white">GEM SAAS</h1>
                  <p className="text-xs text-slate-400">Gestion Multi-Projets</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(normalizedRole)}`}>
                  {normalizedRole || 'Utilisateur'}
                </div>
                <div className="text-sm text-slate-400">
                  {user.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all"
              >
                <Bell size={18} className="text-slate-300" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </button>

              <button className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all">
                <HelpCircle size={18} className="text-slate-300" />
              </button>

              <button className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all">
                <Settings size={18} className="text-slate-300" />
              </button>

              <button
                onClick={() => navigate('/login')}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all"
              >
                <LogOut size={18} className="text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-6 top-20 w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50"
          >
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {getNotifications().map((notification) => {
                const Icon = notification.icon;
                return (
                  <div key={notification.id} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-all cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${notification.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                        <p className="text-xs text-slate-400 mt-1">{notification.description}</p>
                        <p className="text-xs text-slate-500 mt-2">{notification.time}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="px-6 py-12 relative z-10">
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-black text-white mb-4">
              Bienvenue sur <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">GEM SAAS</span>
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              Sélectionnez un projet pour accéder à votre espace de travail personnalisé
            </p>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative z-10">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <Target size={24} className="text-blue-400" />
                  <span className="text-2xl font-black text-white">{isGlobalAdmin ? projects.length : availableProjects.length}</span>
                </div>
                <h3 className="text-sm font-medium text-slate-300">
                  {isGlobalAdmin ? 'Projets Totaux' : 'Mes Projets'}
                </h3>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <Activity size={24} className="text-emerald-400" />
                  <span className="text-2xl font-black text-white">
                    {isGlobalAdmin ? projects.filter(p => p.status === 'active').length : availableProjects.filter(p => p.status === 'active').length}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-slate-300">Projets Actifs</h3>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <Users size={24} className="text-purple-400" />
                  <span className="text-2xl font-black text-white">
                    {isGlobalAdmin ? projects.filter(p => !p.isArchived).length : availableProjects.filter(p => !p.isArchived).length}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-slate-300">
                  {isGlobalAdmin ? 'Projets Disponibles' : 'Projets Accessibles'}
                </h3>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <Clock size={24} className="text-amber-400" />
                  <span className="text-2xl font-black text-white">
                    {isGlobalAdmin ? projects.filter(p => p.status === 'planning').length : availableProjects.filter(p => p.status === 'planning').length}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-slate-300">En Planification</h3>
              </motion.div>
            </div>
          </motion.div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 relative z-10">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchTerm(e.target.value);
                }}
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  filterStatus === 'active'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Actifs
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  filterStatus === 'completed'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Terminés
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {/* Projects Grid/List */}
          {loading ? (
            <div className="flex items-center justify-center py-20 relative z-10">
              <div className="animate-spin">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full"></div>
              </div>
            </div>
          ) : availableProjects.length === 0 ? (
            <div className="text-center py-20 relative z-10">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target size={32} className="text-slate-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-4">Aucun projet disponible</h2>
              <p className="text-slate-400 mb-8">
                Vous n'avez accès à aucun projet pour le moment.
              </p>
              {isGlobalAdmin ? (
                <button
                  onClick={() => navigate('/admin/project-creation')}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all mx-auto"
                >
                  <Plus size={18} />
                  Créer un Projet
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  Contactez votre administrateur pour obtenir l'accès à un projet.
                </p>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10' : 'space-y-4 relative z-10'}>
              {availableProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`bg-slate-900/50 border rounded-xl cursor-pointer transition-all hover:shadow-xl ${
                    viewMode === 'list' ? 'p-4' : 'p-6'
                  } border-slate-800/50 hover:border-blue-500/40`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getStatusColor(project.status)}`}>
                        {project.status === 'active' && <Activity size={20} />}
                        {project.status === 'planning' && <Calendar size={20} />}
                        {project.status === 'completed' && <CheckCircle2 size={20} />}
                        {project.status === 'paused' && <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-400">{project.client}</p>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-slate-400" />
                  </div>

                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">{project.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority)}`}>
                        {project.priority}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      {Math.round(project.progress)}%
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Users size={14} />
                      <span>{(project.assignedUsers || []).length} utilisateur{(project.assignedUsers || []).length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span>Modifié {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}</span>
                    </div>
                  </div>

                  {(project.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(project.tags || []).slice(0, 3).map((tag, tagIndex) => (
                        <span key={tagIndex} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                          {tag}
                        </span>
                      ))}
                      {(project.tags || []).length > 3 && (
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-500">
                          +{(project.tags || []).length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {(normalizedRole === ROLES.PROQUELEC_ADMIN || normalizedRole === ROLES.PROQUELEC_DG) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center relative z-10"
            >
              <h2 className="text-2xl font-black text-white mb-6">Actions Rapides</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate('/admin/project-creation')}
                  className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6 hover:border-blue-500/40 transition-all"
                >
                  <Plus size={24} className="text-blue-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-white mb-2">Créer un Projet</h3>
                  <p className="text-sm text-slate-400">Démarrer un nouveau projet avec des modèles préconfigurés</p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate('/admin/users')}
                  className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all"
                >
                  <Users size={24} className="text-purple-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-white mb-2">Gérer les Utilisateurs</h3>
                  <p className="text-sm text-slate-400">Administrer les comptes et les permissions</p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate('/admin/modules')}
                  className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6 hover:border-emerald-500/40 transition-all"
                >
                  <Settings size={24} className="text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-white mb-2">Modules Globaux</h3>
                  <p className="text-sm text-slate-400">Configurer les fonctionnalités du système</p>
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
