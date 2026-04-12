import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Map as MapIcon,
  FileText,
  Users,
  Settings,
  Calculator,
  BarChart3,
  Truck,
  DollarSign,
  Terminal,
  Activity,
  HelpCircle,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../hooks/useSync';
import { usePermissions } from '../hooks/usePermissions';

type CommandItem = {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action: () => void;
  permission?: string;
  keywords: string[];
};

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { forceSync } = useSync();
  const { peut, PERMISSIONS } = usePermissions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    // Navigation Pilotage
    {
      id: 'nav-dash',
      icon: LayoutDashboard,
      title: 'Tableau de Bord',
      subtitle: "Aller à l'accueil",
      action: () => navigate('/dashboard'),
      keywords: ['home', 'accueil', 'dashboard'],
    },
    {
      id: 'nav-finances',
      icon: DollarSign,
      title: 'Finances & Charges',
      permission: PERMISSIONS.VOIR_FINANCES,
      action: () => navigate('/finances'),
      keywords: ['finances', 'argent', 'charges'],
    },
    {
      id: 'nav-rapports',
      icon: BarChart3,
      title: 'Rapports',
      permission: PERMISSIONS.VOIR_RAPPORTS,
      action: () => navigate('/rapports'),
      keywords: ['rapports', 'reports', 'stats'],
    },
    {
      id: 'nav-sim',
      icon: Calculator,
      title: 'Simulation',
      permission: PERMISSIONS.VOIR_SIMULATION,
      action: () => navigate('/simulation'),
      keywords: ['simulation', 'calcul', 'estimate'],
    },

    // Navigation Opérations
    {
      id: 'nav-terrain',
      icon: MapIcon,
      title: 'Carte Interactive (Terrain)',
      permission: PERMISSIONS.VOIR_CARTE,
      action: () => navigate('/terrain'),
      keywords: ['carte', 'map', 'terrain'],
    },
    {
      id: 'nav-log',
      icon: Truck,
      title: 'Logistique',
      permission: PERMISSIONS.GERER_LOGISTIQUE,
      action: () => navigate('/logistique'),
      keywords: ['logistique', 'stock', 'livraisons'],
    },
    {
      id: 'nav-mission',
      icon: FileText,
      title: 'Missions OM',
      action: () => navigate('/admin/mission'),
      keywords: ['missions', 'om', 'ordres'],
    },
    {
      id: 'nav-bordereau',
      icon: Users,
      title: 'Bordereau',
      permission: PERMISSIONS.GERER_LOGISTIQUE,
      action: () => navigate('/bordereau'),
      keywords: ['bordereau', 'equipes', 'zone'],
    },
    {
      id: 'nav-cahier',
      icon: FileText,
      title: 'Cahier de Charge',
      permission: PERMISSIONS.VOIR_RAPPORTS,
      action: () => navigate('/cahier'),
      keywords: ['cahier', 'spec', 'charge'],
    },

    // Administration
    {
      id: 'nav-users',
      icon: Users,
      title: 'Gestion Utilisateurs',
      permission: PERMISSIONS.GERER_UTILISATEURS,
      action: () => navigate('/admin/users'),
      keywords: ['users', 'utilisateurs', 'admin'],
    },
    {
      id: 'nav-diag',
      icon: Activity,
      title: 'Diagnostic Santé',
      permission: PERMISSIONS.VOIR_DIAGNOSTIC,
      action: () => navigate('/admin/diagnostic'),
      keywords: ['diagnostic', 'sante', 'health', 'system'],
    },
    {
      id: 'nav-kobo',
      icon: Terminal,
      title: 'Terminal Kobo',
      permission: PERMISSIONS.ACCES_TERMINAL_KOBO,
      action: () => navigate('/admin/kobo-terminal'),
      keywords: ['kobo', 'terminal', 'formulaire'],
    },
    {
      id: 'nav-settings',
      icon: Settings,
      title: 'Paramètres',
      permission: PERMISSIONS.GERER_PARAMETRES,
      action: () => navigate('/settings'),
      keywords: ['settings', 'parametres', 'config'],
    },

    // Aide
    {
      id: 'nav-aide',
      icon: HelpCircle,
      title: "Centre d'Aide",
      action: () => navigate('/aide'),
      keywords: ['aide', 'help', 'docs', 'manuel'],
    },

    // Actions Rapides
    {
      id: 'action-theme',
      icon: isDarkMode ? Sun : Moon,
      title: 'Changer le thème',
      subtitle: isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre',
      action: toggleTheme,
      keywords: ['theme', 'dark', 'light', 'sombre', 'clair'],
    },
    {
      id: 'action-sync',
      icon: RefreshCw,
      title: 'Synchroniser avec le serveur',
      action: forceSync,
      keywords: ['sync', 'synchronisation', 'refresh', 'actualiser'],
    },
  ];

  const filteredItems = items
    .filter((item) => !item.permission || peut(item.permission))
    .filter((item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });

  useEffect(() => {
    if (selectedIndex >= filteredItems.length && filteredItems.length > 0) {
      setSelectedIndex(filteredItems.length - 1);
    } else if (filteredItems.length === 0) {
      setSelectedIndex(0);
    }
  }, [query, filteredItems.length, selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex justify-center items-start pt-[15vh] bg-slate-900/60 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className={`w-5 h-5 mr-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chercher une page, une commande... (Ex: 'sync')"
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <kbd
            className={`hidden sm:inline-flex px-2 py-1 ml-2 text-xs font-medium rounded border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun résultat trouvé pour "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors text-left ${isSelected ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700') : isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className={`mr-3 p-2 rounded-lg ${isSelected ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600') : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{item.title}</span>
                    {item.subtitle && <span className="text-xs opacity-70">{item.subtitle}</span>}
                  </div>
                  {isSelected && (
                    <kbd
                      className={`ml-auto hidden sm:inline-flex px-2 py-1 text-xs font-medium rounded border ${isDarkMode ? 'bg-indigo-500/30 border-indigo-500/30 text-indigo-300' : 'bg-indigo-200 border-indigo-200 text-indigo-800'}`}
                    >
                      Enter
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
