import React from 'react';
import { RefreshCw, Database, Download, ArrowRight } from 'lucide-react';
import { StatusBadge, ActionBar } from '../../../../components/dashboards/DashboardComponents';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  projectName: string;
  isSyncing: boolean;
  onSync: () => void;
  onExportCompta: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  projectName,
  isSyncing,
  onSync,
  onExportCompta,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <StatusBadge status="info" label="Expert Console V.2" />
          <span className="h-4 w-[1px] bg-white/10" />
          <span className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] font-mono">
            {projectName || 'INITIALISATION...'}
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-[0.8] mb-1 text-white">
          PILOTAGE{' '}
          <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            STRATÉGIQUE
          </span>
        </h1>
      </div>

      <ActionBar>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="h-14 px-6 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-blue-500/30 transition-all flex items-center gap-3 disabled:opacity-30 group"
        >
          <RefreshCw
            size={16}
            className={`${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`}
          />
          {isSyncing ? 'SYNCHRO EN COURS' : 'SYNCHRO CLOUD'}
        </button>
        <button
          onClick={() => navigate('/admin/kobo-mapping')}
          className="h-14 px-6 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white hover:border-blue-500/30 transition-all flex items-center gap-3 active:scale-95 group"
        >
          <Database size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
          MOTEUR KOBO
        </button>
        <button
          onClick={onExportCompta}
          className="h-14 px-6 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-white transition-all flex items-center gap-3 group"
          title="Exporter les missions certifiées en Excel"
        >
          <Download size={16} className="text-emerald-500 group-hover:text-white group-hover:bounce" />
          EXPORTER COMPTA
        </button>
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true } as any));
          }}
          className="h-14 px-8 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-3 italic"
        >
          HUB D'ACTIONS
          <ArrowRight size={16} />
        </button>
      </ActionBar>
    </div>
  );
};
