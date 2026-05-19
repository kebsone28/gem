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
  Sprout
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
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
      '/admin/project-creation',
      '/admin/ai-config',
      '/admin/agent-local',
      '/admin/permissions',
      '/settings'
    ];
    return globalRoutes.some(route => location.pathname.startsWith(route));
  }, [location.pathname]);

  const cycleDesktopMode = () => {
    const nextMode =
      sidebarMode === 'wide' ? 'compact' : sidebarMode === 'compact' ? 'rail' : 'wide';
    setSidebarMode(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ged-os-sidebar-mode', nextMode);
      window.localStorage.setItem('ged-os-sidebar-density', nextMode === 'wide' ? 'wide' : 'compact');
    }
  };

  const [orgConfig, setOrgConfig] = useState<any>(null);
  useEffect(() => {
    organizationService
      .getConfig()
      .then(setOrgConfig)
      .catch(() => { });
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

  interface NavItem {
    id: string;
    to: string;
    icon: any;
    label: string;
    title: string; // Plain explanation for hover
    permission?: string | string[];
    visible?: boolean;
    category: 'PILOTAGE' | 'OPÉRATIONS' | 'SYSTÈME';
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
      if (module.key === 'communication') label = t('communication', 'Communication');
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
  }, [
    canAccessCharges,
    isMaster,
    missionLabel,
    nRole,
    visibleMissionPanels,
    t,
  ]);

  // 🚀 [REACTIVITY] Re-calculate items when user or permissions change
  const [globalModulesConfig, setGlobalModulesConfig] = useState<any>(null);
  useEffect(() => {
    modulesManagementService.getGlobalModulesConfig().then(setGlobalModulesConfig);
  }, []);

  const memoGroupedItems = useMemo(() => {
    // Liste des modules activés pour ce projet
    const enabledModules = project?.config?.enabledModules || null;

    return navItems.reduce(
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
          bordereau: 'bordereau'
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
        if (globalModulesConfig && item.id !== 'home') {
          const config = globalModulesConfig[targetModuleId];
          if (config && config.enabled === false) return acc;
        }

        // 🛡️ Filtre par module (Config Projet - isolation tenante)
        if (item.id !== 'home') {
          if (enabledModules) {
            const isSystemPage = [
              'modules', 'diagnostic', 'kobo_terminal', 'gem_toolbox', 'gem_collect',
              'organization', 'settings', 'security', 'help', 'users', 'ai_config', 'admin_agent', 'agriculture', 'health'
            ].includes(item.id);

            const bypassModuleCheck = isSystemPage && isMaster;
            if (!bypassModuleCheck && !enabledModules.includes(targetModuleId)) return acc;
          } else {
            // Sans projet chargé : les pages système passent toujours pour les admins
            const isSystemPage = [
              'modules', 'diagnostic', 'kobo_terminal', 'gem_toolbox', 'gem_collect',
              'organization', 'settings', 'security', 'help', 'users', 'ai_config', 'admin_agent', 'agriculture', 'health'
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
      {} as Record<string, NavItem[]>
    );
  }, [navItems, isMaster, peut, project?.config?.enabledModules, globalModulesConfig, isGlobalAdminContext]);

  const categoryConfig = {
    PILOTAGE: { color: 'blue', label: 'STRATÉGIE', glow: 'shadow-blue-500/10' },
    OPÉRATIONS: { color: 'blue', label: 'OPÉRATIONS TERRAIN', glow: 'shadow-blue-500/10' },
    SYSTÈME: { color: 'blue', label: 'ADMINISTRATION', glow: 'shadow-blue-500/10' },
  };
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
        className={`fixed lg:static inset-y-0 left-0 z-50 flex w-[22.75rem] max-w-[94vw] flex-col border-r border-white/8 bg-[radial-gradient(circle_at_top,#0b1531_0%,#070b1f_48%,#030712_100%)] shadow-2xl transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${asideWidthClass} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),transparent_18%,transparent_78%,rgba(15,23,42,0.45))] pointer-events-none" />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 top-3 rounded-[1.75rem] border border-white/6 bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:inset-x-4 lg:bottom-4 lg:top-4 lg:rounded-[2rem]" />

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
          className={`relative border-b border-white/6 px-4 pb-3 pt-4 lg:pb-4 lg:pt-5 ${isRailDesktop ? 'lg:px-3' : 'lg:px-6'}`}
        >
          <div
            className={`mb-2 flex items-center gap-3 lg:mb-2.5 ${isRailDesktop ? 'justify-center' : 'justify-between'}`}
          >
            {!isRailDesktop && (
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isGlobalAdminContext ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-blue-400/15 bg-blue-400/10 text-blue-200'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isGlobalAdminContext ? 'bg-amber-400 animate-pulse' : 'bg-blue-300'}`} />
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
              to="/home"
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
                  <h1 className="line-clamp-2 text-[18px] font-black leading-[0.98] tracking-[-0.04em] text-white/95 group-hover:text-blue-300 transition-colors lg:text-[20px]">
                    {organizationName}
                  </h1>
                  <div className="mt-1 flex flex-col gap-0.5 lg:mt-1.5">
                    <span className={`truncate text-[10.5px] font-semibold uppercase tracking-[0.16em] ${isGlobalAdminContext ? 'text-amber-400' : 'text-blue-300'}`}>
                      {isGlobalAdminContext ? 'Configuration Système' : (activeProjectName ?? 'Aucun projet sélectionné')}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      {isGlobalAdminContext ? 'Platform Governance' : (activeProjectName ? 'Projet actif' : 'Accueil → Sélectionner')}
                    </span>
                  </div>
                </div>
              )}
            </Link>

            {/* Notification Center Integration (Axe 4 - Amélioration Continue) */}
            {!isRailDesktop && <NotificationCenter />}
          </div>

          {!isRailDesktop ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Session active
              </span>
              <span className="truncate rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-slate-300">
                {roleDisplay}
              </span>
              <button
                onClick={() => forceSync()}
                disabled={isSyncing || !navigator.onLine}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] text-slate-300 hover:border-white/12 hover:bg-white/[0.06] hover:text-white'
                  }`}
                title="Lancer une synchronisation"
              >
                <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Sync...' : 'Sync'}
              </button>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${navigator.onLine
                    ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/15 bg-rose-500/10 text-rose-300'
                  }`}
              >
                <Activity size={8} className={navigator.onLine ? 'animate-pulse' : ''} />
                {navigator.onLine ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2">
              <NotificationCenter />
              <button
                onClick={() => forceSync()}
                disabled={isSyncing || !navigator.onLine}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] text-slate-300 hover:border-white/12 hover:bg-white/[0.06] hover:text-white'
                  }`}
                title="Lancer une synchronisation"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              </button>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${navigator.onLine
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
            className={`rounded-[1.7rem] border border-white/6 bg-white/[0.025] shadow-[0_16px_38px_rgba(2,6,23,0.14)] ${isRailDesktop ? 'px-2 py-3' : 'px-2.5 py-2 lg:px-3 lg:py-3'}`}
          >
            {Object.entries(memoGroupedItems).map(([cat, items], sectionIndex) => (
              <section
                key={cat}
                className={`${sectionIndex > 0 ? 'mt-3 border-t border-white/6 pt-3 lg:mt-4 lg:pt-4' : ''}`}
              >
                {!isRailDesktop ? (
                  <div className="mb-2 flex items-center justify-between gap-3 px-1 lg:mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                      {categoryConfig[cat as keyof typeof categoryConfig]?.label || cat}
                    </span>
                    <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-white/6 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      {items.length}
                    </span>
                  </div>
                ) : (
                  <div className="mb-2 flex justify-center">
                    <span
                      className="h-px w-8 bg-white/8"
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
                      ${isActive
                          ? 'border border-blue-500/20 bg-blue-500/10 text-white shadow-[0_12px_30px_rgba(37,99,235,0.12)]'
                          : 'border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-white'
                        }
                      ${isRailDesktop ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5 lg:py-3'}
                    `}
                    >
                      {({ isActive }) => (
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
                            className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border lg:h-10 lg:w-10 ${isActive
                                ? 'border-blue-400/20 bg-blue-400/10'
                                : 'border-white/5 bg-white/[0.03]'
                              }`}
                          >
                            <item.icon
                              size={18}
                              className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-blue-300' : 'text-slate-500'
                                }`}
                            />
                          </div>
                          {isRailDesktop && (
                            <div className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-white shadow-[0_18px_40px_rgba(2,6,23,0.45)] backdrop-blur-md group-hover:block">
                              {item.label}
                              <div className="absolute left-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-slate-950/95" />
                            </div>
                          )}
                          {!isRailDesktop && (
                            <div className="relative z-10 min-w-0 flex-1">
                              <span
                                className={`block ${isCompactDesktop ? 'truncate' : 'line-clamp-2'} text-[12.5px] font-semibold tracking-[0.04em] lg:text-[13px] lg:tracking-[0.06em] ${isActive ? 'text-white' : 'text-slate-300'
                                  }`}
                              >
                                {item.label}
                              </span>
                            </div>
                          )}
                          {isActive && !isRailDesktop && (
                            <div className="absolute right-4 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </section>
            ))}
          </div>
        </div>

        {/* Footer Context */}
        <div
          className={`relative mt-auto border-t border-white/6 p-3 ${isRailDesktop ? 'lg:px-2.5 lg:py-4' : 'lg:p-4'}`}
        >
          {/* Actions Systèmes IA & UI */}
          {isAdmin && (
            <div className={`grid gap-2 mb-4 ${isRailDesktop ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <button
                onClick={() => setShowAIPanel(true)}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
                title="Configuration IA Avancée"
              >
                <Brain size={18} />
                {!isRailDesktop && <span className="text-[11px] font-bold uppercase tracking-wider">IA Admin</span>}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all ${isRailDesktop ? 'justify-center' : ''}`}
                title="Paramètres de la Console"
              >
                <Settings size={18} />
                {!isRailDesktop && <span className="text-[11px] font-bold uppercase tracking-wider">Interface</span>}
              </button>
            </div>
          )}

          {!isRailDesktop && (
            <div className="rounded-[1.5rem] border border-white/6 bg-white/[0.025] px-4 py-3 text-[11px] text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  <p className="truncate uppercase tracking-[0.16em] text-slate-500">
                    {roleDisplay}
                  </p>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  {sidebarMode === 'compact' ? 'Compact' : 'Large'}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className={`group mt-3 flex w-full items-center border border-white/8 bg-white/[0.03] text-slate-300 transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 ${isRailDesktop ? 'justify-center rounded-2xl px-0 py-3.5' : 'justify-between rounded-[1.4rem] px-4 py-3.5 lg:mt-4 lg:px-5 lg:py-4'}`}
          >
            {!isRailDesktop && (
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                Se déconnecter
              </span>
            )}
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
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
