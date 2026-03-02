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
    X,
    Zap
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
        { to: '/terrain', icon: MapIcon, label: 'Terrain', allowedRoles: ['ADMIN_PROQUELEC', 'CHEF_EQUIPE', 'CLIENT_LSE'] },
        { to: '/cahier', icon: FileText, label: 'Cahier de Charge', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/logistique', icon: Users, label: 'Logistique', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/finances', icon: DollarSign, label: 'Finances', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/simulation', icon: Calculator, label: 'Simulation', allowedRoles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'] },
        { to: '/rapports', icon: BarChart3, label: 'Rapports' },
        { to: '/settings', icon: Settings, label: 'Paramètres', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/admin/users', icon: Users, label: 'Utilisateurs', allowedRoles: ['ADMIN_PROQUELEC'] },
        { to: '/aide', icon: HelpCircle, label: 'Aide' },
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
            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[var(--radius-md)] text-xs font-medium ${isDarkMode ? 'bg-dark-elevated text-dark-text-secondary' : 'bg-surface-alt text-text-secondary'}`}>
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="truncate">{user.name}</span>
                <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold gradient-primary text-white`}>
                    {label}
                </span>
            </div>
        );
    };

    const NavContent = () => (
        <>
            {/* Logo + brand */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 overflow-hidden gradient-primary shadow-[var(--shadow-glow)]">
                        <img
                            src="/logo-proquelec.png"
                            alt="PROQUELEC"
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement!;
                                fb.innerHTML = '<span class="text-white text-xs font-bold">PR</span>';
                            }}
                        />
                    </div>
                    <div className="overflow-hidden">
                        <div className={`text-base font-bold tracking-tight leading-none ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>PROQUELEC</div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-primary mt-0.5">GEM Platform</div>
                    </div>
                </div>
                <RoleLabel />
            </div>

            {/* Nav links */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
                {visibleNavItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `
                            w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] transition-all duration-200 text-[13px] font-medium
                            ${isActive
                                ? 'gradient-primary text-white shadow-[var(--shadow-glow)]'
                                : isDarkMode
                                    ? 'text-dark-text-muted hover:bg-dark-elevated hover:text-dark-text'
                                    : 'text-text-muted hover:bg-surface-alt hover:text-text'}
                        `}
                    >
                        <item.icon size={18} strokeWidth={1.75} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Bottom controls */}
            <div className="mt-auto pt-6 space-y-2 border-t border-border-subtle">
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] transition-all text-[13px] font-medium ${isDarkMode 
                        ? 'text-accent-warm hover:bg-dark-elevated' 
                        : 'text-primary hover:bg-surface-alt'}`}
                >
                    {isDarkMode ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
                    <span>Mode {isDarkMode ? 'Clair' : 'Sombre'}</span>
                </button>
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] transition-all text-[13px] font-medium ${isDarkMode 
                        ? 'text-dark-text-muted hover:text-danger hover:bg-danger/10' 
                        : 'text-text-muted hover:text-danger hover:bg-danger/5'}`}
                >
                    <LogOut size={18} strokeWidth={1.75} />
                    <span>Déconnexion</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* ── Mobile topbar ── */}
            <div className={`md:hidden flex items-center justify-between px-5 py-3.5 border-b z-30 sticky top-0 backdrop-blur-xl ${isDarkMode ? 'bg-dark-bg/90 border-dark-border' : 'bg-surface-elevated/90 border-border-subtle'}`}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center overflow-hidden gradient-primary">
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
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>PROQUELEC</span>
                </div>
                <button
                    onClick={() => setMobileOpen(o => !o)}
                    className={`p-2 rounded-[var(--radius-md)] transition-all ${isDarkMode ? 'text-dark-text-muted hover:bg-dark-elevated' : 'text-text-muted hover:bg-surface-alt'}`}
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
                            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={`md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col p-6 ${isDarkMode ? 'bg-dark-bg border-r border-dark-border' : 'bg-surface-elevated border-r border-border-subtle shadow-elevated'}`}
                        >
                            <NavContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Desktop sidebar ── */}
            <aside className={`hidden md:flex md:w-[260px] border-r p-5 flex-col shrink-0 transition-all duration-300 ${isDarkMode ? 'bg-dark-bg border-dark-border' : 'bg-surface-elevated border-border-subtle'}`}>
                <NavContent />
            </aside>
        </>
    );
}
