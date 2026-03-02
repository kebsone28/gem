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
    Menu,
    X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
    const { isDarkMode, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    type NavItem = { to: string; icon: any; label: string; allowedRoles?: UserRole[] };

    const navItems: NavItem[] = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de Bord' },
        { to: '/terrain', icon: MapIcon, label: 'Terrain (Carte)', allowedRoles: ['ADMIN_PROQUELEC', 'CHEF_EQUIPE', 'CLIENT_LSE'] },
        { to: '/cahier', icon: FileText, label: 'Cahier de Charge', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/logistique', icon: Users, label: 'Logistique', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/finances', icon: DollarSign, label: 'Finances', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/simulation', icon: Calculator, label: 'Simulation', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/rapports', icon: BarChart3, label: 'Rapports' },
        { to: '/settings', icon: Settings, label: 'Paramètres', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/admin/users', icon: Users, label: 'Utilisateurs', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/aide', icon: HelpCircle, label: 'Aide & Aperçu' },
    ];

    const visibleNavItems = navItems.filter(item => !item.allowedRoles || (user && item.allowedRoles.includes(user.role)));

    const RoleLabel = () => {
        if (!user) return null;
        const label = {
            ADMIN_PROQUELEC: 'Admin',
            DG_PROQUELEC: 'DG',
            CLIENT_LSE: 'LSE',
            CHEF_EQUIPE: 'Chef',
        }[user.role] ?? user.role;
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="truncate">{user.name}</span>
                <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                    {label}
                </span>
            </div>
        );
    };

    const NavContent = () => (
        <>
            {/* Logo + brand */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                        <img
                            src="/logo-proquelec.png"
                            alt="PROQUELEC"
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement!;
                                fb.innerHTML = '<span class="text-white text-xs font-black">PR</span>';
                            }}
                        />
                    </div>
                    <div className="overflow-hidden">
                        <div className={`text-base font-black tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>PROQUELEC</div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`}>GEM SaaS v2</div>
                    </div>
                </div>
                <RoleLabel />
            </div>

            {/* Nav links */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto">
                {visibleNavItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `
                            w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-[13px] font-bold
                            ${isActive
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : isDarkMode
                                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}
                        `}
                    >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Bottom controls */}
            <div className="mt-auto pt-4 space-y-2">
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-[13px] font-bold ${isDarkMode ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>Mode {isDarkMode ? 'Clair' : 'Sombre'}</span>
                </button>
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-[13px] font-bold ${isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                >
                    <LogOut size={18} />
                    <span>Déconnexion</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* ── Mobile topbar ─────────────────────────────────── */}
            <div className={`md:hidden flex items-center justify-between px-5 py-4 border-b z-30 sticky top-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                        <img
                            src="/logo-proquelec.png"
                            alt="PR"
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<span class="text-white text-[10px] font-black">PR</span>';
                            }}
                        />
                    </div>
                    <span className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>PROQUELEC</span>
                </div>
                <button
                    onClick={() => setMobileOpen(o => !o)}
                    className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Menu"
                >
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {/* ── Mobile drawer ─────────────────────────────────── */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={`md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col p-6 ${isDarkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200 shadow-2xl'}`}
                        >
                            <NavContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Desktop sidebar ──────────────────────────────── */}
            <aside className={`hidden md:flex md:w-64 border-r p-6 flex-col shrink-0 transition-all duration-500 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'}`}>
                <NavContent />
            </aside>
        </>
    );
}
