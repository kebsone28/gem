/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  FileText,
  Users,
  Settings,
  LogOut,
  Calculator,
  BarChart3,
  ShieldCheck,
  Menu,
  RefreshCw,
  Terminal,
  Truck,
  X,
  ClipboardCheck,
  ClipboardList,
  Activity,
  HelpCircle,
  Building2,
  Eye,
  Calendar,
  GraduationCap,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Brain,
  Folder,
  Home,
  ServerCog,
  Sprout,
  Moon,
  Sun,
  Search,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
import { useNotificationBadges } from '../hooks/useNotificationBadges';
import { motion } from 'framer-motion';
import { normalizeRole, ROLES } from '../core/security/permissions';
import { AppRole } from '../core/security/types';
import type { UserRole } from '../core/security/types';
import { useProject } from '../contexts/ProjectContext';
import { NotificationCenter } from './layout';
import { ConsoleSettings } from './admin/ConsoleSettings';
import AIEngineAdminPanel from './ia/AIEngineAdminPanel';
import { organizationService } from '../services/organizationService';
import { modulesManagementService } from '../services/modulesManagementService';
import { PROJECT_CONFIG } from '../config/projectConfig';

import { MODULE_REGISTRY, getAllModules } from '../core/kernel/registry';
import { CATEGORY_ORDER, CATEGORY_METADATA } from '../core/navigation';
import type { ModuleCategory } from '../core/kernel/types';

const LUCIDE_ICONS: Record<string, any> = {
  Home,
  LayoutDashboard,
  Calculator,
  BarChart3,
  Users,
  FileText,
  Folder,
  ShieldCheck,
  Map: MapIcon,
  MessagesSquare,
  Calendar,
  GraduationCap,
  Truck,
  LayoutGrid,
  ClipboardList,
  ServerCog,
  Activity,
  Terminal,
  ClipboardCheck,
  Building2,
  Settings,
  Brain,
  HelpCircle,
  Sprout,
};

/**
 * Sidebar – Navigation principale GED OS (Deep Navy).
 * Design unifié sans switch de thème.
 */
export default function Sidebar() {
  const { user, logout, stopImpersonation } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { project, t } = useProject();
  const { forceSync } = useSync();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // En SaaS, on simule l'état de sync (le store Dexie est géré par BackgroundServices)
  const isSyncing = false;
  const { peut, isAdmin, PERMISSIONS } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'wide' | 'compact' | 'rail'>(() => {
    if (typeof window === 'undefined') return 'wide';
    const storedMode = window.localStorage.getItem('ged-os-sidebar-mode');
    if (storedMode === 'wide' || storedMode === 'compact' || storedMode === 'rail')
      return storedMode;
    return window.localStorage.getItem('ged-os-sidebar-density') === 'compact' ? 'compact' : 'wide';
  });

  const notifBadges = useNotificationBadges();
  const [searchQuery, setSearchQuery] = useState('');

  // 1️⃣ Normalisation et bypass sécurisé via helpers
  const nRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isMaster = isAdmin;
  const canAccessCharges = useMemo(
    () =>
      isMaster ||
      nRole === AppRole.ADMIN ||
      nRole === AppRole.DIRECTEUR ||
      nRole === AppRole.COMPTABLE,
    [isMaster, nRole]
  );
  const missionLabel = t('mission', 'Missions');
  const roleLabels: Record<string, string> = {
    [AppRole.ADMIN]: 'Admin',
    [AppRole.DIRECTEUR]: 'Direction générale',
    [AppRole.CHEF_PROJET]: 'Chef de projet',
    [AppRole.COMPTABLE]: 'Comptable',
    [AppRole.PATRIMOINE]: 'Gestion Patrimoine',
    [AppRole.SUPERVISEUR]: 'Superviseur Client',
    [AppRole.CONTROLEUR]: 'Contrôleur Client',
    [AppRole.CHEF_EQUIPE]: "Chef d'équipe",
  };
  const roleDisplay = (nRole && roleLabels[nRole]) || user?.role || 'Utilisateur';
  const organizationName =
    (user?.organizationConfig as any)?.branding?.organizationName || PROJECT_CONFIG.appName;
  // Nom du projet actif — ne jamais tomber sur un texte générique confusant
  const activeProjectName = project?.name || null;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // 🛡️ [ORCHESTRATION] Détecter si on est dans le "Cœur du Système" (Global Admin)
  const isGlobalAdminContext = useMemo(() => {
    const globalRoutes = [
      '/admin/hub',
      '/admin/users',
      '/admin/diagnostic',
      '/admin/organization',
      '/admin/security',
      '/projects/create',
      '/admin/ai-config',
      '/admin/agent-local',
      '/admin/permissions',
      '/settings',
    ];
    return globalRoutes.some((route) => location.pathname.startsWith(route));
  }, [location.pathname]);

  const cycleDesktopMode = () => {
    const nextMode =
      sidebarMode === 'wide' ? 'compact' : sidebarMode === 'compact' ? 'rail' : 'wide';
    setSidebarMode(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ged-os-sidebar-mode', nextMode);
      window.localStorage.setItem(
        'ged-os-sidebar-density',
        nextMode === 'wide' ? 'wide' : 'compact'
      );
    }
  };

  const [orgConfig, setOrgConfig] = useState<any>(null);
  useEffect(() => {
    organizationService
      .getConfig()
      .then(setOrgConfig)
      .catch(() => {});
  }, []);

  const visibleMissionPanels = useMemo(() => orgConfig?.mission_panels_dg || [], [orgConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.gedOsSidebarMode = sidebarMode;
    window.dispatchEvent(
      new CustomEvent('ged-os:sidebar-mode-change', { detail: { mode: sidebarMode } })
    );
  }, [sidebarMode]);

  // Écouter les réglages de la console pour forcer le mode Rail
  useEffect(() => {
    const handleGlobalSettings = (e: any) => {
      const settings = e.detail;
      // Si showSidebar est FALSE dans les réglages, on passe en mode RAIL
      setSidebarMode(settings.showSidebar ? 'wide' : 'rail');
    };
    window.addEventListener('ged-os:console-settings-change', handleGlobalSettings);
    return () => window.removeEventListener('ged-os:console-settings-change', handleGlobalSettings);
  }, []);

  // Carte des scopes : G (Globaux), D (Domaine), A (Admin)
  const MODULE_SCOPE: Record<string, 'G' | 'D' | 'A'> = {
    dashboard: 'G',
    mission: 'G',
    simulation: 'G',
    charges: 'G',
    bordereau: 'G',
    sharedoc: 'G',
    pv_automation: 'G',
    communication: 'G',
    planning: 'G',
    formation: 'G',
    atelier: 'G',
    cahier: 'G',
    ged_os_collect: 'G',
    terrain: 'D',
    logistique: 'D',
    mes: 'D',
    approval: 'D',
    ged_os_toolbox: 'A',
    kobo_terminal: 'A',
    admin_agent: 'A',
    ai_config: 'A',
    modules: 'A',
    users: 'A',
    diagnostic: 'A',
    kobo_mapping: 'A',
    organization: 'A',
    settings: 'A',
    security: 'A',
    admin_permissions: 'A',
    help: 'A',
  };

  interface NavItem {
    id: string;
    to: string;
    icon: any;
    label: string;
    title: string; // Plain explanation for hover
    permission?: string | string[];
    visible?: boolean;
    category: ModuleCategory;
  }

  const navItems: NavItem[] = useMemo(() => {
    const allModules = getAllModules();
    const context = {
      canAccessCharges,
      isMaster,
      missionLabel,
      nRole,
      visibleMissionPanels,
    };

    return allModules.map((module) => {
      // 🔄 [ADAPTATION] On surcharge les labels si nécessaire (i18n / dynamic)
      let label = module.name;
      if (module.key === 'dashboard') label = t('dashboard', 'Tableau de Bord');
      if (module.key === 'simulation') label = t('simulation', 'Simulation');
      if (module.key === 'charges') label = t('charges', 'Charge');
      if (module.key === 'bordereau') label = t('bordereau', 'Bordereau');
      if (module.key === 'cahier') label = t('cahier', 'Cahier de Charge');
      if (module.key === 'sharedoc') label = t('sharedoc', 'Documents Partagés');
      if (module.key === 'pv_automation') label = t('pv_automation', 'Automatisation PV');
      if (module.key === 'terrain') label = t('terrain', 'Terrain');
      if (module.key === 'communication') label = t('communication', 'Chat');
      if (module.key === 'planning') label = t('planning', 'Planning');
      if (module.key === 'formation') label = t('formation', 'Formations');
      if (module.key === 'logistique') label = t('logistique', 'Logistique');
      if (module.key === 'atelier') label = t('atelier', 'Atelier');
      if (module.key === 'approval') label = t('approval', 'Approbation');
      if (module.key === 'users') label = t('users', 'Utilisateurs');
      if (module.key === 'mission') label = missionLabel;

      // 🔄 [ADAPTATION] On surcharge les descriptions si nécessaire
      let title = module.description;
      if (module.key === 'terrain')
        title = t('terrain_desc', 'Suivez les entités sur la carte interactive en temps réel');

      return {
        id: module.key,
        to: module.route,
        icon: LUCIDE_ICONS[module.icon] || HelpCircle,
        label,
        title,
        permission: module.requiredPermission as string | string[],
        visible: module.visible ? module.visible(context) : true,
        category: module.category,
      };
    });
  }, [canAccessCharges, isMaster, missionLabel, nRole, visibleMissionPanels, t]);

  // 🚀 [REACTIVITY] Re-calculate items when user or permissions change
  const [globalModulesConfig, setGlobalModulesConfig] = useState<any>(null);
  const [domainModulesConfig, setDomainModulesConfig] = useState<any>(null);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);

  useEffect(() => {
    modulesManagementService.getGlobalModulesConfig().then(setGlobalModulesConfig);
    // Déterminer le domaine courant depuis le localStorage
    const sector = localStorage.getItem('selectedSector');
    if (sector) {
      // SECTOR_GEM → gem, SECTOR_MES → mes
      const domain = sector.replace('SECTOR_', '').toLowerCase();
      setCurrentDomain(domain);
      modulesManagementService.getDomainModulesConfig().then(setDomainModulesConfig);
    }
  }, []);

  const memoGroupedItems = useMemo(() => {
    // Liste des modules activés pour ce projet
    const enabledModules = project?.config?.enabledModules || null;

    const filteredNavItems = navItems.filter((item) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return item.label.toLowerCase().includes(query) || item.title.toLowerCase().includes(query);
    });

    return filteredNavItems.reduce(
      (acc, item) => {
        if (item.visible === false) return acc;

        const moduleMapping: Record<string, string> = {
          approval: 'approbation',
          atelier: 'logistique',
          cahier: 'documents',
          sharedoc: 'documents',
          gem_toolbox: 'documents',
          gem_collect: 'documents',
          pv_automation: 'documents',
          charges: 'advanced_analytics',
          ai_config: 'ai_assistant',
          simulation: 'ai_assistant',
          formation: 'formation',
          planning: 'planning',
          bordereau: 'bordereau',
          mes: 'sectors',
          kobo_mapping: 'admin',
          kobo_terminal: 'admin',
        };
        const targetModuleId = moduleMapping[item.id] || item.id;

        // 🛡️ [ORCHESTRATION] Mode "Configuration Système" : n'afficher que les éléments essentiels
        if (isGlobalAdminContext) {
          if (!['home', 'modules', 'users'].includes(item.id)) return acc;
          // Bypass tous les autres filtres pour ces items — on vérifie juste la permission
          const canSee = isMaster || !item.permission || peut(item.permission);
          if (canSee) {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
          }
          return acc;
        }

        // 🛡️ [SAAS GLOBAL] Vérifier si le module est activé globalement
        if (globalModulesConfig && item.id !== 'home' && !isMaster) {
          const config = globalModulesConfig[targetModuleId];
          if (config && config.enabled === false) return acc;
        }

        // 🛡️ [DOMAIN] Vérifier si le module est activé pour le domaine courant
        if (domainModulesConfig && currentDomain && item.id !== 'home' && !isMaster) {
          const domainConfig = domainModulesConfig[currentDomain];
          if (domainConfig) {
            const moduleDomainConfig = domainConfig[targetModuleId];
            if (moduleDomainConfig && moduleDomainConfig.enabled === false) return acc;
          }
        }

        // 🛡️ Filtre par module (Config Projet - isolation tenante)
        if (item.id !== 'home' && !isMaster) {
          if (enabledModules) {
            const isSystemPage = [
              'modules',
              'diagnostic',
              'kobo_terminal',
              'gem_toolbox',
              'gem_collect',
              'organization',
              'settings',
              'security',
              'help',
              'users',
              'ai_config',
              'admin_agent',
            ].includes(item.id);

            const bypassModuleCheck = isSystemPage && isMaster;
            if (!bypassModuleCheck && !enabledModules.includes(targetModuleId)) return acc;
          } else {
            // Sans projet chargé : les pages système passent toujours pour les admins
            const isSystemPage = [
              'modules',
              'diagnostic',
              'kobo_terminal',
              'gem_toolbox',
              'gem_collect',
              'organization',
              'settings',
              'security',
              'help',
              'users',
              'ai_config',
              'admin_agent',
            ].includes(item.id);
            if (!isSystemPage && !PROJECT_CONFIG.isModuleEnabled(item.id)) return acc;
          }
        }

        const canSee = isMaster || !item.permission || peut(item.permission);
        if (canSee) {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
        }
        return acc;
      },
      {} as Record<ModuleCategory, NavItem[]>
    );
  }, [
    navItems,
    isMaster,
    peut,
    project?.config?.enabledModules,
    globalModulesConfig,
    domainModulesConfig,
    currentDomain,
    isGlobalAdminContext,
    searchQuery,
  ]);

  // Calculate total visible modules
  const totalVisibleModules = useMemo(() => {
    return Object.values(memoGroupedItems).reduce((sum, items) => sum + items.length, 0);
  }, [memoGroupedItems]);

  // Color mapping for different module types
  const getModuleColor = (itemId: string, isActive: boolean) => {
    const colors: Record<string, { from: string; to: string; glow: string; text: string }> = {
      dashboard: {
        from: 'from-blue-400/20',
        to: 'to-cyan-400/20',
        glow: 'rgba(96, 165, 250, 0.6)',
        text: 'text-blue-300',
      },
      simulation: {
        from: 'from-purple-400/20',
        to: 'to-pink-400/20',
        glow: 'rgba(192, 132, 252, 0.6)',
        text: 'text-purple-300',
      },
      charges: {
        from: 'from-emerald-400/20',
        to: 'to-green-400/20',
        glow: 'rgba(52, 211, 153, 0.6)',
        text: 'text-emerald-300',
      },
      bordereau: {
        from: 'from-amber-400/20',
        to: 'to-yellow-400/20',
        glow: 'rgba(251, 191, 36, 0.6)',
        text: 'text-amber-300',
      },
      sharedoc: {
        from: 'from-violet-400/20',
        to: 'to-purple-400/20',
        glow: 'rgba(167, 139, 250, 0.6)',
        text: 'text-violet-300',
      },
      pv_automation: {
        from: 'from-rose-400/20',
        to: 'to-red-400/20',
        glow: 'rgba(251, 113, 133, 0.6)',
        text: 'text-rose-300',
      },
      terrain: {
        from: 'from-orange-400/20',
        to: 'to-red-400/20',
        glow: 'rgba(251, 146, 60, 0.6)',
        text: 'text-orange-300',
      },
      communication: {
        from: 'from-sky-400/20',
        to: 'to-blue-400/20',
        glow: 'rgba(56, 189, 248, 0.6)',
        text: 'text-sky-300',
      },
      planning: {
        from: 'from-teal-400/20',
        to: 'to-emerald-400/20',
        glow: 'rgba(45, 212, 191, 0.6)',
        text: 'text-teal-300',
      },
      formation: {
        from: 'from-indigo-400/20',
        to: 'to-blue-400/20',
        glow: 'rgba(99, 102, 241, 0.6)',
        text: 'text-indigo-300',
      },
      logistique: {
        from: 'from-lime-400/20',
        to: 'to-green-400/20',
        glow: 'rgba(163, 230, 53, 0.6)',
        text: 'text-lime-300',
      },
      atelier: {
        from: 'from-fuchsia-400/20',
        to: 'to-pink-400/20',
        glow: 'rgba(232, 121, 249, 0.6)',
        text: 'text-fuchsia-300',
      },
      approval: {
        from: 'from-red-400/20',
        to: 'to-rose-400/20',
        glow: 'rgba(248, 113, 113, 0.6)',
        text: 'text-red-300',
      },
      mission: {
        from: 'from-orange-400/20',
        to: 'to-amber-400/20',
        glow: 'rgba(251, 146, 60, 0.6)',
        text: 'text-orange-300',
      },
      mes: {
        from: 'from-cyan-400/20',
        to: 'to-teal-400/20',
        glow: 'rgba(34, 211, 238, 0.6)',
        text: 'text-cyan-300',
      },
      users: {
        from: 'from-slate-400/20',
        to: 'to-gray-400/20',
        glow: 'rgba(148, 163, 184, 0.6)',
        text: 'text-slate-300',
      },
      ai_config: {
        from: 'from-violet-400/20',
        to: 'to-indigo-400/20',
        glow: 'rgba(139, 92, 246, 0.6)',
        text: 'text-violet-300',
      },
    };

    if (isActive && colors[itemId]) {
      return colors[itemId];
    }
    return {
      from: 'from-blue-400/20',
      to: 'to-purple-400/20',
      glow: 'rgba(96, 165, 250, 0.6)',
      text: 'text-blue-300',
    };
  };

  const categoryConfig = CATEGORY_METADATA;
  const isRailDesktop = sidebarMode === 'rail';
  const isCompactDesktop = sidebarMode !== 'wide';
  const asideWidthClass =
    sidebarMode === 'rail'
      ? 'lg:w-[6.25rem] xl:w-[6.5rem]'
      : sidebarMode === 'compact'
        ? 'lg:w-[19.25rem] xl:w-[20.25rem]'
        : 'lg:w-[23.5rem] xl:w-[24.75rem]';

  // 🛡️ [RESILIENCE] If auth is loading, avoid empty black box
  if (!user) {
    return (
      <div className="hidden lg:flex w-72 flex-col h-screen fixed left-0 bg-slate-950 border-r border-white/5 items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        {...{ 'aria-expanded': mobileOpen }}
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="lg:hidden fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-2xl bg-electric-gradient text-white shadow-electric transition-transform active:scale-95"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex w-[22.75rem] max-w-[94vw] flex-col border-r transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${asideWidthClass} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          backgroundImage: 'var(--sidebar-bg-gradient)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg,rgba(59,130,246,0.08),transparent_18%,transparent_78%,rgba(15,23,42,0.45))',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-3 bottom-3 top-3 rounded-[1.75rem] border bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:inset-x-4 lg:bottom-4 lg:top-4 lg:rounded-[2rem]"
          style={{
            backgroundColor: 'var(--sidebar-inner-bg)',
            borderColor: 'var(--sidebar-inner-border)',
          }}
        />

        {/* Simulation Bar (God Mode) */}
        {user?.impersonatedBy && (
          <div className="relative mx-4 mb-3 mt-4 rounded-2xl border border-indigo-400/30 bg-indigo-600 p-3 shadow-lg shadow-indigo-500/20 lg:mx-6 lg:mb-4 lg:mt-5 lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center animate-pulse">
                  <Eye size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest leading-none">
                    Simulation Active
                  </p>
                  <p className="text-xs font-black text-white mt-1">Vue comme : {user.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => stopImpersonation()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all active:scale-90"
                aria-label="Redevenir Admin"
                title="Redevenir Admin"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* Logo Area */}
        <div
          className={`relative border-b px-4 pb-3 pt-4 lg:pb-4 lg:pt-5 ${isRailDesktop ? 'lg:px-3' : 'lg:px-6'}`}
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          <div
            className={`mb-2 flex items-center gap-3 lg:mb-2.5 ${isRailDesktop ? 'justify-center' : 'justify-between'}`}
          >
            {!isRailDesktop && (
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isGlobalAdminContext ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-blue-400/15 bg-blue-400/10 text-blue-200'}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isGlobalAdminContext ? 'bg-amber-400 animate-pulse' : 'bg-blue-300'}`}
                />
                {isGlobalAdminContext ? 'GED OS Orchestration' : 'GED OS | Pilotage'}
              </div>
            )}
            <button
              type="button"
              onClick={cycleDesktopMode}
              className="hidden lg:inline-flex items-center justify-center rounded-full border border-white/8 bg-white/[0.04] p-2 text-slate-300 transition hover:border-white/12 hover:bg-white/[0.07] hover:text-white"
              title={
                sidebarMode === 'wide'
                  ? 'Passer en panneau compact'
                  : sidebarMode === 'compact'
                    ? 'Passer en rail icônes'
                    : 'Revenir en panneau large'
              }
              aria-label={
                sidebarMode === 'wide'
                  ? 'Passer en panneau compact'
                  : sidebarMode === 'compact'
                    ? 'Passer en rail icônes'
                    : 'Revenir en panneau large'
              }
            >
              {sidebarMode === 'wide' ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          </div>

          <div
            className={`flex items-start gap-3 ${isRailDesktop ? 'justify-center' : 'justify-between'}`}
          >
            <Link
              to="/projects"
              title="Retour à la sélection des projets"
              className={`flex min-w-0 items-center gap-3 ${isRailDesktop ? 'justify-center' : 'flex-1'} group cursor-pointer transition-all duration-200 hover:opacity-85`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.28)] transition-transform duration-300 group-hover:scale-105 lg:h-12 lg:w-12">
                {(user?.organizationConfig as any)?.branding?.logo ? (
                  <img
                    src={(user.organizationConfig as any).branding.logo}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <BarChart3 className="text-white" size={22} />
                )}
              </div>
              {!isRailDesktop && (
                <div className="min-w-0 flex-1">
                  <h1
                    className="line-clamp-2 text-[18px] font-black leading-[0.98] tracking-[-0.04em] group-hover:text-blue-300 transition-colors lg:text-[20px]"
                    style={{ color: 'var(--sidebar-text-primary)' }}
                  >
                    {organizationName}
                  </h1>
                  <div className="mt-1 flex items-center gap-2 lg:mt-1.5">
                    <span
                      className={`truncate text-[10.5px] font-semibold uppercase tracking-[0.16em] ${isGlobalAdminContext ? 'text-amber-400' : 'text-blue-300'}`}
                    >
                      {isGlobalAdminContext
                        ? 'Configuration Système'
                        : (activeProjectName ?? 'Aucun projet sélectionné')}
                    </span>
                  </div>
                </div>
              )}
            </Link>

            {/* Notification Center Integration (Axe 4 - Amélioration Continue) */}
            {!isRailDesktop && <NotificationCenter />}
          </div>

          {!isRailDesktop ? (
            <div
              className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: 'var(--sidebar-text-muted)' }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
                style={{
                  borderColor: 'rgba(16, 185, 129, 0.15)',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                En ligne
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
                style={{
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  color: 'var(--sidebar-text-secondary)',
                }}
              >
                👤 {roleDisplay}
              </span>
              <button
                onClick={() => forceSync()}
                disabled={isSyncing || !navigator.onLine}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                  isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] hover:border-white/12 hover:bg-white/[0.06]'
                }`}
                title="Lancer une synchronisation"
              >
                <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? '...' : ''}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2">
              <NotificationCenter />
              <button
                onClick={() => forceSync()}
                disabled={isSyncing || !navigator.onLine}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                  isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] hover:border-white/12 hover:bg-white/[0.06]'
                }`}
                title="Lancer une synchronisation"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              </button>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  navigator.onLine
                    ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/15 bg-rose-500/10 text-rose-300'
                }`}
                title={navigator.onLine ? 'En ligne' : 'Hors ligne'}
              >
                <Activity size={12} className={navigator.onLine ? 'animate-pulse' : ''} />
              </span>
            </div>
          )}
        </div>

        {/* Navigation Scroll Area */}
        <div
          className={`relative flex-1 overflow-y-auto px-3 py-3 no-scrollbar lg:py-5 ${isRailDesktop ? 'lg:px-2.5' : 'lg:px-4'}`}
        >
          <div
            className={`rounded-[1.7rem] border bg-white/[0.025] shadow-[0_16px_38px_rgba(2,6,23,0.14)] ${isRailDesktop ? 'px-2 py-3' : 'px-2.5 py-2 lg:px-3 lg:py-3'}`}
            style={{
              backgroundColor: 'var(--sidebar-inner-bg)',
              borderColor: 'var(--sidebar-inner-border)',
            }}
          >
            {/* Search and Total Modules */}
            {!isRailDesktop && (
              <div className="mb-3 px-1 lg:mb-4 lg:px-1">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex items-center gap-3 rounded-2xl border px-4 py-2"
                    style={{
                      borderColor: 'var(--sidebar-badge-border)',
                      backgroundColor: 'var(--sidebar-badge-bg)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div className="flex flex-col">
                      <span
                        className="text-2xl font-black leading-none"
                        style={{ color: 'var(--sidebar-badge-text)' }}
                      >
                        {totalVisibleModules}
                      </span>
                      <span
                        className="text-[9px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: 'var(--sidebar-text-muted)' }}
                      >
                        Modules
                      </span>
                    </div>
                    <LayoutGrid size={16} style={{ color: 'var(--sidebar-badge-text)' }} />
                  </div>
                </div>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: 'var(--sidebar-input-placeholder)' }}
                  />
                  <input
                    type="text"
                    placeholder="Rechercher un module..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    style={{
                      backgroundColor: 'var(--sidebar-input-bg)',
                      borderColor: 'var(--sidebar-input-border)',
                      color: 'var(--sidebar-text-primary)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors z-10"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {CATEGORY_ORDER.filter(
              (cat) => memoGroupedItems[cat] && memoGroupedItems[cat]!.length > 0
            ).map((cat, sectionIndex) => {
              const items = memoGroupedItems[cat]!;
              return (
                <section
                  key={cat}
                  className={`${sectionIndex > 0 ? 'mt-3 border-t pt-3 lg:mt-4 lg:pt-4' : ''}`}
                  style={{ borderColor: 'var(--sidebar-inner-border)' }}
                >
                  {!isRailDesktop ? (
                    <div className="mb-3 flex flex-col gap-2 px-1 lg:mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: 'var(--sidebar-inner-border)' }}
                        />
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.2em] px-2"
                          style={{ color: 'var(--sidebar-text-secondary)' }}
                        >
                          {categoryConfig[cat as keyof typeof categoryConfig]?.label || cat}
                        </span>
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: 'var(--sidebar-inner-border)' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2 flex justify-center">
                      <span
                        className="h-px w-8"
                        style={{ backgroundColor: 'var(--sidebar-inner-border)' }}
                        title={categoryConfig[cat as keyof typeof categoryConfig]?.label || cat}
                      />
                    </div>
                  )}
                  <nav
                    className={`${isRailDesktop ? 'space-y-2' : isCompactDesktop ? 'space-y-1' : 'space-y-1 xl:grid xl:grid-cols-2 xl:gap-1.5 xl:space-y-0'}`}
                  >
                    {items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.title}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `
                      group relative flex items-center overflow-visible rounded-2xl transition-all duration-300
                      ${
                        isActive
                          ? 'border shadow-lg'
                          : 'border border-white/10 hover:border-white/20 hover:shadow-md hover:-translate-y-0.5'
                      }
                      ${isRailDesktop ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-3 lg:py-3'}
                    `}
                        style={({ isActive }) => ({
                          borderColor: isActive
                            ? 'var(--sidebar-nav-active-border)'
                            : 'rgba(255, 255, 255, 0.1)',
                          backgroundColor: isActive
                            ? 'var(--sidebar-nav-active-bg)'
                            : 'rgba(255, 255, 255, 0.05)',
                          boxShadow: isActive
                            ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                            : '0 2px 8px rgba(0, 0, 0, 0.1)',
                        })}
                      >
                        {({ isActive }) => {
                          const moduleColor = getModuleColor(item.id, isActive);
                          return (
                            <>
                              {isActive && (
                                <motion.div
                                  layoutId="nav-active"
                                  className="absolute inset-0 bg-blue-500/[0.07]"
                                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                              )}
                              {isActive && (
                                <div
                                  className={`absolute rounded-full bg-blue-300/90 shadow-[0_0_14px_rgba(96,165,250,0.8)] ${isRailDesktop ? 'bottom-2 left-1/2 h-1.5 w-7 -translate-x-1/2' : 'bottom-2 left-3 top-2 w-[3px]'}`}
                                />
                              )}
                              <div
                                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-xl border lg:h-8 lg:w-8 transition-all duration-300 ${
                                  isActive
                                    ? `border-blue-400/20 bg-gradient-to-br ${moduleColor.from} ${moduleColor.to}`
                                    : 'border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/10 hover:from-white/10 hover:to-white/5'
                                }`}
                              >
                                <item.icon
                                  size={14}
                                  className={`transition-all duration-300 group-hover:scale-110 ${
                                    isActive ? moduleColor.text : 'text-slate-400'
                                  }`}
                                  style={{
                                    filter: isActive
                                      ? `drop-shadow(0 0 8px ${moduleColor.glow})`
                                      : 'drop-shadow(0 0 4px rgba(148, 163, 184, 0.3))',
                                  }}
                                />
                                {item.id === 'mission' &&
                                  notifBadges.approvalUnread + notifBadges.rejectionUnread > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white shadow-[0_4px_10px_rgba(244,63,94,0.4)]">
                                      {notifBadges.approvalUnread + notifBadges.rejectionUnread > 9
                                        ? '9+'
                                        : notifBadges.approvalUnread + notifBadges.rejectionUnread}
                                    </span>
                                  )}
                                {item.id === 'approval' && notifBadges.approvalUnread > 0 && (
                                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold text-white shadow-[0_4px_10px_rgba(251,191,36,0.4)]">
                                    {notifBadges.approvalUnread > 9
                                      ? '9+'
                                      : notifBadges.approvalUnread}
                                  </span>
                                )}
                              </div>
                              {/* Rail mode scope badge under the icon */}
                              {isRailDesktop && MODULE_SCOPE[item.id] && (
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-[3px] px-[3px] text-[6px] font-black leading-none shadow-lg ${
                                    MODULE_SCOPE[item.id] === 'G'
                                      ? 'bg-emerald-500/80 text-white'
                                      : MODULE_SCOPE[item.id] === 'D'
                                        ? 'bg-amber-500/80 text-white'
                                        : 'bg-blue-500/80 text-white'
                                  }`}
                                >
                                  {MODULE_SCOPE[item.id]}
                                </span>
                              )}
                              {isRailDesktop && (
                                <div className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-white shadow-[0_18px_40px_rgba(2,6,23,0.45)] backdrop-blur-md group-hover:block">
                                  {item.label}
                                  <span className="ml-1.5 text-[8px] font-black">
                                    {MODULE_SCOPE[item.id] === 'G' && (
                                      <span className="text-emerald-400">[G]</span>
                                    )}
                                    {MODULE_SCOPE[item.id] === 'D' && (
                                      <span className="text-amber-400">[D]</span>
                                    )}
                                    {MODULE_SCOPE[item.id] === 'A' && (
                                      <span className="text-blue-400">[A]</span>
                                    )}
                                  </span>
                                  <div className="absolute left-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-slate-950/95" />
                                </div>
                              )}
                              {!isRailDesktop && (
                                <div className="relative z-10 min-w-0 flex-1">
                                  <span
                                    className={`block ${isCompactDesktop ? 'truncate' : 'line-clamp-2'} text-[11px] font-bold tracking-[0.04em] lg:text-[11.5px] lg:tracking-[0.04em]`}
                                    style={{
                                      color: isActive
                                        ? 'var(--sidebar-text-primary)'
                                        : 'var(--sidebar-text-secondary)',
                                    }}
                                  >
                                    {item.label}
                                    {/* Scope badges — G: Globaux, D: Domaine, A: Admin */}
                                    {MODULE_SCOPE[item.id] === 'G' && (
                                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-md shadow-sm shadow-emerald-500/10">
                                        G
                                      </span>
                                    )}
                                    {MODULE_SCOPE[item.id] === 'D' && (
                                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-md shadow-sm shadow-amber-500/10">
                                        D
                                      </span>
                                    )}
                                    {MODULE_SCOPE[item.id] === 'A' && (
                                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] bg-blue-500/15 border border-blue-500/25 text-blue-400 rounded-md shadow-sm shadow-blue-500/10">
                                        A
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {isActive && !isRailDesktop && (
                                <div className="absolute right-4 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
                              )}
                            </>
                          );
                        }}
                      </NavLink>
                    ))}
                  </nav>
                </section>
              );
            })}
          </div>
        </div>

        {/* Footer Context */}
        <div
          className={`relative mt-auto border-t border-white/6 p-3 ${isRailDesktop ? 'lg:px-2.5 lg:py-4' : 'lg:p-4'}`}
        >
          {/* Actions Systèmes IA & UI */}
          {isAdmin && (
            <div className={`grid gap-2 mb-4 ${isRailDesktop ? 'grid-cols-1' : 'grid-cols-1'}`}>
              <button
                onClick={() => setShowAIPanel(true)}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 text-indigo-200 hover:from-indigo-500/30 hover:to-purple-500/30 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
                title="Configuration IA Avancée"
                style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
              >
                <Brain size={18} />
                {!isRailDesktop && (
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      ✨ IA Admin
                    </span>
                    <span className="text-[9px] font-medium tracking-wide opacity-80">
                      Assistant intelligent
                    </span>
                  </div>
                )}
              </button>
              <div className={`grid gap-2 ${isRailDesktop ? 'grid-cols-1' : 'grid-cols-1'}`}>
                <button
                  onClick={() => setShowSettings(true)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
                  title="Paramètres de la Console"
                >
                  <Settings size={16} />
                  {!isRailDesktop && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      ⚙️ Interface
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {!isRailDesktop && (
            <div
              className="rounded-[1.5rem] border border-white/6 bg-white/[0.025] px-4 py-3 text-[11px] text-slate-400"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="truncate text-sm font-semibold text-white">👤 {user.name}</p>
                    {(user.impersonatedBy || (user as any).isSimulation) && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-[9px] font-black uppercase text-rose-300 tracking-wider animate-pulse">
                        <span className="h-1 w-1 rounded-full bg-rose-400" />
                        Simulé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className={`grid gap-2 mt-3 ${isRailDesktop ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-slate-400 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
              title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {!isRailDesktop && (
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {isDarkMode ? 'Clair' : 'Sombre'}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-slate-400 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <LogOut size={16} />
              {!isRailDesktop && (
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Déconnexion
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Modaux Globales (IA & UI) */}
      {showAIPanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <AIEngineAdminPanel user={user} onClose={() => setShowAIPanel(false)} />
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100]">
          <ConsoleSettings onSettingsChange={() => {}} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Mobile Overlay */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
          className="fixed lg:hidden inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
        />
      )}
    </>
  );
}
