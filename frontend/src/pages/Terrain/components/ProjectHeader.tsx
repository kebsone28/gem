import React from 'react';
import { MapPin, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import type { Project } from '../../../utils/types';
import { useOfflineStore } from '../../../store/offlineStore';

interface ProjectHeaderProps {
  project: Project | null;
  onSync: () => void;
  isSyncing: boolean;
  showSync: boolean;
  toggleToolbar: () => void;
}

/** Returns color class based on latency */
function getRttColor(rtt: number | null, isOnline: boolean): string {
  if (!isOnline) return 'text-slate-500';
  if (rtt === null) return 'text-red-400';
  if (rtt < 300) return 'text-emerald-400';
  if (rtt < 800) return 'text-amber-400';
  return 'text-red-400';
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  onSync,
  isSyncing,
  showSync,
  toggleToolbar,
}) => {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const rtt = useOfflineStore((s) => s.rtt);
  const isQualityDegraded = useOfflineStore((s) => s.isQualityDegraded);
  const rttColor = getRttColor(rtt, isOnline);

  return (
    <div className="flex items-center justify-between mb-2 px-1 gap-2">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 text-blue-400">
          <MapPin size={14} className="md:w-4 md:h-4" />
        </div>

        <div className="min-w-0">
          <h3 className="text-[10px] md:text-[11px] font-black uppercase text-white truncate">
            Pilotage
          </h3>
          <p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase mt-0.5 tracking-[0.12em] md:tracking-widest animate-pulse truncate max-w-[58vw] sm:max-w-[260px] md:max-w-none">
            {project?.name || 'Sans Projet'}
          </p>
        </div>
      </div>

      {/* ── Network Quality Badge ── */}
      <div
        title={
          !isOnline
            ? 'Hors ligne'
            : isQualityDegraded
              ? `Connexion dégradée — Circuit Breaker actif (RTT: ${rtt ?? '?'}ms)`
              : `Connexion OK (RTT: ${rtt ?? '?'}ms)`
        }
        className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
          !isOnline
            ? 'border-slate-700 bg-slate-800/50 text-slate-500'
            : isQualityDegraded
              ? 'border-red-500/40 bg-red-500/10 text-red-400 animate-pulse'
              : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
        }`}
      >
        {!isOnline ? (
          <><WifiOff size={9} /> Offline</>
        ) : isQualityDegraded ? (
          <><Wifi size={9} /> CB ⚡</>
        ) : (
          <><Wifi size={9} className={rttColor} />{rtt !== null ? `${rtt}ms` : '...'}</>
        )}
      </div>

      <div className="md:hidden flex shrink-0 items-center gap-1.5">
        {showSync && (
          <button
            title="Synchroniser"
            onClick={onSync}
            disabled={isSyncing}
            className="p-2 bg-white/5 rounded-xl border border-white/5 text-blue-400 active:scale-95 transition-transform"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        )}

        <button
          title="Masquer l'en-tête"
          onClick={toggleToolbar}
          className="p-2 rounded-xl bg-[#0D1E35]/80 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ProjectHeader);
