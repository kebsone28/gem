
import React from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Clock, 
  Activity, 
  Users, 
  Zap, 
  CheckCircle2, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { fmtNum } from '@utils/format';
import type { DashboardMetrics, MissionStats } from '../types';

interface UnifiedStatsTableProps {
  metrics: DashboardMetrics;
  missionStats: MissionStats | null;
  householdLabel: string;
}

export const UnifiedStatsTable: React.FC<UnifiedStatsTableProps> = ({
  metrics,
  missionStats,
  householdLabel,
}) => {
  
  const calculateRate = (value: number) => {
    if (!metrics.totalHouseholds) return 0;
    return Math.round((value / metrics.totalHouseholds) * 100);
  };

  const rows = [
    { group: 'STRATÉGIQUE', label: `Total ${householdLabel}`, value: fmtNum(metrics.totalHouseholds), sub: `${metrics.progressPercent}% Progression`, icon: Users, color: 'text-blue-400', status: 'Normal' },
    { group: 'STRATÉGIQUE', label: 'Indemnités Total', value: missionStats ? fmtNum(missionStats.totalIndemnities) : '0', sub: 'FCFA', icon: Zap, color: 'text-amber-400', status: 'Financier' },
    { group: 'STRATÉGIQUE', label: 'Missions Certifiées', value: missionStats ? missionStats.totalCertified.toString() : '0', sub: 'Validées terrain', icon: CheckCircle2, color: 'text-emerald-400', status: 'Succès' },
    { group: 'CONFORMITÉ', label: 'Conformité (Qualité)', value: metrics.conforme, sub: `${calculateRate(metrics.conforme)}% Taux`, icon: ShieldCheck, color: 'text-emerald-500', status: 'Conforme' },
    { group: 'CONFORMITÉ', label: 'Anomalies Terrain', value: metrics.nonConforme, sub: `${calculateRate(metrics.nonConforme)}% Écarts`, icon: AlertTriangle, color: 'text-rose-500', status: metrics.nonConforme > 5 ? 'Critique' : 'Attention' },
    { group: 'CONFORMITÉ', label: 'Incident HSE', value: metrics.incidentsHSE, sub: 'Sécurité terrain', icon: AlertCircle, color: 'text-rose-600', status: metrics.incidentsHSE > 0 ? 'DANGER' : 'Sécurisé' },
    { group: 'OPÉRATIONNEL', label: 'PV Générés', value: metrics.totalPV, sub: 'Docs produits', icon: FileText, color: 'text-sky-400', status: 'Normal' },
    { group: 'OPÉRATIONNEL', label: 'PV en Retard', value: metrics.pvRetard, sub: 'Action requise', icon: Clock, color: 'text-orange-500', status: metrics.pvRetard > 0 ? 'RETARD' : 'À jour' },
    { group: 'OPÉRATIONNEL', label: 'Actions Attente', value: metrics.actionRequired, sub: 'Arbitrage DG', icon: Activity, color: 'text-purple-400', status: metrics.actionRequired > 0 ? 'Urgent' : 'Libre' },
  ];

  return (
    <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl shadow-2xl font-sans">
      <div className="bg-white/[0.03] px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-[12px] sm:text-sm font-bold tracking-tight text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400 shrink-0" /> 
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent truncate">Tableau de Bord Stratégique</span>
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-slate-500">Live</span>
        </div>
      </div>
      
      {/* --- VUE TABLEAU (Desktop & Tablette) --- */}
      <div className="hidden sm:block overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-full">
          <thead>
            <tr className="bg-white/[0.01] border-b border-white/5">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/70 w-[40px]">Ref</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/70">Indicateur</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/70">Valeur</th>
              <th className="hidden md:table-cell px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/70">Analyse</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/70 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.03] transition-all group border-b border-white/[0.02]">
                <td className="px-6 py-4">
                  <div className={`p-2 rounded-xl bg-white/5 flex items-center justify-center w-10 h-10 ${row.color} shadow-inner group-hover:scale-105 transition-transform`}>
                    <row.icon size={20} />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-[9px] font-bold text-blue-400/60 uppercase tracking-[0.15em] mb-1">{row.group}</div>
                  <div className="text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors">{row.label}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xl font-medium text-white tabular-nums tracking-tight">{row.value}</div>
                </td>
                <td className="hidden md:table-cell px-6 py-4">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">{row.sub}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-tight border shadow-sm ${
                    row.status === 'Critique' || row.status === 'RETARD' || row.status === 'DANGER'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : row.status === 'Succès' || row.status === 'Conforme' || row.status === 'À jour'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- VUE LISTE CONDENSÉE (Mobile Ultra-Petit) --- */}
      <div className="sm:hidden divide-y divide-white/[0.03]">
        {rows.map((row, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02] active:bg-white/[0.05] transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg bg-white/5 ${row.color} shrink-0`}>
                <row.icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-200 truncate">{row.label}</div>
                <div className="text-[9px] text-slate-500 font-medium">{row.sub}</div>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <div className="text-[15px] font-bold text-white tabular-nums tracking-tight">{row.value}</div>
              <span className={`mt-0.5 px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${
                row.status === 'Critique' || row.status === 'RETARD' || row.status === 'DANGER'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : row.status === 'Succès' || row.status === 'Conforme' || row.status === 'À jour'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
