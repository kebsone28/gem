import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Folder,
  ClipboardList,
  FileText,
  Activity,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/executive/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projets', icon: Folder },
  { to: '/admin/mission', label: 'Missions', icon: ClipboardList },
  { to: '/documents/specifications', label: 'Cahier', icon: FileText },
  { to: '/operations/collect', label: 'Collect', icon: Activity },
];

/**
 * BottomNav – Barre de navigation fixe en bas de l'écran (mobile uniquement).
 *
 * Apparaît via `md:hidden` et propose les 5 entrées principales.
 * L'item actif est surligné en fonction du pathname courant.
 */
export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#0a1228]/95 backdrop-blur-xl md:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = location.pathname === to ||
          (to !== '/projects' && location.pathname.startsWith(to));

        return (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-150"
          >
            <Icon
              size={20}
              className={
                isActive
                  ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]'
                  : 'text-slate-400'
              }
            />
            <span
              className={`text-[10px] font-medium leading-tight ${
                isActive ? 'text-blue-300' : 'text-slate-500'
              }`}
            >
              {label}
            </span>
            {isActive && (
              <span className="mt-0.5 h-1 w-6 rounded-full bg-blue-500/70 shadow-[0_0_6px_rgba(96,165,250,0.6)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
