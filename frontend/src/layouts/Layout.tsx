import React from 'react';
import Sidebar from '../components/Sidebar';
import SyncAlertBanner from '../components/SyncAlertBanner';
import { useWebSockets } from '../hooks/useWebSockets';
import CommandPalette from '../components/CommandPalette';

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

    return (
        /**
         * Wrapper racine : h-screen + overflow-hidden pour empêcher le double
         * scrollbar. Le scroll se passe uniquement dans la zone <main>.
         * Design unifié Wanekoo (Deep Navy).
         */
        <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#011e3c] text-[#E8F0FF]">
            {/* Palette de commande – overlay plein écran, toujours montée */}
            <CommandPalette />

            {/* Sidebar de navigation – Solid Wanekoo Navy */}
            <Sidebar />

            {/* Zone de contenu principale */}
            <main
                className="flex-1 min-w-0 overflow-hidden relative flex flex-col bg-[#011e3c]"
                role="main"
            >
                {/* Bannière de synchronisation (position sticky au top) */}
                <SyncAlertBanner />

                {/* Zone scrollable des pages */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#011e3c]">
                    {children}
                </div>
            </main>
        </div>
    );
}
