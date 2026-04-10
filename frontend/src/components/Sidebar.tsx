import { useState } from 'react';
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
    Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Sidebar – Navigation principale Wanekoo (Deep Navy).
 * Design unifié sans switch de thème.
 */
export default function Sidebar() {
    const { user, logout, stopImpersonation } = useAuth();
    const { forceSync } = useSync();
    // En SaaS, on simule l'état de sync (le store Dexie est géré par BackgroundServices)
    const isSyncing = false; 
    const { peut, PERMISSIONS } = usePermissions();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    interface NavItem {
        to: string;
        icon: any;
        label: string;
        permission?: string;
        visible?: boolean;
        category: 'PILOTAGE' | 'OPÉRATIONS' | 'SYSTÈME';
    }

    const navItems: NavItem[] = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de Bord', category: 'PILOTAGE' },
        { to: '/simulation', icon: Calculator, label: 'Simulation', permission: PERMISSIONS.VOIR_SIMULATION, category: 'PILOTAGE' },
        { to: '/bordereau', icon: Users, label: 'Bordereau', permission: PERMISSIONS.GERER_LOGISTIQUE, category: 'PILOTAGE' },
        { to: '/cahier', icon: FileText, label: 'Cahier de Charge', permission: PERMISSIONS.VOIR_RAPPORTS, category: 'PILOTAGE' },
        { to: '/terrain', icon: MapIcon, label: 'Terrain', permission: PERMISSIONS.VOIR_CARTE, category: 'OPÉRATIONS' },
        { to: '/logistique', icon: Truck, label: 'Logistique', permission: PERMISSIONS.GERER_LOGISTIQUE, category: 'OPÉRATIONS' },
        { to: '/admin/approval', icon: ShieldCheck, label: 'Approbation', permission: PERMISSIONS.VALIDER_MISSION, category: 'OPÉRATIONS' },
        { 
            to: '/admin/mission', 
            icon: ClipboardList, 
            label: (user?.role === 'DG_PROQUELEC' || user?.role === 'DIRECTEUR') ? 'Mes Ordres de Mission' : (user?.role === 'ADMIN_PROQUELEC' ? 'Registre des Missions' : 'Missions OM'), 
            permission: PERMISSIONS.CREER_MISSION,
            category: 'OPÉRATIONS' 
        },
        { to: '/admin/users', icon: Users, label: 'Utilisateurs', permission: PERMISSIONS.GERER_UTILISATEURS, category: 'SYSTÈME' },
        { to: '/admin/diagnostic', icon: Activity, label: 'Diagnostic Santé', permission: PERMISSIONS.VOIR_DIAGNOSTIC, category: 'SYSTÈME' },
        { 
            to: '/admin/kobo-terminal', 
            icon: Terminal, 
            label: 'Terminal Kobo', 
            permission: PERMISSIONS.ACCES_TERMINAL_KOBO,
            visible: user?.organizationConfig?.features?.koboTerminal === true,
            category: 'SYSTÈME' 
        },
        { to: '/admin/organization', icon: Building2, label: 'Organisation', permission: PERMISSIONS.GERER_PARAMETRES, category: 'SYSTÈME' },
        { to: '/settings', icon: Settings, label: 'Paramètres', permission: PERMISSIONS.GERER_PARAMETRES, category: 'SYSTÈME' },
        { to: '/admin/security', icon: ShieldCheck, label: 'Sécurité', permission: PERMISSIONS.GERER_PARAMETRES, category: 'SYSTÈME' },
        { to: '/aide', icon: HelpCircle, label: 'Centre d\'Aide', category: 'SYSTÈME' },
    ];

    const isMaster = user?.email?.toLowerCase() === 'admingem' || user?.role === 'ADMIN_PROQUELEC';

    // 🛡️ [RESILIENCE] If auth is loading, avoid empty black box
    if (!user) {
        return (
            <div className="hidden lg:flex w-72 flex-col h-screen fixed left-0 bg-slate-950 border-r border-white/5 items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const groupedItems = navItems.reduce((acc, item) => {
        // L'Administrateur voit TOUT par défaut (sauf si explicitement invisible)
        if (item.visible === false) return acc;

        const canSee = isMaster || !item.permission || peut(item.permission);

        if (canSee) {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
        }
        return acc;
    }, {} as Record<string, NavItem[]>);

    const categoryConfig = {
        PILOTAGE: { color: 'blue', label: 'STRATÉGIE', glow: 'shadow-blue-500/10' },
        OPÉRATIONS: { color: 'blue', label: 'OPÉRATIONS TERRAIN', glow: 'shadow-blue-500/10' },
        SYSTÈME: { color: 'blue', label: 'ADMINISTRATION', glow: 'shadow-blue-500/10' }
    };

    const RoleLabel = () => {
        if (!user) return null;
        const labels: Record<string, string> = {
            ADMIN_PROQUELEC: 'Admin',
            DG_PROQUELEC: 'DG',
            CLIENT_LSE: 'LSE',
            CHEF_EQUIPE: 'Chef',
            CHEF_PROJET: 'CP',
            COMPTABLE: 'Comptable',
            DIRECTEUR: 'DG',
        };
        const label = labels[user.role] || user.role;
        return (
            <div className="space-y-4">
                <div className="p-4 rounded-3xl flex flex-col gap-3 border border-white/10 bg-white/5 shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-electric-sm bg-electric-gradient">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black truncate tracking-tight text-white">{user.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="relative flex">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50" />
                                    <span className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-[0.15em] opacity-80 text-blue-200">{label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 rounded-3xl border border-white/5 bg-white/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-300/50 uppercase tracking-widest">Connectivité</span>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-black tracking-widest flex items-center gap-1.5 ${navigator.onLine ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                            {navigator.onLine ? (
                                <>
                                    <Activity size={8} className="animate-pulse" />
                                    EN LIGNE
                                </>
                            ) : 'HORS LIGNE'}
                        </div>
                    </div>

                    <button
                        onClick={() => forceSync()}
                        disabled={isSyncing || !navigator.onLine}
                        className={`w-full group relative overflow-hidden p-3 rounded-2xl transition-all ${isSyncing ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl transition-all ${isSyncing ? 'bg-white/20 text-white animate-spin' : 'bg-primary/10 text-primary-light'}`}>
                                <RefreshCw size={14} strokeWidth={3} />
                            </div>
                            <div className="text-left">
                                <p className={`text-xs font-black leading-tight ${isSyncing ? 'text-white' : 'text-blue-100'}`}>
                                    {isSyncing ? 'Synchronisation...' : 'À Jour'}
                                </p>
                                <span className={`text-xs ${isSyncing ? 'text-blue-100' : 'text-blue-300/60'} font-bold`}>Faisceau Cloud GEM</span>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile Toggle */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden fixed top-6 right-6 z-[60] w-12 h-12 bg-electric-gradient rounded-2xl flex items-center justify-center text-white shadow-electric transition-transform active:scale-95"
            >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <AnimatePresence>
                {(mobileOpen || true) && (
                    <motion.aside
                        initial={false}
                        animate={{ 
                            x: mobileOpen ? 0 : (window.innerWidth < 1024 ? -320 : 0),
                            opacity: 1
                        }}
                        className={`fixed lg:static inset-y-0 left-0 w-80 bg-slate-950 flex flex-col z-50 border-r border-white/5 shadow-2xl transition-all duration-500`}
                    >
                        {/* Simulation Bar (God Mode) */}
                        {user?.impersonatedBy && (
                            <div className="mx-6 mb-4 p-4 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center animate-pulse">
                                            <Eye size={14} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest leading-none">Simulation Active</p>
                                            <p className="text-xs font-black text-white mt-1">Vue comme : {user.name}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => stopImpersonation()}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all active:scale-90"
                                        title="Redevenir Admin"
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Logo Area */}
                        <div className="p-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-electric-gradient flex items-center justify-center shadow-electric-sm p-1">
                                    {user?.organizationConfig?.branding?.logo ? (
                                        <img src={user.organizationConfig.branding.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : <BarChart3 className="text-white" size={24} />}
                                </div>
                                <div>
                                    <h1 className="text-xl font-black tracking-tighter text-white italic leading-none">
                                        {user?.organizationConfig?.branding?.organizationName || "GEM SAAS"}
                                    </h1>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80">Wanekoo Core</span>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Scroll Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-10 no-scrollbar">
                            {Object.entries(groupedItems).map(([cat, items]) => (
                                <div key={cat} className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className={`w-1 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50`} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                            {categoryConfig[cat as keyof typeof categoryConfig]?.label || cat}
                                        </span>
                                    </div>
                                    <nav className="space-y-1">
                                        {items.map((item) => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                onClick={() => setMobileOpen(false)}
                                                className={({ isActive }) => `
                                                    group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden
                                                    ${isActive 
                                                        ? 'bg-white/5 text-white shadow-inner' 
                                                        : 'text-slate-500 hover:text-white hover:bg-white/5'}
                                                `}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        {isActive && (
                                                            <motion.div 
                                                                layoutId="nav-active"
                                                                className="absolute inset-0 bg-blue-600/5 backdrop-blur-sm border border-white/5"
                                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                            />
                                                        )}
                                                        <item.icon size={18} className={`relative z-10 transition-transform duration-500 group-hover:scale-110 ${isActive ? 'text-blue-500' : 'text-slate-600'}`} />
                                                        <span className={`relative z-10 text-xs font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                                            {item.label}
                                                        </span>
                                                        {isActive && <div className="absolute right-4 w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px] shadow-blue-500" />}
                                                    </>
                                                )}
                                            </NavLink>
                                        ))}
                                    </nav>
                                </div>
                            ))}
                        </div>

                        {/* Footer Context */}
                        <div className="p-6 mt-auto">
                            <RoleLabel />
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-between mt-6 px-6 py-4 rounded-2xl bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 border border-white/5 transition-all group"
                            >
                                <span className="text-xs font-black uppercase tracking-widest">Se Déconnecter</span>
                                <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

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
