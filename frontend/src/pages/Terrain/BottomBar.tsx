/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Wifi } from 'lucide-react';
import GisHealthWidget from '../../components/terrain/GisHealthWidget';

interface BottomBarProps {
  filteredCount: number;
  totalCount?: number; // Total in DB (may differ from viewport)
  isOfflineMode: boolean;
  auditResult: any;
  pendingSyncCount?: number;
  pendingHouseholdsCount?: number;
  errorHouseholdsCount?: number;
  hasSyncError?: boolean;
  lastSyncAt?: number | null;
  onFlyTo: (lng: number, lat: number) => void;
}

const BottomBar: React.FC<BottomBarProps> = ({
  filteredCount,
  totalCount,
  isOfflineMode,
  auditResult,
  pendingSyncCount = 0,
  pendingHouseholdsCount = 0,
  errorHouseholdsCount = 0,
  hasSyncError = false,
  lastSyncAt = null,
  onFlyTo,
}) => {
  // If viewport loading is active, filteredCount < totalCount
  const isViewportFiltered = totalCount !== undefined && filteredCount < totalCount;
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : 'Jamais';

  return (
    <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-10 flex w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] -translate-x-1/2 items-center justify-center gap-2 pointer-events-none px-0 md:bottom-6 md:w-auto md:max-w-[calc(100%-2rem)] md:gap-4">
      <div className="hidden pointer-events-auto md:block">
        <div className="flex items-center gap-4 bg-[#050F1F] border border-white/10 p-2 rounded-2xl shadow-2xl">
          <GisHealthWidget result={auditResult} isDarkMode onFlyTo={onFlyTo} />
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-3 p-2 rounded-full bg-[#050F1F] border border-white/10 shadow-xl">
          {/* Viewport count */}
          <span className="text-[10px] font-black px-3 py-1 text-blue-100 bg-blue-500/20 rounded-full tracking-widest uppercase">
            {filteredCount.toLocaleString()}{' '}
            {isViewportFiltered ? 'DANS VIEWPORT' : 'POINTS VISIBLES'}
          </span>

          {/* Total in DB — only shown when viewport loading is active */}
          {isViewportFiltered && totalCount !== undefined && (
            <span className="text-[10px] font-black px-3 py-1 text-slate-400 bg-slate-500/10 rounded-full tracking-widest uppercase border border-slate-700/40">
              {totalCount.toLocaleString()} TOTAL
            </span>
          )}

          <div
            className={`flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
              isOfflineMode ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'
            }`}
          >
            <Wifi size={10} />
            {isOfflineMode ? 'Hors-Ligne' : 'Connecté'}
          </div>

          {(pendingSyncCount > 0 || pendingHouseholdsCount > 0 || errorHouseholdsCount > 0) && (
            <span
              className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase border ${
                hasSyncError || errorHouseholdsCount > 0
                  ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                  : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
              }`}
            >
              {errorHouseholdsCount > 0
                ? `${errorHouseholdsCount} erreur(s)`
                : `${pendingSyncCount || pendingHouseholdsCount} en attente`}
            </span>
          )}

          <span className="text-[10px] font-black px-3 py-1 text-cyan-200 bg-cyan-500/10 rounded-full tracking-widest uppercase border border-cyan-500/10">
            Sync {lastSyncLabel}
          </span>

          {/* 🏷️ Deployment Marker (to verify update success on VPS) */}
          <span className="hidden sm:block text-[8px] font-black text-white/20 tracking-tighter pr-1">
            v2.1
          </span>
        </div>
      </div>

      <div className="md:hidden pointer-events-auto w-full">
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#050F1F]/95 p-2 shadow-xl scrollbar-hide">
          <span className="shrink-0 text-[10px] font-black px-3 py-1 text-blue-100 bg-blue-500/20 rounded-full tracking-[0.12em] uppercase">
            {filteredCount.toLocaleString()} {isViewportFiltered ? 'viewport' : 'visibles'}
          </span>

          <div
            className={`flex shrink-0 items-center gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] rounded-full ${
              isOfflineMode ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'
            }`}
          >
            <Wifi size={10} />
            {isOfflineMode ? 'Hors-ligne' : 'Connecté'}
          </div>

          {(pendingSyncCount > 0 || pendingHouseholdsCount > 0 || errorHouseholdsCount > 0) && (
            <span
              className={`shrink-0 text-[10px] font-black px-3 py-1 rounded-full tracking-[0.12em] uppercase ${
                hasSyncError || errorHouseholdsCount > 0
                  ? 'text-rose-300 bg-rose-500/10'
                  : 'text-amber-300 bg-amber-500/10'
              }`}
            >
              {errorHouseholdsCount > 0
                ? `${errorHouseholdsCount} erreur(s)`
                : `${pendingSyncCount || pendingHouseholdsCount} attente`}
            </span>
          )}

          <span className="shrink-0 text-[10px] font-black px-3 py-1 text-cyan-200 bg-cyan-500/10 rounded-full tracking-[0.12em] uppercase border border-cyan-500/10">
            Sync {lastSyncLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BottomBar);
