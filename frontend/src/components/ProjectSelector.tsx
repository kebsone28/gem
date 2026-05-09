import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectSelector } from '../hooks/useProjectSelector';
import {
  ChevronRight,
  Users,
  Building,
  Calendar,
  Target,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  Save,
  X,
} from 'lucide-react';

interface ProjectSelectorProps {
  className?: string;
  onProjectChange?: (projectId: string | null) => void;
  showUserManagement?: boolean;
  compact?: boolean;
}

export default function ProjectSelector({ 
  className = '', 
  onProjectChange,
  showUserManagement = true,
  compact = false 
}: ProjectSelectorProps) {
  const projectSelectorData = useProjectSelector();
  const {
    projects,
    selectedProject,
    userAssignment,
    filteredProjects,
    projectStats,
    loading,
    canAccessProjects,
    switchProject,
    setProjectFilter,
    setSearchTerm,
    searchTerm,
    projectFilter,
    refreshProjects,
  } = projectSelectorData;

  const [showUsers, setShowUsers] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);

  const handleProjectChange = (projectId: string | null) => {
    switchProject(projectId || '');
    onProjectChange?.(projectId);
  };

  const toggleUserManagement = () => {
    setShowUsers(!showUsers);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
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

  if (!canAccessProjects) {
    return (
      <div className={`p-4 bg-slate-900/50 border border-slate-800 rounded-xl ${className}`}>
        <div className="flex items-center gap-3 text-slate-400">
          <AlertTriangle size={20} />
          <span>Vous n'avez pas accès aux projets</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl ${compact ? 'p-3' : 'p-6'} ${className}`}>
      {/* En-tête avec stats et actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Target size={20} className="text-blue-400" />
            Sélecteur de Projet
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{projectStats.total} projets</span>
            <span className="mx-2">•</span>
            <span className="text-emerald-400">{projectStats.active} actifs</span>
            <span className="mx-2">•</span>
            <span className="text-blue-400">{projectStats.myProjects} assignés</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showUserManagement && (
            <button
              onClick={toggleUserManagement}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-all"
            >
              <Users size={16} />
              {showUsers ? 'Masquer' : 'Gérer'} les utilisateurs
            </button>
          )}
          
          <button
            onClick={toggleFilters}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-all"
          >
            <Filter size={16} />
            {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
          
          <button
            onClick={refreshProjects}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Filtres et recherche */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un projet..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setProjectFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    projectFilter === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setProjectFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    projectFilter === 'active' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Actifs
                </button>
                <button
                  onClick={() => setProjectFilter('completed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    projectFilter === 'completed' 
                      ? 'bg-slate-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Terminés
                </button>
                <button
                  onClick={() => setProjectFilter('my')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    projectFilter === 'my' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Mes Projets
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des projets */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
            <span className="ml-3 text-slate-400">Chargement...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target size={24} className="text-slate-500" />
            </div>
            <h4 className="text-lg font-black text-white mb-2">Aucun projet trouvé</h4>
            <p className="text-slate-400 text-sm">
              Essayez d'élargir votre recherche ou changez de filtre
            </p>
          </div>
        ) : (
          filteredProjects.map((project, index) => {
            const isSelected = selectedProject === project.id;
            const assignment = userAssignment;
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 border rounded-xl cursor-pointer transition-all hover:shadow-xl ${
                  isSelected 
                    ? 'bg-blue-600/20 border-blue-500/40' 
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70'
                }`}
                onClick={() => handleProjectChange(project.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(project.status)}`}>
                        {project.status === 'active' && <CheckCircle2 size={20} />}
                        {project.status === 'planning' && <Calendar size={20} />}
                        {project.status === 'completed' && <BarChart3 size={20} />}
                        {project.status === 'paused' && <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white mb-1">{project.name}</h4>
                        <p className="text-sm text-slate-400 mb-2">{project.client}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{project.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className={`px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                      <span className="mx-2">•</span>
                      <span>{Math.round(project.progress)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {assignment && (
                      <div className={`px-2 py-1 rounded-lg text-xs ${
                        assignment.canSwitch 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {assignment.canSwitch ? 'Accès autorisé' : 'Accès limité'}
                      </div>
                    )}
                    
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>

                {/* Tags et priorité */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2">
                    {(project.tags || []).length > 0 && (
                      <div className="flex gap-1">
                        {(project.tags || []).slice(0, 3).map((tag, tagIndex) => (
                          <span key={tagIndex} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                            {tag}
                          </span>
                        ))}
                        {(project.tags || []).length > 3 && (
                          <span className="text-xs text-slate-500">+{(project.tags || []).length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(project.priority || 'medium')}`}>
                      {project.priority || 'medium'}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-500">
                    {project.startDate && (
                      <span>Début: {new Date(project.startDate).toLocaleDateString('fr-FR')}</span>
                    )}
                    {project.endDate && (
                      <span className="ml-3">Fin: {new Date(project.endDate).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Gestion des utilisateurs du projet */}
      <AnimatePresence>
        {showUsers && selectedProject && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 pt-6 border-t border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-black text-white">
                Utilisateurs du projet: {projects.find(p => p.id === selectedProject)?.name}
              </h4>
              <button
                onClick={toggleUserManagement}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {projects
                .filter(p => p.id === selectedProject)
                .flatMap(p => p.assignedUsers || [])
                .map((userId, index) => (
                  <div key={userId} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Users size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Utilisateur {index + 1}</p>
                        <p className="text-xs text-slate-400">{userId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-all">
                        <Eye size={14} />
                      </button>
                      <button className="p-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-all">
                        <Edit size={14} />
                      </button>
                      <button className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            
            <div className="flex justify-center mt-6">
              <button className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all">
                <UserPlus size={18} />
                Ajouter un utilisateur
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
