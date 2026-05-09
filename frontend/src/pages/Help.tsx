import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { modulesManagementService, AVAILABLE_MODULES } from '../services/modulesManagementService';
import { normalizeRole, ROLES } from '../utils/permissions';
import logger from '../utils/logger';
import {
  HelpCircle,
  BookOpen,
  Zap,
  BarChart3,
  Target,
  Users,
  Calendar,
  Settings,
  Building,
  Shield,
  Wrench,
  Video,
  FileText,
  MessageSquare,
  Search,
  Filter,
  ChevronRight,
  ExternalLink,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Star,
  TrendingUp,
  ShieldCheck,
  Key,
  Database,
  Cpu,
  Globe,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  moduleId?: string;
  requiredPermissions?: string[];
  content: HelpContent[];
  relatedSections?: string[];
  videos?: VideoTutorial[];
  quickActions?: QuickAction[];
}

interface HelpContent {
  type: 'text' | 'code' | 'list' | 'warning' | 'tip' | 'example';
  title?: string;
  content: string | string[];
  language?: string;
}

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail?: string;
  url: string;
  category: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: any;
  action: () => void;
  moduleId?: string;
}

export default function Help() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [availableModules, setAvailableModules] = useState(AVAILABLE_MODULES);
  const [loading, setLoading] = useState(true);

  // Charger les modules disponibles pour l'utilisateur
  const loadAvailableModules = async () => {
    if (!user) return;
    
    try {
      const modules = await modulesManagementService.getAvailableModulesForUser(
        user.id,
        user.permissions || []
      );
      setAvailableModules(modules);
    } catch (error) {
      logger.error('[Help] Error loading available modules:', error);
      setAvailableModules(AVAILABLE_MODULES.filter(m => m.enabled)); // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableModules();
  }, [user]);

  // Obtenir l'icône du module
  const getModuleIcon = (iconName?: string) => {
    const iconMap: Record<string, any> = {
      BarChart3,
      Target,
      Users,
      Calendar,
      Settings,
      Building,
      Shield,
      Zap,
      Wrench,
    };
    return iconMap[iconName || 'HelpCircle'] || HelpCircle;
  };

  // Vérifier si un module est disponible pour l'utilisateur
  const isModuleAvailable = (moduleId: string) => {
    return availableModules.some(m => m.id === moduleId);
  };

  // Sections d'aide complètes
  const helpSections: HelpSection[] = useMemo(() => {
    const sections: HelpSection[] = [
      // === MODULES CORE ===
      {
        id: 'dashboard',
        title: 'Tableaux de Bord',
        description: 'Utilisation des dashboards selon votre rôle et entreprise',
        icon: BarChart3,
        category: 'core',
        moduleId: 'dashboard',
        requiredPermissions: ['voir_dashboard'],
        content: [
          {
            type: 'text',
            content: 'Les tableaux de bord sont adaptés à votre rôle et votre entreprise dans le système multi-entreprises.'
          },
          {
            type: 'tip',
            title: '💡 Conseil',
            content: 'Votre dashboard affiche uniquement les informations pertinentes pour votre rôle et entreprise.'
          },
          {
            type: 'list',
            title: 'Dashboards disponibles:',
            content: [
              'Client LSE : Vue superviseur et technique',
              'Proquelec/GEM : Admin, DG, Chef Projet, Comptable, Patrimoine, Direction, Employé',
              'Senelec : Superviseur et Contrôleur',
              'Sous-traitants : Directeur et Employé'
            ]
          }
        ],
        relatedSections: ['missions', 'planning'],
        quickActions: [
          {
            id: 'go-dashboard',
            title: 'Accéder à mon Dashboard',
            description: 'Retourner à votre tableau de bord personnalisé',
            icon: BarChart3,
            action: () => navigate('/dashboard')
          }
        ]
      },
      {
        id: 'missions',
        title: 'Gestion des Missions',
        description: 'Création, suivi et validation des missions',
        icon: Target,
        category: 'core',
        moduleId: 'missions',
        requiredPermissions: ['voir_missions', 'creer_mission'],
        content: [
          {
            type: 'text',
            content: 'Gérez les missions du début à la fin avec validation multi-niveaux.'
          },
          {
            type: 'list',
            title: 'Fonctionnalités principales:',
            content: [
              'Création de missions avec assignation automatique',
              'Suivi en temps réel de la progression',
              'Validation par niveaux hiérarchiques',
              'Rapports automatiques et export',
              'Notifications et alertes personnalisées'
            ]
          }
        ],
        relatedSections: ['planning', 'dashboard'],
        quickActions: [
          {
            id: 'create-mission',
            title: 'Créer une Mission',
            description: 'Démarrer une nouvelle mission',
            icon: Target,
            action: () => navigate('/missions/new')
          }
        ]
      },
      {
        id: 'users',
        title: 'Gestion des Utilisateurs',
        description: 'Administration des comptes et permissions',
        icon: Users,
        category: 'core',
        moduleId: 'users',
        requiredPermissions: ['gerer_utilisateurs'],
        content: [
          {
            type: 'text',
            content: 'Gérez les comptes utilisateurs avec rôles multi-entreprises et permissions granulaires.'
          },
          {
            type: 'warning',
            title: '⚠️ Important',
            content: 'Seuls les administrateurs peuvent accéder à cette section.'
          }
        ],
        relatedSections: ['modules'],
        quickActions: [
          {
            id: 'manage-users',
            title: 'Gérer les Utilisateurs',
            description: 'Accéder à l\'administration des comptes',
            icon: Users,
            action: () => navigate('/admin/users')
          }
        ]
      },
      {
        id: 'planning',
        title: 'Planning et Ordonnancement',
        description: 'Gestion du planning de projet',
        icon: Calendar,
        category: 'core',
        moduleId: 'planning',
        requiredPermissions: ['gerer_planning'],
        content: [
          {
            type: 'text',
            content: 'Planifiez et optimisez les ressources avec des algorithmes avancés.'
          },
          {
            type: 'example',
            title: 'Exemple d\'utilisation:',
            content: 'Allocation automatique des équipes en fonction des compétences et disponibilités.'
          }
        ],
        relatedSections: ['missions', 'dashboard'],
        quickActions: [
          {
            id: 'view-planning',
            title: 'Voir le Planning',
            description: 'Accéder au calendrier des missions',
            icon: Calendar,
            action: () => navigate('/planning')
          }
        ]
      },

      // === MODULES ADVANCED ===
      {
        id: 'ai_assistant',
        title: 'Assistant IA Wanekoo',
        description: 'Assistant intelligent pour aide à la décision',
        icon: Zap,
        category: 'advanced',
        moduleId: 'ai_assistant',
        requiredPermissions: ['utiliser_ia'],
        content: [
          {
            type: 'text',
            content: 'Wanekoo vous assiste dans vos décisions avec des recommandations basées sur l\'IA.'
          },
          {
            type: 'tip',
            title: '🤖 Astuce IA',
            content: 'Formulez vos questions précisément pour obtenir de meilleures réponses.'
          },
          {
            type: 'list',
            title: 'Capacités:',
            content: [
              'Analyse prédictive des missions',
              'Recommandations d\'optimisation',
              'Génération automatique de rapports',
              'Assistance à la prise de décision'
            ]
          }
        ],
        videos: [
          {
            id: 'wanekoo-intro',
            title: 'Introduction à Wanekoo',
            description: 'Découvrez comment utiliser l\'assistant IA',
            duration: '3:45',
            url: '/videos/wanekoo-intro',
            category: 'tutorial'
          }
        ],
        relatedSections: ['dashboard', 'missions']
      },
      {
        id: 'advanced_analytics',
        title: 'Analytics Avancés',
        description: 'Analyse prédictive et tableaux de bord personnalisés',
        icon: TrendingUp,
        category: 'advanced',
        moduleId: 'advanced_analytics',
        requiredPermissions: ['voir_metriques_ia'],
        content: [
          {
            type: 'text',
            content: 'Accédez à des analyses prédictives et des KPIs personnalisés.'
          },
          {
            type: 'list',
            title: 'Fonctionnalités:',
            content: [
              'Tableaux de bord personnalisables',
              'Analyse prédictive des tendances',
              'Alertes intelligentes',
              'Export automatisé des rapports'
            ]
          }
        ],
        relatedSections: ['dashboard']
      },
      {
        id: 'multi_tenant',
        title: 'Multi-Entreprises',
        description: 'Gestion multi-entreprises et isolation des données',
        icon: Building,
        category: 'advanced',
        moduleId: 'multi_tenant',
        requiredPermissions: ['gerer_entreprises'],
        content: [
          {
            type: 'text',
            content: 'Le système supporte la gestion multi-entreprises avec isolation complète des données.'
          },
          {
            type: 'list',
            title: 'Entreprises supportées:',
            content: [
              'Client LSE : Bénéficiaire final',
              'Proquelec/GEM : Maître d\'œuvre',
              'Senelec : Superviseur national',
              'Sous-traitants : Exécution terrain'
            ]
          }
        ],
        relatedSections: ['users', 'dashboard']
      },
      {
        id: 'automated_workflows',
        title: 'Workflows Automatisés',
        description: 'Automatisation des processus métier',
        icon: Settings,
        category: 'advanced',
        moduleId: 'automated_workflows',
        requiredPermissions: ['gerer_workflows'],
        content: [
          {
            type: 'text',
            content: 'Automatisez vos processus métier pour gagner en efficacité.'
          },
          {
            type: 'example',
            title: 'Exemples d\'automatisation:',
            content: 'Validation automatique des missions, génération de rapports, notifications intelligentes.'
          }
        ],
        relatedSections: ['missions', 'planning']
      },

      // === MODULES EXPERIMENTAL ===
      {
        id: 'real_time_collaboration',
        title: 'Collaboration Temps Réel',
        description: 'Édition collaborative en temps réel',
        icon: MessageSquare,
        category: 'experimental',
        moduleId: 'real_time_collaboration',
        requiredPermissions: ['collaboration_temps_reel'],
        content: [
          {
            type: 'warning',
            title: '🧪 Module Expérimental',
            content: 'Ce module est en phase de test et peut être instable.'
          },
          {
            type: 'text',
            content: 'Collaborez en temps réel sur les missions et documents.'
          }
        ],
        relatedSections: ['missions']
      },
      {
        id: 'blockchain_audit',
        title: 'Audit Blockchain',
        description: 'Traçabilité immuable des actions',
        icon: ShieldCheck,
        category: 'experimental',
        moduleId: 'blockchain_audit',
        requiredPermissions: ['voir_audit_blockchain'],
        content: [
          {
            type: 'warning',
            title: '🔗 Module Expérimental',
            content: 'Ce module utilise la blockchain pour une traçabilité immuable.'
          },
          {
            type: 'text',
            content: 'Toutes les actions critiques sont enregistrées sur la blockchain.'
          }
        ],
        relatedSections: ['users', 'missions']
      },

      // === MODULES ADMIN ===
      {
        id: 'modules',
        title: 'Gestion des Modules',
        description: 'Configuration globale des fonctionnalités',
        icon: Settings,
        category: 'admin',
        moduleId: 'system_maintenance',
        requiredPermissions: ['voir_diagnostic', 'gerer_parametres'],
        content: [
          {
            type: 'text',
            content: 'Configurez globalement les modules disponibles pour tous les utilisateurs.'
          },
          {
            type: 'list',
            title: 'Fonctionnalités admin:',
            content: [
              'Activation/désactivation globale des modules',
              'Configuration par utilisateur spécifique',
              'Statistiques d\'utilisation',
              'Audit complet des changements'
            ]
          }
        ],
        relatedSections: ['users'],
        quickActions: [
          {
            id: 'manage-modules',
            title: 'Gérer les Modules',
            description: 'Configurer les modules globaux',
            icon: Settings,
            action: () => navigate('/admin/modules')
          }
        ]
      },
      {
        id: 'god_mode',
        title: 'Mode Dieu (God Mode)',
        description: 'Accès complet et bypass des restrictions',
        icon: ShieldCheck,
        category: 'admin',
        moduleId: 'god_mode',
        requiredPermissions: ['acces_god_mode'],
        content: [
          {
            type: 'warning',
            title: '⚠️ Mode Restreint',
            content: 'Ce mode donne un accès complet et bypass toutes les restrictions.'
          },
          {
            type: 'text',
            content: 'Utilisez avec prudence. Toutes les actions sont auditées.'
          }
        ],
        relatedSections: ['users', 'modules']
      },

      // === SÉCURITÉ ===
      {
        id: 'security',
        title: 'Sécurité et Permissions',
        description: 'Gestion des droits d\'accès',
        icon: Lock,
        category: 'core',
        content: [
          {
            type: 'text',
            content: 'Le système utilise un RBAC (Role-Based Access Control) granulaire.'
          },
          {
            type: 'list',
            title: 'Principes de sécurité:',
            content: [
              'Isolation des données par entreprise',
              'Permissions granulaires par rôle',
              'Audit complet des actions',
              'Authentification multi-facteurs (2FA)'
            ]
          },
          {
            type: 'tip',
            title: '🔐 Conseil sécurité',
            content: 'Activez toujours la 2FA pour votre compte.'
          }
        ],
        relatedSections: ['users', 'modules']
      },

      // === DÉPANNAGE ===
      {
        id: 'troubleshooting',
        title: 'Dépannage et Support',
        description: 'Résolution des problèmes courants',
        icon: Wrench,
        category: 'core',
        content: [
          {
            type: 'text',
            content: 'Guide de dépannage pour les problèmes les plus courants.'
          },
          {
            type: 'list',
            title: 'Problèmes fréquents:',
            content: [
              'Module non disponible : Vérifiez vos permissions',
              'Connexion perdue : Réinitialisez votre mot de passe',
              'Performance lente : Videz le cache du navigateur',
              'Synchronisation échouée : Vérifiez votre connexion'
            ]
          },
          {
            type: 'example',
            title: 'Solution rapide :',
            content: 'La plupart des problèmes sont résolus en rafraîchissant la page (Ctrl+R).'
          }
        ],
        relatedSections: ['security']
      }
    ];

    // Filtrer selon les modules disponibles
    return sections.filter(section => {
      // Si pas de moduleId requis, toujours inclure
      if (!section.moduleId) return true;
      
      // Vérifier si le module est disponible
      return isModuleAvailable(section.moduleId);
    });
  }, [availableModules, user]);

  // Filtrer les sections selon recherche et catégorie
  const filteredSections = useMemo(() => {
    return helpSections.filter(section => {
      const matchesSearch = !searchTerm || 
        section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        section.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [helpSections, searchTerm, selectedCategory]);

  // Catégories disponibles
  const categories = useMemo(() => {
    const cats = new Set(helpSections.map(s => s.category));
    return Array.from(cats).map(cat => ({
      id: cat,
      label: cat === 'core' ? 'Modules Core' :
             cat === 'advanced' ? 'Modules Avancés' :
             cat === 'experimental' ? 'Modules Expérimentaux' :
             cat === 'admin' ? 'Modules Admin' : cat
    }));
  }, [helpSections]);

  // Toggle section
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        title="Centre d'Aide"
        subtitle="Documentation et guides adaptés à vos modules activés"
        icon={<HelpCircle size={24} />}
      />
      
      <ContentArea className="space-y-8 p-8 bg-slate-950 border-slate-800">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* En-tête avec statut des modules */}
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-white mb-2">
                  Modules Disponibles pour votre Rôle
                </h2>
                <p className="text-slate-400 text-sm">
                  {user?.role} • {availableModules.length} modules activés
                </p>
              </div>
              <div className="flex items-center gap-2">
                {availableModules.length > 0 ? (
                  <>
                    <CheckCircle2 className="text-emerald-400" size={20} />
                    <span className="text-emerald-400 text-sm font-medium">
                      {availableModules.length} modules activés
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="text-amber-400" size={20} />
                    <span className="text-amber-400 text-sm font-medium">
                      Aucun module activé
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Modules activés */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {availableModules.map(module => {
                const ModuleIcon = getModuleIcon(module.icon);
                return (
                  <div key={module.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <ModuleIcon size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{module.name}</p>
                      <p className="text-xs text-slate-500">{module.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barre de recherche et filtres */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher dans l'aide..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedCategory === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                Toutes
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    selectedCategory === cat.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-800/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sections d'aide */}
          <div className="space-y-6">
            {filteredSections.map(section => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.has(section.id);
              const isAvailable = !section.moduleId || isModuleAvailable(section.moduleId);
              
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border transition-all ${
                    isAvailable 
                      ? 'bg-slate-900/50 border-slate-700/50 hover:shadow-xl' 
                      : 'bg-slate-900/20 border-slate-800/30 opacity-50'
                  } ${!isAvailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => isAvailable && toggleSection(section.id)}
                >
                  <div className="p-6">
                    {/* En-tête de section */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          section.category === 'core' ? 'bg-blue-500/20' :
                          section.category === 'advanced' ? 'bg-purple-500/20' :
                          section.category === 'experimental' ? 'bg-orange-500/20' :
                          'bg-red-500/20'
                        }`}>
                          <SectionIcon size={24} className={
                            section.category === 'core' ? 'text-blue-400' :
                            section.category === 'advanced' ? 'text-purple-400' :
                            section.category === 'experimental' ? 'text-orange-400' :
                            'text-red-400'
                          } />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white mb-1">{section.title}</h3>
                          <p className="text-slate-400 text-sm">{section.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!isAvailable && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-lg">
                            <Lock size={14} className="text-slate-500" />
                            <span className="text-xs text-slate-500">Non disponible</span>
                          </div>
                        )}
                        
                        <div className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <ChevronRight size={20} className="text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {/* Contenu développé */}
                    <AnimatePresence>
                      {isExpanded && isAvailable && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-6 space-y-6">
                            {/* Contenu principal */}
                            {section.content.map((content, index) => (
                              <div key={index} className="space-y-3">
                                {content.title && (
                                  <h4 className={`text-sm font-bold mb-2 ${
                                    content.type === 'warning' ? 'text-amber-400' :
                                    content.type === 'tip' ? 'text-blue-400' :
                                    'text-slate-300'
                                  }`}>
                                    {content.title}
                                  </h4>
                                )}
                                
                                {content.type === 'text' && (
                                  <p className="text-slate-300 leading-relaxed">
                                    {content.content}
                                  </p>
                                )}
                                
                                {content.type === 'list' && Array.isArray(content.content) && (
                                  <ul className="space-y-2">
                                    {content.content.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-slate-300 text-sm">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                
                                {content.type === 'code' && (
                                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                                    <pre className="text-sm text-slate-300 overflow-x-auto">
                                      <code>{content.content}</code>
                                    </pre>
                                  </div>
                                )}
                                
                                {content.type === 'example' && (
                                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <p className="text-sm text-blue-300">
                                      {content.content}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Vidéos tutorielles */}
                            {section.videos && section.videos.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-3">
                                  📹 Tutoriels Vidéo
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {section.videos.map(video => (
                                    <div key={video.id} className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-900/50 transition-all cursor-pointer">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                          <Video size={18} className="text-red-400" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-white">{video.title}</p>
                                          <p className="text-xs text-slate-500">{video.duration}</p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-slate-400 mb-3">{video.description}</p>
                                      <button className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                                        <Play size={16} />
                                        Regarder la vidéo
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions rapides */}
                            {section.quickActions && section.quickActions.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-3">
                                  ⚡ Actions Rapides
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {section.quickActions.filter(action => !action.moduleId || isModuleAvailable(action.moduleId)).map(action => {
                                    const ActionIcon = action.icon;
                                    return (
                                      <button
                                        key={action.id}
                                        onClick={action.action}
                                        className="p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl hover:from-blue-600/20 hover:to-purple-600/20 transition-all text-left"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                            <ActionIcon size={16} className="text-blue-400" />
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-white">{action.title}</p>
                                            <p className="text-xs text-slate-400">{action.description}</p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Sections connexes */}
                            {section.relatedSections && section.relatedSections.length > 0 && (
                              <div className="pt-4 border-t border-slate-700/50">
                                <h4 className="text-sm font-bold text-slate-300 mb-3">
                                  🔗 Sections Connexes
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {section.relatedSections.map(relatedId => {
                                    const related = helpSections.find(s => s.id === relatedId);
                                    if (!related) return null;
                                    
                                    const RelatedIcon = related.icon;
                                    return (
                                      <button
                                        key={relatedId}
                                        onClick={() => {
                                          setExpandedSections(new Set([relatedId]));
                                          setTimeout(() => {
                                            document.getElementById(`help-section-${relatedId}`)?.scrollIntoView({ 
                                              behavior: 'smooth', 
                                              block: 'center' 
                                            });
                                          }, 100);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-all"
                                      >
                                        <RelatedIcon size={14} className="text-slate-400" />
                                        <span className="text-xs text-slate-300">{related.title}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Message si aucun résultat */}
          {filteredSections.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-slate-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                Aucun résultat trouvé
              </h3>
              <p className="text-slate-400 text-sm">
                Essayez d'élargir votre recherche ou changez de catégorie
              </p>
            </div>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
