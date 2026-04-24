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
  onFlyTo,
}) => {
  // If viewport loading is active, filteredCount < totalCount
  const isViewportFiltered = totalCount !== undefined && filteredCount < totalCount;

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center justify-center gap-3 pointer-events-none px-0 md:bottom-6 md:w-auto md:max-w-[calc(100%-2rem)] md:gap-4">
      <div className="pointer-events-auto">
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

          {/* 🏷️ Deployment Marker (to verify update success on VPS) */}
          <span className="hidden sm:block text-[8px] font-black text-white/20 tracking-tighter pr-1">
            v2.1
          </span>
        </div>
      </div>

      <div className="md:hidden pointer-events-auto w-full">
        <div className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-2xl bg-[#050F1F] border border-white/10 shadow-xl">
          <span className="text-[10px] font-black px-3 py-1 text-blue-100 bg-blue-500/20 rounded-full tracking-widest uppercase">
            {filteredCount.toLocaleString()} {isViewportFiltered ? 'viewport' : 'visibles'}
          </span>

          <div
            className={`flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
              isOfflineMode ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'
            }`}
          >
            <Wifi size={10} />
            {isOfflineMode ? 'Hors-ligne' : 'Connecté'}
          </div>

          {(pendingSyncCount > 0 || pendingHouseholdsCount > 0 || errorHouseholdsCount > 0) && (
            <span
              className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase ${
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
        </div>
      </div>
    </div>
  );
};

export default React.memo(BottomBar);
