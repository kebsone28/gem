import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Map as MapIcon,
    FileText,
    Users,
    Settings,
    LogOut,
    DollarSign,
    Calculator,
    BarChart3,
    Sun,
    Moon,
    HelpCircle,
    ShieldCheck,
    Menu,
    X,
    RefreshCw,
    Activity,
    ClipboardList,
    MonitorCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
    const { isDarkMode, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const { sync, isSyncing } = useSync();
    const { peut, PERMISSIONS } = usePermissions();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    type NavItem = { to: string; icon: any; label: string; permission?: string; category: 'PILOTAGE' | 'OPÉRATIONS' | 'GESTION' | 'SYSTÈME' };

    const navItems: NavItem[] = [
        // PILOTAGE
        { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de Bord', category: 'PILOTAGE' },
        { to: '/rapports', icon: BarChart3, label: 'Rapports', permission: PERMISSIONS.VOIR_RAPPORTS, category: 'PILOTAGE' },
        { to: '/simulation', icon: Calculator, label: 'Simulation', permission: PERMISSIONS.VOIR_SIMULATION, category: 'PILOTAGE' },

        // OPÉRATIONS
        { to: '/terrain', icon: MapIcon, label: 'Terrain', permission: PERMISSIONS.VOIR_CARTE, category: 'OPÉRATIONS' },
        { to: '/admin/mission', icon: ClipboardList, label: 'Missions OM', category: 'OPÉRATIONS' },
        { to: '/bordereau', icon: Users, label: 'Bordereau', permission: PERMISSIONS.GERER_LOGISTIQUE, category: 'OPÉRATIONS' },
        { to: '/cahier', icon: FileText, label: 'Cahier de Charge', permission: PERMISSIONS.VOIR_RAPPORTS, category: 'OPÉRATIONS' },
        { to: '/admin/kobo-terminal', icon: MonitorCheck, label: 'Saisie Kobo', permission: PERMISSIONS.ACCES_TERMINAL_KOBO, category: 'OPÉRATIONS' },

        // GESTION
        { to: '/logistique', icon: Users, label: 'Logistique', permission: PERMISSIONS.GERER_LOGISTIQUE, category: 'GESTION' },
        { to: '/finances', icon: DollarSign, label: 'Finances', permission: PERMISSIONS.VOIR_FINANCES, category: 'GESTION' },

        // SYSTÈME
        { to: '/settings', icon: Settings, label: 'Paramètres', permission: PERMISSIONS.GERER_PARAMETRES, category: 'SYSTÈME' },
        { to: '/admin/users', icon: Users, label: 'Utilisateurs', permission: PERMISSIONS.GERER_UTILISATEURS, category: 'SYSTÈME' },
        { to: '/admin/security', icon: ShieldCheck, label: 'Sécurité', permission: PERMISSIONS.GERER_PARAMETRES, category: 'SYSTÈME' },
        { to: '/admin/diagnostic', icon: Activity, label: 'Diagnostic', permission: PERMISSIONS.VOIR_DIAGNOSTIC, category: 'SYSTÈME' },
        { to: '/aide', icon: HelpCircle, label: 'Aide', category: 'SYSTÈME' },
    ];

    const groupedItems = navItems.reduce((acc, item) => {
        if (!item.permission || peut(item.permission)) {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
        }
        return acc;
    }, {} as Record<string, NavItem[]>);

    const categoryConfig = {
        PILOTAGE: { color: 'indigo', label: 'PILOTAGE & STRATÉGIE', glow: 'shadow-indigo-500/20' },
        OPÉRATIONS: { color: 'emerald', label: 'OPÉRATIONS TERRAIN', glow: 'shadow-emerald-500/20' },
        GESTION: { color: 'amber', label: 'GESTION & LOGISTIQUE', glow: 'shadow-amber-500/20' },
        SYSTÈME: { color: 'slate', label: 'SYSTÈME & CONFIG', glow: 'shadow-slate-500/20' }
    };

    const RoleLabel = () => {
        if (!user) return null;
        const label = {
            ADMIN_PROQUELEC: 'Admin',
            DG_PROQUELEC: 'DG',
            CLIENT_LSE: 'LSE',
            CHEF_EQUIPE: 'Chef',
        }[user.role] ?? user.role;
        return (
            <div className="space-y-4">
                <div className={`p-4 rounded-3xl flex flex-col gap-3 border transition-all glass-premium ${isDarkMode ? 'border-indigo-500/20 shadow-indigo-500/10' : 'border-indigo-200 shadow-indigo-200/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-[13px] font-black truncate tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="relative flex">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50" />
                                    <span className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-[0.15em] opacity-80 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sync Indicator (Detailed Tech Look) */}
                <div className={`p-5 rounded-3xl border flex flex-col gap-3 transition-all ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connectivité</span>
                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest flex items-center gap-1.5 ${navigator.onLine ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                            {navigator.onLine ? (
                                <>
                                    <Activity size={8} className="animate-pulse" />
                                    EN LIGNE
                                </>
                            ) : 'HORS LIGNE'}
                        </div>
                    </div>

                    <button
                        onClick={() => sync()}
                        disabled={isSyncing || !navigator.onLine}
                        className={`w-full group relative overflow-hidden p-3 rounded-2xl transition-all ${isSyncing ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' :
                            isDarkMode ? 'bg-slate-900/50 hover:bg-indigo-600/10 border border-slate-800' : 'bg-white hover:bg-slate-100 border border-slate-200 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl transition-all ${isSyncing ? 'bg-white/20 text-white animate-spin' : isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                <RefreshCw size={14} strokeWidth={3} />
                            </div>
                            <div className="text-left">
                                <p className={`text-[11px] font-black leading-tight ${isSyncing ? 'text-white' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {isSyncing ? 'Synchronisation...' : 'À Jour'}
                                </p>
                                <span className={`text-[9px] ${isSyncing ? 'text-indigo-100' : 'text-slate-500'} font-bold`}>Faisceau Cloud GEM</span>
                            </div>
                        </div>
                        {!isSyncing && (
                            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-4 h-4 bg-indigo-500 blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                        )}
                    </button>
                </div>
            </div>
        );
    };

    const NavContent = () => (
        <div className="flex flex-col h-full bg-inherit overflow-hidden">
            {/* Logo area */}
            <div className="mb-10 px-2 shrink-0">
                <div className="flex items-center gap-4 relative group cursor-default">
                    <div className="w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-1 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                        <img
                            src="/logo-proquelec.png"
                            alt="PROQUELEC"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement!;
                                fb.innerHTML = '<span class="text-indigo-600 text-lg font-black italic">PQ</span>';
                            }}
                        />
                    </div>
                    <div>
                        <div className={`text-2xl font-black tracking-tighter italic leading-none bg-gradient-to-r ${isDarkMode ? 'from-white to-slate-400' : 'from-slate-900 to-indigo-600'} bg-clip-text text-transparent`}>
                            PROQUELEC
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/80 mt-1.5">
                            PLATEFORME GEM
                        </div>
                    </div>
                    {/* Brand glow */}
                    <div className="absolute -inset-4 bg-indigo-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                </div>
                <div className="mt-8">
                    <RoleLabel />
                </div>
            </div>

            {/* Navigation categorized */}
            <nav className="flex-1 overflow-y-auto px-1 custom-scrollbar scroll-smooth space-y-8 pb-10">
                {Object.entries(groupedItems).map(([category, items]) => {
                    const config = categoryConfig[category as keyof typeof categoryConfig];
                    const colorClass = {
                        indigo: 'text-indigo-500 border-indigo-500/20 from-indigo-500/5',
                        emerald: 'text-emerald-500 border-emerald-500/20 from-emerald-500/5',
                        amber: 'text-amber-500 border-amber-500/20 from-amber-500/5',
                        slate: 'text-slate-400 border-slate-500/10 from-slate-500/5'
                    }[config.color as 'indigo' | 'emerald' | 'amber' | 'slate'];

                    const activeIconColor = {
                        indigo: 'bg-indigo-600',
                        emerald: 'bg-emerald-600',
                        amber: 'bg-amber-600',
                        slate: 'bg-slate-700'
                    }[config.color as 'indigo' | 'emerald' | 'amber' | 'slate'];

                    return (
                        <div key={category} className="space-y-3">
                            <div className={`px-4 py-1.5 rounded-xl border-l-[3px] bg-gradient-to-r to-transparent ${colorClass} glass-category-header flex items-center justify-between`}>
                                <span className={`text-[10px] font-black tracking-[0.15em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {config.label}
                                </span>
                                <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-slate-900/10'}`} />
                            </div>

                            <div className="space-y-1.5">
                                {items.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={() => setMobileOpen(false)}
                                        className={({ isActive }) => `
                                            w-full flex items-center gap-4 px-5 py-3 rounded-2xl transition-all duration-300 relative group font-bold
                                            ${isActive
                                                ? `${activeIconColor} text-white shadow-lg ${config.glow} scale-[1.02] z-10`
                                                : isDarkMode
                                                    ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                                        `}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon size={18} className={`transition-all duration-300 ${isActive ? 'text-white' : 'text-inherit opacity-60 group-hover:opacity-100 group-hover:scale-110'}`} />
                                                <span className={`text-[12.5px] tracking-tight ${isActive ? 'font-black' : 'group-hover:translate-x-1'} transition-transform duration-300`}>
                                                    {item.label}
                                                </span>
                                                {isActive && (
                                                    <motion.div
                                                        layoutId={`activeInd-${category}`}
                                                        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom Controls area */}
            <div className={`mt-auto pt-6 space-y-2 border-t px-2 shrink-0 ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl transition-all group ${isDarkMode
                        ? 'text-amber-400 hover:bg-amber-400/10'
                        : 'text-indigo-600 hover:bg-indigo-600/5'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-amber-400/10' : 'bg-indigo-600/5 group-hover:bg-indigo-600/10'}`}>
                        {isDarkMode ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
                    </div>
                    <span className="text-[12px] font-bold">Thème {isDarkMode ? 'Solaire' : 'Lunaire'}</span>
                </button>

                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl transition-all group ${isDarkMode
                        ? 'text-slate-500 hover:text-rose-500 hover:bg-rose-500/10'
                        : 'text-slate-500 hover:text-rose-600 hover:bg-rose-500/5'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-white/5' : 'bg-rose-500/5 group-hover:bg-rose-500/10'}`}>
                        <LogOut size={16} strokeWidth={2.5} />
                    </div>
                    <span className="text-[12px] font-bold">Quitter Gemini</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* ── Mobile topbar ── */}
            <div className={`md:hidden flex items-center justify-between px-5 py-3.5 border-b z-30 sticky top-0 backdrop-blur-xl ${isDarkMode ? 'bg-dark-bg/90 border-dark-border' : 'bg-surface-elevated/90 border-border-subtle'}`}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center overflow-hidden bg-indigo-600">
                        <img
                            src="/logo-proquelec.png"
                            alt="PR"
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<span class="text-white text-[10px] font-bold">PR</span>';
                            }}
                        />
                    </div>
                    <span className={`font-black text-sm tracking-tighter ${isDarkMode ? 'text-dark-text' : 'text-slate-900'}`}>PROQUELEC</span>
                </div>
                <button
                    onClick={() => setMobileOpen(o => !o)}
                    className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-dark-text-muted hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Menu"
                >
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {/* ── Mobile drawer ── */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={`md:hidden fixed top-0 left-0 h-full w-80 z-50 flex flex-col p-6 glass-nav shadow-2xl overflow-hidden`}
                        >
                            <NavContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Desktop sidebar ── */}
            <aside className={`hidden md:flex md:w-[290px] p-6 flex-col shrink-0 transition-all duration-500 relative z-20 glass-nav border-r border-white/5`}>
                <NavContent />
                {/* Visual accent */}
                <div className="absolute top-[20%] right-0 w-[1px] h-[30%] bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent" />
                {/* Background Decor */}
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none rounded-full" />
            </aside>
        </>
    );
}
