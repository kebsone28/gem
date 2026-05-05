/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
import { motion } from 'framer-motion';
import {
  normalizeRole,
  ROLES,
  isMasterAdmin,
  type UserRole,
} from '../utils/permissions';
import { useProject } from '../contexts/ProjectContext';
import { NotificationCenter } from './layout';

/**
 * Sidebar – Navigation principale Wanekoo (Deep Navy).
 * Design unifié sans switch de thème.
 */
export default function Sidebar() {
  const { user, logout, stopImpersonation } = useAuth();
  const { project } = useProject();
  const { forceSync } = useSync();
  // En SaaS, on simule l'état de sync (le store Dexie est géré par BackgroundServices)
  const isSyncing = false;
  const { peut, PERMISSIONS } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'wide' | 'compact' | 'rail'>(() => {
    if (typeof window === 'undefined') return 'wide';
    const storedMode = window.localStorage.getItem('gem-sidebar-mode');
    if (storedMode === 'wide' || storedMode === 'compact' || storedMode === 'rail') return storedMode;
    return window.localStorage.getItem('gem-sidebar-density') === 'compact' ? 'compact' : 'wide';
  });

  // 1️⃣ Normalisation et bypass sécurisé via helpers
  const nRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isMaster = useMemo(() => isMasterAdmin(user), [user]);
  const canAccessCharges = useMemo(
    () => isMaster || nRole === ROLES.ADMIN || nRole === ROLES.DG || nRole === ROLES.COMPTABLE,
    [isMaster, nRole]
  );
  const missionLabel = 'Missions';
  const roleLabels = useMemo<Partial<Record<UserRole, string>>>(() => ({
    [ROLES.ADMIN]: 'Admin',
    [ROLES.ADMIN_ALT]: 'Admin',
    [ROLES.DG]: 'Direction générale',
    [ROLES.DG_ALT]: 'Direction générale',
    [ROLES.DIRECTEUR]: 'Direction générale',
    [ROLES.CLIENT_LSE]: 'Client LSE',
    [ROLES.CHEF_EQUIPE]: "Chef d'équipe",
    [ROLES.CHEF_CHANTIER]: "Chef d'équipe",
    [ROLES.CHEF]: "Chef d'équipe",
    [ROLES.CHEF_PROJET]: 'Chef de projet',
    [ROLES.CHEF_PROJET_ALT]: 'Chef de projet',
    [ROLES.COMPTABLE]: 'Comptable',
  }), []);
  const roleDisplay = (nRole && roleLabels[nRole]) || user?.role || 'Utilisateur';
  const organizationName = (user?.organizationConfig as any)?.branding?.organizationName || 'GEM SAAS';
  const projectLabel = project?.name || 'Wanekoo Core';

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const cycleDesktopMode = () => {
    const nextMode = sidebarMode === 'wide' ? 'compact' : sidebarMode === 'compact' ? 'rail' : 'wide';
    setSidebarMode(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gem-sidebar-mode', nextMode);
      window.localStorage.setItem('gem-sidebar-density', nextMode === 'wide' ? 'wide' : 'compact');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.gemSidebarMode = sidebarMode;
    window.dispatchEvent(new CustomEvent('gem:sidebar-mode-change', { detail: { mode: sidebarMode } }));
  }, [sidebarMode]);

  interface NavItem {
    to: string;
    icon: any;
    label: string;
    title: string; // Plain explanation for hover
    permission?: string | string[];
    visible?: boolean;
    category: 'PILOTAGE' | 'OPÉRATIONS' | 'SYSTÈME';
  }

  const navItems: NavItem[] = useMemo(
    () => [
      { 
        to: '/dashboard', 
        icon: LayoutDashboard, 
        label: 'Tableau de Bord', 
        title: "Vue d'ensemble de la mission et indicateurs clés",
        category: 'PILOTAGE' 
      },
      {
        to: '/simulation',
        icon: Calculator,
        label: 'Simulation',
        title: 'Calculez vos budgets et simulez des scénarios financiers',
        permission: PERMISSIONS.VOIR_SIMULATION,
        category: 'PILOTAGE',
      },
      {
        to: '/charges',
        icon: BarChart3,
        label: 'Charge',
        title: 'Renseignez les budgets prévus, coûts réels et écarts financiers',
        permission: [PERMISSIONS.VOIR_FINANCES, PERMISSIONS.VOIR_PAIEMENTS],
        visible: canAccessCharges,
        category: 'PILOTAGE',
      },
      {
        to: '/bordereau',
        icon: Users,
        label: 'Bordereau',
        title: 'Gérez la logistique des équipes et les affectations terrain',
        permission: PERMISSIONS.GERER_LOGISTIQUE,
        category: 'PILOTAGE',
      },
      {
        to: '/cahier',
        icon: FileText,
        label: 'Cahier de Charge',
        title: 'Consultez les spécifications techniques et les rapports détaillés',
        permission: [PERMISSIONS.VOIR_RAPPORTS_TERRAIN, PERMISSIONS.VOIR_RAPPORTS_FINANCIERS],
        category: 'PILOTAGE',
      },
      {
        to: '/admin/pv-automation',
        icon: ShieldCheck,
        label: 'Automatisation PV',
        title: 'Générez et gérez les procès-verbaux automatiquement',
        permission: PERMISSIONS.GERER_PV,
        category: 'PILOTAGE',
      },
      {
        to: '/terrain',
        icon: MapIcon,
        label: 'Terrain',
        title: 'Suivez les ménages sur la carte interactive en temps réel',
        permission: PERMISSIONS.VOIR_CARTE,
        category: 'OPÉRATIONS',
      },
      {
        to: '/communication',
        icon: MessagesSquare,
        label: 'Communication',
        title: 'Messagerie équipe en direct, salons communs et discussions privées',
        category: 'OPÉRATIONS',
      },
      {
        to: '/planning',
        icon: Calendar,
        label: 'Planning',
        title: 'Planification intelligente des travaux par équipe',
        permission: PERMISSIONS.VOIR_CARTE,
        category: 'OPÉRATIONS',
      },
      {
        to: '/planning-formation',
        icon: GraduationCap,
        label: 'Formations',
        title: 'Planification des formations par région et session',
        permission: PERMISSIONS.VOIR_CARTE,
        category: 'OPÉRATIONS',
      },
      {
        to: '/logistique',
        icon: Truck,
        label: 'Logistique',
        title: 'Gestion du déploiement et des ressources matérielles',
        permission: PERMISSIONS.GERER_LOGISTIQUE,
        category: 'OPÉRATIONS',
      },
      {
        to: '/admin/approval',
        icon: ShieldCheck,
        label: 'Approbation',
        title: 'Validez ou rejetez les interventions effectuées sur le terrain',
        permission: PERMISSIONS.VALIDER_MISSION,
        category: 'OPÉRATIONS',
      },
      {
        to: '/admin/mission',
        icon: ClipboardList,
        label: missionLabel,
        title: 'Planifiez vos prochaines missions et objectifs',
        permission: PERMISSIONS.CREER_MISSION,
        category: 'OPÉRATIONS',
      },
      {
        to: '/admin/users',
        icon: Users,
        label: 'Utilisateurs',
        title: 'Gérez les comptes, les rôles et les accès de votre équipe',
        permission: PERMISSIONS.GERER_UTILISATEURS,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/diagnostic',
        icon: Activity,
        label: 'Diagnostic Santé',
        title: 'Vérifiez l’état technique du serveur et de la synchronisation',
        permission: PERMISSIONS.VOIR_DIAGNOSTIC,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/kobo-terminal',
        icon: Terminal,
        label: 'Terminal KoboToolbox',
        title: 'API officielle KoboCollect pour la synchronisation',
        permission: PERMISSIONS.ACCES_TERMINAL_KOBO,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/internal-kobo',
        icon: ClipboardCheck,
        label: 'GEM Toolbox',
        title: 'GEM Toolbox - Fiches terrain natives soumises directement au VPS',
        permission: PERMISSIONS.ACCES_TERMINAL_KOBO,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/gem-collect',
        icon: Activity,
        label: 'GEM Collect',
        title: 'GEM Collect - Moteur de saisie terrain universel GEM',
        permission: PERMISSIONS.VOIR_CARTE,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/organization',
        icon: Building2,
        label: 'Organisation',
        title: 'Configurez votre identité visuelle et les paramètres de structure',
        permission: PERMISSIONS.GERER_PARAMETRES,
        category: 'SYSTÈME',
      },
      {
        to: '/settings',
        icon: Settings,
        label: 'Paramètres',
        title: 'Réglages globaux de l’application et préférences personnelles',
        permission: PERMISSIONS.GERER_PARAMETRES,
        category: 'SYSTÈME',
      },
      {
        to: '/admin/security',
        icon: ShieldCheck,
        label: 'Sécurité',
        title: 'Journal d’audit et contrôles de sécurité avancés',
        permission: PERMISSIONS.GERER_PARAMETRES,
        category: 'SYSTÈME',
      },
      {
        to: '/aide',
        icon: HelpCircle,
        label: "Centre d'Aide",
        title: 'Besoin d’un guide ? Consultez notre documentation complète',
        category: 'SYSTÈME',
      },
    ],
    [PERMISSIONS, canAccessCharges, isMaster, missionLabel]
  );

  // 🚀 [REACTIVITY] Re-calculate items when user or permissions change
  const memoGroupedItems = useMemo(() => {
    return navItems.reduce(
      (acc, item) => {
        if (item.visible === false) return acc;
        const canSee = isMaster || !item.permission || peut(item.permission);
        if (canSee) {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
        }
        return acc;
      },
      {} as Record<string, NavItem[]>
    );
  }, [navItems, isMaster, peut]);

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
        <div className={`relative border-b border-white/6 px-4 pb-3 pt-4 lg:pb-4 lg:pt-5 ${isRailDesktop ? 'lg:px-3' : 'lg:px-6'}`}>
          <div className={`mb-2 flex items-center gap-3 lg:mb-2.5 ${isRailDesktop ? 'justify-center' : 'justify-between'}`}>
            {!isRailDesktop && (
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                Control Deck
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

          <div className={`flex items-start gap-3 ${isRailDesktop ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex min-w-0 items-center gap-3 ${isRailDesktop ? 'justify-center' : 'flex-1'}`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.28)] lg:h-12 lg:w-12">
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
                <h1 className="line-clamp-2 text-[18px] font-black leading-[0.98] tracking-[-0.04em] text-white/95 lg:text-[20px]">
                  {organizationName}
                </h1>
                <div className="mt-1 flex flex-col gap-0.5 lg:mt-1.5">
                  <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                    {projectLabel}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    {project?.name ? 'Projet actif' : 'Espace principal'}
                  </span>
                </div>
                </div>
              )}
            </div>
            
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                  isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] text-slate-300 hover:border-white/12 hover:bg-white/[0.06] hover:text-white'
                }`}
                title="Lancer une synchronisation"
              >
                <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Sync...' : 'Sync'}
              </button>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                  navigator.onLine
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
                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                  isSyncing
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/8 bg-white/[0.04] text-slate-300 hover:border-white/12 hover:bg-white/[0.06] hover:text-white'
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
        <div className={`relative flex-1 overflow-y-auto px-3 py-3 no-scrollbar lg:py-5 ${isRailDesktop ? 'lg:px-2.5' : 'lg:px-4'}`}>
          <div className={`rounded-[1.7rem] border border-white/6 bg-white/[0.025] shadow-[0_16px_38px_rgba(2,6,23,0.14)] ${isRailDesktop ? 'px-2 py-3' : 'px-2.5 py-2 lg:px-3 lg:py-3'}`}>
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
                <nav className={`${isRailDesktop ? 'space-y-2' : isCompactDesktop ? 'space-y-1' : 'space-y-1 xl:grid xl:grid-cols-2 xl:gap-1.5 xl:space-y-0'}`}>
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
                            <div className={`absolute rounded-full bg-blue-300/90 shadow-[0_0_14px_rgba(96,165,250,0.8)] ${isRailDesktop ? 'bottom-2 left-1/2 h-1.5 w-7 -translate-x-1/2' : 'bottom-2 left-3 top-2 w-[3px]'}`} />
                          )}
                          <div className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border lg:h-10 lg:w-10 ${
                            isActive
                              ? 'border-blue-400/20 bg-blue-400/10'
                              : 'border-white/5 bg-white/[0.03]'
                          }`}>
                            <item.icon
                              size={18}
                              className={`transition-transform duration-300 group-hover:scale-110 ${
                                isActive ? 'text-blue-300' : 'text-slate-500'
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
                              <span className={`block ${isCompactDesktop ? 'truncate' : 'line-clamp-2'} text-[12.5px] font-semibold tracking-[0.04em] lg:text-[13px] lg:tracking-[0.06em] ${
                                isActive ? 'text-white' : 'text-slate-300'
                              }`}>
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
        <div className={`relative mt-auto border-t border-white/6 p-3 ${isRailDesktop ? 'lg:px-2.5 lg:py-4' : 'lg:p-4'}`}>
          {!isRailDesktop && (
            <div className="rounded-[1.5rem] border border-white/6 bg-white/[0.025] px-4 py-3 text-[11px] text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  <p className="truncate uppercase tracking-[0.16em] text-slate-500">{roleDisplay}</p>
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
            {!isRailDesktop && <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">Se déconnecter</span>}
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </aside>

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
