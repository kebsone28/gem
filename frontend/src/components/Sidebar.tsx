/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useState, useMemo } from 'react';
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
  ClipboardList,
  Activity,
  HelpCircle,
  Building2,
  Eye,
  Calendar,
  GraduationCap,
  MessagesSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
import { motion } from 'framer-motion';
import { normalizeRole, ROLES, isMasterAdmin, getMissionLabel } from '../utils/permissions';
import { useProject } from '../contexts/ProjectContext';
import { NotificationCenter } from './layout';

function RoleLabel({ user, nRole, forceSync, isSyncing }: { user: any; nRole?: string; forceSync: () => void; isSyncing: boolean }) {
  const labels: Record<string, string> = {
    [ROLES.ADMIN]: 'Admin',
    [ROLES.DG]: 'DG',
    [ROLES.CLIENT_LSE]: 'LSE',
    [ROLES.CHEF_EQUIPE]: 'Chef',
    [ROLES.CHEF_PROJET]: 'CP',
    [ROLES.COMPTABLE]: 'Comptable',
  };
  const labelText = nRole ? labels[nRole] : user.role;

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rôle</p>
          <p className="mt-1 text-sm font-semibold text-white">{labelText}</p>
        </div>
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
      </div>

      <div className="border-t border-white/6 pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Connectivité</span>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] ${
              navigator.onLine
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}
          >
            {navigator.onLine ? (
              <>
                <Activity size={8} className="animate-pulse" />
                EN LIGNE
              </>
            ) : (
              'HORS LIGNE'
            )}
          </div>
        </div>

        <button
          onClick={() => forceSync()}
          disabled={isSyncing || !navigator.onLine}
          className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
            isSyncing
              ? 'border-blue-500/20 bg-blue-500/10 shadow-[0_10px_30px_rgba(37,99,235,0.18)]'
              : 'border-white/5 bg-slate-900/35 hover:border-white/10 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/5 bg-white/5 p-2 text-blue-300">
              <RefreshCw size={14} strokeWidth={3} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight text-white">Synchronisation</p>
              <span className="text-xs text-slate-400">{isSyncing ? 'Mise à jour en cours' : 'Faisceau Cloud GEM à jour'}</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

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

  // 1️⃣ Normalisation et bypass sécurisé via helpers
  const nRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isMaster = useMemo(() => isMasterAdmin(user), [user]);
  const missionLabel = getMissionLabel(user);
  const roleLabels = useMemo(() => ({
    [ROLES.ADMIN]: 'Admin',
    [ROLES.DG]: 'Direction générale',
    [ROLES.CLIENT_LSE]: 'Client LSE',
    [ROLES.CHEF_EQUIPE]: "Chef d'équipe",
    [ROLES.CHEF_PROJET]: 'Chef de projet',
    [ROLES.COMPTABLE]: 'Comptable',
  }), []);
  const roleDisplay = (nRole && roleLabels[nRole]) || user?.role || 'Utilisateur';
  const organizationName = (user?.organizationConfig as any)?.branding?.organizationName || 'GEM SAAS';
  const projectLabel = project?.name || 'Wanekoo Core';
  const userInitials = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return 'G';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part: string) => part.charAt(0).toUpperCase()).join('');
  }, [user?.name]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  interface NavItem {
    to: string;
    icon: any;
    label: string;
    title: string; // Plain explanation for hover
    permission?: string;
    visible?: boolean;
    category: 'PILOTAGE' | 'OPÉRATIONS' | 'SYSTÈME';
  }

  const hasKoboTerminal = (user?.organizationConfig as any)?.features?.koboTerminal === true;

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
        permission: PERMISSIONS.VOIR_RAPPORTS,
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
        label: 'Terminal Kobo',
        title: 'Interface de commande directe pour la sync KoboToolbox',
        permission: PERMISSIONS.ACCES_TERMINAL_KOBO,
        visible: hasKoboTerminal,
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
        category: 'SYSTÈME' 
      },
    ],
    [PERMISSIONS, hasKoboTerminal, isMaster, missionLabel]
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
        className={`fixed lg:static inset-y-0 left-0 z-50 flex w-[21.5rem] max-w-[92vw] flex-col border-r border-white/8 bg-[radial-gradient(circle_at_top,#0b1531_0%,#070b1f_48%,#030712_100%)] shadow-2xl transition-transform duration-500 lg:w-80 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
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
        <div className="relative border-b border-white/6 px-4 pb-4 pt-4 lg:px-6 lg:pb-5 lg:pt-6">
          <div className="mb-2 flex items-center justify-between gap-3 lg:mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/15 bg-blue-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Control Deck
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.28)] lg:h-14 lg:w-14">
                {(user?.organizationConfig as any)?.branding?.logo ? (
                  <img
                    src={(user.organizationConfig as any).branding.logo}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <BarChart3 className="text-white" size={24} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="line-clamp-2 text-[20px] font-black leading-[0.98] tracking-[-0.04em] text-white/95 lg:text-[22px]">
                  {organizationName}
                </h1>
                <div className="mt-1.5 flex flex-col gap-1 lg:mt-2">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                    {projectLabel}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    {project?.name ? 'Projet actif' : 'Espace principal'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Notification Center Integration (Axe 4 - Amélioration Continue) */}
            <NotificationCenter />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 lg:mt-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Session active
            </span>
            <span className="truncate rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-slate-300">
              {roleDisplay}
            </span>
          </div>
        </div>

        {/* Navigation Scroll Area */}
        <div className="relative flex-1 overflow-y-auto px-3 py-3 no-scrollbar lg:px-4 lg:py-5">
          {Object.entries(memoGroupedItems).map(([cat, items]) => (
            <div key={cat} className="mb-4 rounded-[1.45rem] border border-white/6 bg-white/[0.025] p-2.5 shadow-[0_10px_30px_rgba(2,6,23,0.15)] lg:mb-5 lg:rounded-[1.65rem] lg:p-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1 lg:mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                  {categoryConfig[cat as keyof typeof categoryConfig]?.label || cat}
                </span>
                <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-white/6 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  {items.length}
                </span>
              </div>
              <nav className="space-y-1">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.title}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => `
                      group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 transition-all duration-300 lg:py-3
                      ${
                        isActive
                          ? 'border border-blue-500/20 bg-blue-500/10 text-white shadow-[0_12px_30px_rgba(37,99,235,0.12)]'
                          : 'border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-white'
                      }
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
                          <div className="absolute bottom-2 left-3 top-2 w-[3px] rounded-full bg-blue-300/90 shadow-[0_0_14px_rgba(96,165,250,0.8)]" />
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
                        <div className="relative z-10 min-w-0 flex-1">
                          <span className={`block truncate text-[12.5px] font-semibold tracking-[0.04em] lg:text-[13px] lg:tracking-[0.06em] ${
                            isActive ? 'text-white' : 'text-slate-300'
                          }`}>
                            {item.label}
                          </span>
                        </div>
                        {isActive && (
                          <div className="absolute right-4 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer Context */}
        <div className="relative mt-auto border-t border-white/6 p-3 lg:p-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/6 bg-slate-950/30 px-3 py-3 lg:px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-xs font-black text-white lg:h-10 lg:w-10">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-slate-400">
                {roleDisplay}
              </p>
            </div>
          </div>
          <RoleLabel user={user} nRole={nRole} forceSync={forceSync} isSyncing={isSyncing} />
          <button
            onClick={handleLogout}
            className="group mt-3 flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5 text-slate-300 transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 lg:mt-4 lg:px-5 lg:py-4"
          >
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">Se déconnecter</span>
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
