import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Shield,
  Users,
  Key,
  Bot,
  Database,
  Link,
  Activity,
  Bell,
  Settings,
  ChevronRight,
  ServerCog,
  Briefcase,
  LayoutDashboard,
  Plus
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';

const MODULES_CATEGORIES = [
  {
    title: 'Portefeuille Projets',
    description: 'Création et supervision des écosystèmes clients.',
    color: 'from-sky-500 to-blue-500',
    shadow: 'shadow-sky-500/20',
    icon: <Briefcase className="text-white" size={24} />,
    items: [
      {
        name: 'Liste des Projets',
        description: 'Accéder à la grille de tous les projets.',
        icon: <LayoutDashboard className="text-sky-400" size={20} />,
        route: '/home',
        status: 'Actif'
      },
      {
        name: 'Générateur de Projet',
        description: 'Initialiser un nouvel écosystème GED OS.',
        icon: <Plus className="text-blue-400" size={20} />,
        route: '/admin/project-creation',
        status: 'Actif'
      }
    ]
  },
  {
    title: 'Organisation & Plateforme',
    description: 'Paramètres globaux de votre locataire SaaS.',
    color: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/20',
    icon: <Building2 className="text-white" size={24} />,
    items: [
      {
        name: 'Profil de l\'Organisation',
        description: 'Gérer les informations de l\'entreprise, logos et devises.',
        icon: <Building2 className="text-blue-400" size={20} />,
        route: '/admin/organization',
        status: 'Actif'
      },
      {
        name: 'Activation des Modules',
        description: 'Activer ou désactiver des fonctionnalités globales.',
        icon: <Settings className="text-cyan-400" size={20} />,
        route: '/admin/hub',
        status: 'Actif'
      }
    ]
  },
  {
    title: 'Sécurité & Identité',
    description: 'Contrôle d\'accès, utilisateurs et permissions.',
    color: 'from-indigo-500 to-purple-500',
    shadow: 'shadow-indigo-500/20',
    icon: <Shield className="text-white" size={24} />,
    items: [
      {
        name: 'Annuaire Utilisateurs',
        description: 'Gérer les comptes et invitations.',
        icon: <Users className="text-indigo-400" size={20} />,
        route: '/admin/users',
        status: 'Actif'
      },
      {
        name: 'Rôles & Permissions',
        description: 'Définir les matrices d\'accès RBAC.',
        icon: <Key className="text-purple-400" size={20} />,
        route: '/admin/permissions',
        status: 'Actif'
      },
      {
        name: 'Politiques de Sécurité',
        description: 'Double authentification, sessions et mots de passe.',
        icon: <Shield className="text-indigo-300" size={20} />,
        route: '/admin/security',
        status: 'Actif'
      }
    ]
  },
  {
    title: 'Moteur IA & Automatisation',
    description: 'Paramétrage du cerveau GED OS MINT.',
    color: 'from-fuchsia-500 to-rose-500',
    shadow: 'shadow-fuchsia-500/20',
    icon: <Bot className="text-white" size={24} />,
    items: [
      {
        name: 'Configuration IA',
        description: 'Modèles Anthropic, température et personnalités.',
        icon: <Bot className="text-fuchsia-400" size={20} />,
        route: '/admin/ai-config',
        status: 'Actif'
      },
      {
        name: 'Automatisation PV',
        description: 'Génération automatique des procès verbaux.',
        icon: <ServerCog className="text-rose-400" size={20} />,
        route: '/admin/pv-automation',
        status: 'Actif'
      }
    ]
  },
  {
    title: 'Data Core & Intégration',
    description: 'Hub de synchronisation et moteur de formulaires.',
    color: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/20',
    icon: <Database className="text-white" size={24} />,
    items: [
      {
        name: 'Moteur Kobo Interne',
        description: 'Définition et synchronisation des XLSForms natifs.',
        icon: <Database className="text-emerald-400" size={20} />,
        route: '/admin/internal-kobo',
        status: 'Actif'
      },
      {
        name: 'Mapping Terrain',
        description: 'Liaisons entre champs Kobo et base de données.',
        icon: <Link className="text-teal-400" size={20} />,
        route: '/admin/kobo-mapping',
        status: 'Actif'
      }
    ]
  },
  {
    title: 'Monitoring & Diagnostics',
    description: 'Santé de l\'application et journal d\'alertes.',
    color: 'from-orange-500 to-amber-500',
    shadow: 'shadow-orange-500/20',
    icon: <Activity className="text-white" size={24} />,
    items: [
      {
        name: 'Santé Système',
        description: 'Vérification des bases de données et services externes.',
        icon: <Activity className="text-orange-400" size={20} />,
        route: '/admin/diagnostic',
        status: 'Actif'
      },
      {
        name: 'Centre d\'Alertes',
        description: 'Journal des événements critiques et exceptions.',
        icon: <Bell className="text-amber-400" size={20} />,
        route: '/admin/alerts',
        status: 'Actif'
      }
    ]
  }
];

export default function AdminSystemHub() {
  const navigate = useNavigate();

  return (
    <PageContainer className="min-h-screen bg-[#0A0F1C]">
      <PageHeader
        backLink={{ to: '/home', label: 'Retour au Portail Principal' }}
        title="Centre de Contrôle GED OS"
        subtitle="Configuration globale des modules système"
        icon={<ServerCog size={28} className="text-white" />}
      />

      <ContentArea className="px-6 pb-12 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8"
        >
          {MODULES_CATEGORIES.map((category, idx) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-xl" style={{ backgroundImage: \`linear-gradient(to bottom right, var(--tw-gradient-stops))\` }} />
              
              <div className="relative h-full bg-[#111827]/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                
                {/* En-tête de catégorie */}
                <div className="p-8 border-b border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                  <div className={\`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br \${category.color} opacity-[0.03] rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3\`} />
                  
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={\`w-14 h-14 rounded-2xl bg-gradient-to-br \${category.color} \${category.shadow} flex items-center justify-center shrink-0 shadow-lg\`}>
                      {category.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">{category.title}</h2>
                      <p className="text-slate-400 mt-1">{category.description}</p>
                    </div>
                  </div>
                </div>

                {/* Liste des modules */}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {category.items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => navigate(item.route)}
                      className="w-full flex items-center p-4 rounded-2xl hover:bg-slate-800/50 transition-all duration-300 group/btn border border-transparent hover:border-slate-700"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-inner group-hover/btn:scale-110 transition-transform duration-300">
                        {item.icon}
                      </div>
                      <div className="ml-5 text-left flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                          {item.status && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{item.description}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center opacity-0 -translate-x-4 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300">
                        <ChevronRight className="text-white" size={20} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </ContentArea>
    </PageContainer>
  );
}
