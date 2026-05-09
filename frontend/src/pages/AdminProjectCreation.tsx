import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES } from '../utils/permissions';
import { db } from '../store/db';
import logger from '../utils/logger';
import toast from 'react-hot-toast';
import {
  Building,
  Users,
  Settings,
  Plus,
  Save,
  X,
  Eye,
  EyeOff,
  Calendar,
  Target,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Tag,
  UserPlus,
  UserMinus,
  Copy,
  Trash2,
  Zap,
  Shield,
  Wrench,
  FileText,
  TrendingUp,
} from 'lucide-react';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  client: string;
  defaultModules: string[];
  defaultUsers: string[];
  defaultSettings: Record<string, any>;
  icon: string;
  category: 'infrastructure' | 'maintenance' | 'supervision' | 'consulting';
}

interface ProjectFeature {
  id: string;
  name: string;
  description: string;
  icon: any;
  module: string;
  enabled: boolean;
  required?: boolean;
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'lse_infrastructure',
    name: 'Infrastructure LSE',
    description: 'Projet d\'infrastructure pour client LSE avec supervision et maintenance',
    client: 'CLIENT_LSE',
    defaultModules: ['dashboard', 'missions', 'planning', 'advanced_analytics'],
    defaultUsers: ['LSE_SUPERVISEUR', 'LSE_TECHNICIEN'],
    defaultSettings: {
      supervisionEnabled: true,
      maintenanceMode: false,
      reportingFrequency: 'daily',
    },
    icon: 'Building',
    category: 'infrastructure'
  },
  {
    id: 'proquelec_internal',
    name: 'Projet Interne Proquelec',
    description: 'Projet de gestion interne pour Proquelec/GEM',
    client: 'PROQUELEC',
    defaultModules: ['dashboard', 'missions', 'users', 'planning', 'accounting'],
    defaultUsers: ['PROQUELEC_ADMIN', 'PROQUELEC_DG', 'PROQUELEC_CHEF_PROJET', 'PROQUELEC_COMPTABLE'],
    defaultSettings: {
      accountingEnabled: true,
      hrManagement: true,
      budgetTracking: true,
    },
    icon: 'Settings',
    category: 'consulting'
  },
  {
    id: 'senelec_supervision',
    name: 'Supervision Senelec',
    description: 'Projet de supervision technique pour Senelec',
    client: 'SENELEC',
    defaultModules: ['dashboard', 'missions', 'planning', 'advanced_analytics'],
    defaultUsers: ['SENELEC_SUPERVISEUR', 'SENELEC_CONTROLEUR'],
    defaultSettings: {
      technicalSupervision: true,
      complianceReporting: true,
      realTimeMonitoring: true,
    },
    icon: 'Shield',
    category: 'supervision'
  },
  {
    id: 'subcontractor_maintenance',
    name: 'Maintenance Sous-traitant',
    description: 'Projet de maintenance pour sous-traitant externe',
    client: 'SOUS_TRAITANT',
    defaultModules: ['dashboard', 'missions', 'planning'],
    defaultUsers: ['SOUS_TRAITANT_DIRECTEUR', 'SOUS_TRAITANT_EMPLOYE'],
    defaultSettings: {
      limitedAccess: true,
      reportingOnly: false,
      timeTracking: true,
    },
    icon: 'Wrench',
    category: 'maintenance'
  },
];

const PROJECT_FEATURES: ProjectFeature[] = [
  {
    id: 'real_time_tracking',
    name: 'Suivi en Temps Réel',
    description: 'Suivi des missions et équipes en temps réel',
    icon: Clock,
    module: 'planning',
    enabled: true,
  },
  {
    id: 'advanced_analytics',
    name: 'Analytics Avancés',
    description: 'Tableaux de bord analytiques et prédictifs',
    icon: BarChart3,
    module: 'advanced_analytics',
    enabled: false,
  },
  {
    id: 'ai_assistant',
    name: 'Assistant IA Wanekoo',
    description: 'Assistant intelligent pour aide à la décision',
    icon: Zap,
    module: 'ai_assistant',
    enabled: false,
  },
  {
    id: 'automated_workflows',
    name: 'Workflows Automatisés',
    description: 'Automatisation des processus métier',
    icon: Settings,
    module: 'automated_workflows',
    enabled: false,
  },
  {
    id: 'blockchain_audit',
    name: 'Audit Blockchain',
    description: 'Traçabilité immuable des actions critiques',
    icon: Shield,
    module: 'blockchain_audit',
    enabled: false,
  },
  {
    id: 'multi_tenant',
    name: 'Multi-Entreprises',
    description: 'Gestion multi-entreprises et isolation des données',
    icon: Building,
    module: 'multi_tenant',
    enabled: true,
    required: true,
  },
  {
    id: 'kobo_global',
    name: 'Projet Kobo Global',
    description: 'Projet global de gestion pour Kobo avec modules complets',
    client: 'CLIENT_LSE',
    defaultModules: ['dashboard', 'missions', 'planning', 'advanced_analytics', 'ai_assistant', 'automated_workflows'],
    defaultUsers: ['LSE_SUPERVISEUR', 'LSE_TECHNICIEN', 'LSE_PROJECT_MANAGER'],
    defaultSettings: {
      globalView: true,
      crossProjectReporting: true,
      aiIntegration: true,
      workflowAutomation: true,
    },
    icon: 'Target',
    category: 'global'
  },
];

export default function AdminProjectCreation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [customProject, setCustomProject] = useState(false);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    client: '',
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    budget: 0,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    tags: [] as string[],
    assignedUsers: [] as string[],
    enabledModules: [] as string[],
    settings: {} as Record<string, any>,
  });
  
  const [selectedFeatures, setSelectedFeatures] = useState<ProjectFeature[]>(PROJECT_FEATURES);
  const [showPreview, setShowPreview] = useState(false);
  const [step, setStep] = useState(1);

  // Vérifier si l'utilisateur peut créer des projets
  const canCreateProject = () => {
    if (!user) return false;
    
    const normalizedRole = normalizeRole(user.role);
    return normalizedRole === ROLES.PROQUELEC_ADMIN || normalizedRole === ROLES.PROQUELEC_DG;
  };

  useEffect(() => {
    if (!canCreateProject()) {
      toast.error('Vous n\'avez pas les permissions pour créer des projets');
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setCustomProject(false);
    setProjectData({
      name: template.name,
      description: template.description,
      client: template.client,
      startDate: new Date(),
      endDate: undefined,
      budget: 0,
      priority: 'medium',
      tags: [],
      assignedUsers: template.defaultUsers,
      enabledModules: template.defaultModules,
      settings: { ...template.defaultSettings },
    });
    
    // Mettre à jour les fonctionnalités selon le modèle
    const updatedFeatures = PROJECT_FEATURES.map(feature => ({
      ...feature,
      enabled: template.defaultModules.includes(feature.module) || feature.required || false,
    }));
    setSelectedFeatures(updatedFeatures);
  };

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.map(feature => 
        feature.id === featureId 
          ? { ...feature, enabled: !feature.enabled }
          : feature
      )
    );
  };

  const handleCreateProject = async () => {
    if (!canCreateProject()) {
      toast.error('Permissions insuffisantes pour créer un projet');
      return;
    }

    if (!projectData.name || !projectData.client) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    setLoading(true);
    
    try {
      // Créer le projet dans IndexedDB
      const newProject = {
        id: `project_${Date.now()}`,
        name: projectData.name,
        description: projectData.description,
        client: projectData.client,
        status: 'planning',
        startDate: projectData.startDate,
        endDate: projectData.endDate,
        progress: 0,
        assignedUsers: projectData.assignedUsers,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: projectData.tags,
        priority: projectData.priority,
        budget: projectData.budget,
        actualCost: 0,
        organizationId: user.organizationId,
        isArchived: false,
        settings: projectData.settings,
        enabledModules: selectedFeatures.filter(f => f.enabled).map(f => f.module),
        version: 1,
        config: projectData.settings,
      };

      await db.projects.add(newProject);
      
      // Créer les assignments pour les utilisateurs
      for (const userId of projectData.assignedUsers) {
        await db.projectAssignments.add({
          projectId: parseInt(newProject.id.replace('project_', '')),
          userId,
          role: 'member',
          assignedAt: new Date(),
          assignedBy: user.id,
          permissions: ['view', 'edit'],
          canSwitch: true,
          lastAccessed: new Date(),
        });
      }

      // Synchroniser avec le serveur
      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            ...newProject,
            projectId: parseInt(newProject.id.replace('project_', '')),
          }),
        });

        if (response.ok) {
          const serverProject = await response.json();
          logger.info(`[AdminProjectCreation] Project ${newProject.id} synced to server by ${user.id}`);
          toast.success(`Projet "${projectData.name}" créé et synchronisé avec succès`);
        } else {
          throw new Error('Server sync failed');
        }
      } catch (syncError) {
        logger.warn('[AdminProjectCreation] Server sync failed, project saved locally:', syncError);
        toast.success(`Projet "${projectData.name}" créé localement (synchronisation en cours)`);
      }

      navigate('/dashboard');
      
      logger.info(`[AdminProjectCreation] Project ${newProject.id} created by ${user.id}`);
    } catch (error) {
      logger.error('[AdminProjectCreation] Error creating project:', error);
      toast.error('Erreur lors de la création du projet');
    } finally {
      setLoading(false);
    }
  };

  const getClientColor = (client: string) => {
    switch (client) {
      case 'CLIENT_LSE':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'PROQUELEC':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'SENELEC':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'SOUS_TRAITANT':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getFeatureIcon = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      Building,
      Users,
      Settings,
      Shield,
      Wrench,
      Zap,
      BarChart3,
      Clock,
      Target,
    };
    const IconComponent = iconMap[iconName] || Settings;
    return <IconComponent size={20} className="text-white" />;
  };

  if (!canCreateProject()) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Accès Refusé</h2>
          <p className="text-slate-400 mb-6">
            Seuls les administrateurs et les directeurs généraux peuvent créer des projets.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all"
          >
            Retour au Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <Plus size={32} className="text-blue-400" />
            Création de Projet
          </h1>
          <p className="text-slate-400">
            Créez un nouveau projet avec des modèles préconfigurés ou personnalisé
          </p>
        </div>

        {/* Étapes */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-16 h-1 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Modèles de projet */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-blue-400" />
              Modèles de Projet
            </h2>
            
            <div className="space-y-3">
              {PROJECT_TEMPLATES.map((template) => (
                <motion.div
                  key={template.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'bg-blue-600/20 border-blue-500/40'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getClientColor(template.client)}`}>
                      {getFeatureIcon(template.icon)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-black text-white mb-1">{template.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-2">{template.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-1 rounded-full ${getClientColor(template.client)}`}>
                          {template.client}
                        </span>
                        <span className="text-slate-500">
                          {template.defaultModules.length} modules
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {/* Option personnalisé */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setCustomProject(true);
                  setSelectedTemplate(null);
                }}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  customProject
                    ? 'bg-purple-600/20 border-purple-500/40'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Plus size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white mb-1">Projet Personnalisé</h3>
                    <p className="text-xs text-slate-400">Créez un projet entièrement personnalisé</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Formulaire principal */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-black text-white mb-6">
                {selectedTemplate ? `Configuration : ${selectedTemplate.name}` : 'Détails du Projet'}
              </h2>

              {/* Informations générales */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nom du Projet *
                  </label>
                  <input
                    type="text"
                    value={projectData.name}
                    onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Nom du projet..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={projectData.description}
                    onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    placeholder="Description du projet..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Client *
                    </label>
                    <select
                      value={projectData.client}
                      onChange={(e) => setProjectData(prev => ({ ...prev, client: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Sélectionner un client...</option>
                      <option value="CLIENT_LSE">Client LSE</option>
                      <option value="PROQUELEC">Proquelec/GEM</option>
                      <option value="SENELEC">Senelec</option>
                      <option value="SOUS_TRAITANT">Sous-traitant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Priorité
                    </label>
                    <select
                      value={projectData.priority}
                      onChange={(e) => setProjectData(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={projectData.startDate.toISOString().split('T')[0]}
                      onChange={(e) => setProjectData(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Date de fin (optionnel)
                    </label>
                    <input
                      type="date"
                      value={projectData.endDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setProjectData(prev => ({ 
                        ...prev, 
                        endDate: e.target.value ? new Date(e.target.value) : undefined 
                      }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Budget (optionnel)
                  </label>
                  <input
                    type="number"
                    value={projectData.budget}
                    onChange={(e) => setProjectData(prev => ({ ...prev, budget: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Fonctionnalités */}
              <div className="mb-6">
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-blue-400" />
                  Fonctionnalités Activées
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedFeatures.map((feature) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <motion.div
                        key={feature.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => !feature.required && handleFeatureToggle(feature.id)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          feature.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-slate-800/50 border-slate-700/50'
                        } ${feature.required ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            feature.enabled
                              ? 'bg-emerald-500/20'
                              : 'bg-slate-700'
                          }`}>
                            <FeatureIcon size={18} className={
                              feature.enabled ? 'text-emerald-400' : 'text-slate-400'
                            } />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white mb-1">{feature.name}</h4>
                            <p className="text-xs text-slate-400">{feature.description}</p>
                            {feature.required && (
                              <span className="text-xs text-amber-400">Requis</span>
                            )}
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            feature.enabled
                              ? 'bg-emerald-500'
                              : 'bg-slate-600'
                          }`}>
                            {feature.enabled ? (
                              <CheckCircle2 size={14} className="text-white" />
                            ) : (
                              <X size={14} className="text-slate-400" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                >
                  <Eye size={18} />
                  {showPreview ? 'Masquer' : 'Afficher'} l'aperçu
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"
                  >
                    Annuler
                  </button>
                  
                  <button
                    onClick={handleCreateProject}
                    disabled={loading || !projectData.name || !projectData.client}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={18} />
                    {loading ? 'Création...' : 'Créer le Projet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Aperçu du projet */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6"
            >
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <Eye size={20} className="text-blue-400" />
                Aperçu du Projet
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Informations</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nom:</span>
                      <span className="text-white font-medium">{projectData.name || 'Non défini'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Client:</span>
                      <span className={`font-medium ${getClientColor(projectData.client)}`}>
                        {projectData.client || 'Non défini'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Priorité:</span>
                      <span className="text-white font-medium">{projectData.priority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget:</span>
                      <span className="text-white font-medium">
                        {projectData.budget ? `${projectData.budget.toLocaleString()} €` : 'Non défini'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Modules Activés</h4>
                  <div className="space-y-2">
                    {selectedFeatures.filter(f => f.enabled).map((feature) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div key={feature.id} className="flex items-center gap-2 text-sm">
                          <FeatureIcon size={14} className="text-emerald-400" />
                          <span className="text-white">{feature.name}</span>
                        </div>
                      );
                    })}
                    </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Utilisateurs Assignés</h4>
                  <div className="space-y-2">
                    {projectData.assignedUsers.length > 0 ? (
                      projectData.assignedUsers.map((userId, index) => (
                        <div key={userId} className="flex items-center gap-2 text-sm">
                          <Users size={14} className="text-blue-400" />
                          <span className="text-white">{userId}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">Aucun utilisateur assigné</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
