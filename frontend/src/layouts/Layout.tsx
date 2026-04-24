 
import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SyncAlertBanner from '../components/SyncAlertBanner';
import { useWebSockets } from '../hooks/useWebSockets';
import { CommandPalette } from '../components/common/CommandPalette';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

/**
 * Layout – Shell principal de l'application GEM SAAS.
 *
 * Structure :
 *   ┌─────────────────────────────────────────┐
 *   │  Sidebar (290px fixe sur desktop)       │
 *   │  ─────────────────────────────────────  │
 *   │  <main>                                 │
 *   │    <SyncAlertBanner>  (position sticky) │
 *   │    <CommandPalette>   (overlay modal)   │
 *   │    <div scroll>                         │
 *   │      {children}                         │
 *   │    </div>                               │
 *   │  </main>                                │
 *   └─────────────────────────────────────────┘
 *
 * Thème : géré via `isDarkMode` de ThemeContext.
 * La classe `.dark` est appliquée sur <html> par ThemeContext/main.tsx.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  useWebSockets();
  useBackgroundSync();
  const location = useLocation();
  const isTerrainImmersive = location.pathname === '/terrain';

  return (
    /**
     * Wrapper racine : h-screen + overflow-hidden pour empêcher le double
     * scrollbar. Le scroll se passe uniquement dans la zone <main>.
     * Design unifié Wanekoo (Deep Navy).
     */
    <div className="flex h-screen flex-col overflow-hidden bg-[linear-gradient(135deg,#020817_0%,#071226_38%,#0a1833_72%,#0d2041_100%)] text-[#E8F0FF] md:flex-row">
      {/* Palette de commande – overlay plein écran, toujours montée */}
      <CommandPalette />

      {/* Sidebar de navigation – Solid Wanekoo Navy */}
      <Sidebar />

      {/* Zone de contenu principale */}
      <main
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#17305f_0%,#0a1630_18%,#060c1c_58%,#030712_100%)]"
        role="main"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(96,165,250,0.08),transparent_18%,transparent_72%,rgba(15,23,42,0.45))]" />
          <div className="absolute left-[-12%] top-[-10%] h-72 w-72 rounded-full bg-blue-500/12 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-10%] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:28px_28px]" />
        </div>

        {!isTerrainImmersive && (
          <div className="relative z-20 px-3 pt-3 sm:px-4 lg:px-6 lg:pt-5">
            <div className="mx-auto max-w-[1800px]">
              <SyncAlertBanner />
            </div>
          </div>
        )}

        {isTerrainImmersive ? (
          <div className="relative z-10 flex-1 overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto">
            <div className="mx-auto min-h-full max-w-[1800px] px-3 pb-4 pt-3 sm:px-4 sm:pb-5 lg:px-6 lg:pb-6">
              <div className="relative min-h-full overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(7,12,25,0.92))] shadow-[0_28px_90px_rgba(2,6,23,0.38)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_70%)]" />
                <div className="relative min-h-full px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
                  {children}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
