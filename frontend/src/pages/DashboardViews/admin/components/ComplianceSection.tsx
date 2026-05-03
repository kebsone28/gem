import React from 'react';
import { ShieldCheck, AlertCircle, FileText, Clock, Activity, PlugZap, Home, ClipboardList } from 'lucide-react';
import { KPICard } from '../../../../components/dashboards/DashboardComponents';
import type { DashboardMetrics } from '../types';

interface ComplianceSectionProps {
  metrics: DashboardMetrics;
}

export const ComplianceSection: React.FC<ComplianceSectionProps> = ({ metrics }) => {
  const calculateRate = (value: number) => {
    if (!metrics.totalHouseholds) return 0;
    return Math.round((value / metrics.totalHouseholds) * 100);
  };

  const microCards = [
    { label: 'PVNC', value: metrics.pvnc, tone: 'text-blue-300/70', hint: 'Non conformites' },
    { label: 'PVR', value: metrics.pvr, tone: 'text-emerald-300/70', hint: 'Reception' },
    { label: 'PVHSE', value: metrics.pvhse, tone: 'text-amber-300/70', hint: 'Securite' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KPICard
          title="CONFORME"
          value={metrics.conforme}
          icon={<ShieldCheck size={22} className="text-emerald-400" />}
          trend={metrics.totalHouseholds ? { value: calculateRate(metrics.conforme), isUp: true, label: 'Taux' } : undefined}
        />
        <KPICard
          title="NON-CONF."
          value={metrics.nonConforme}
          icon={<AlertCircle size={22} className="text-rose-400" />}
          trend={metrics.totalHouseholds ? { value: calculateRate(metrics.nonConforme), isUp: false, label: 'Taux' } : undefined}
        />
        <KPICard
          title="INCIDENT HSE"
          value={metrics.incidentsHSE}
          icon={<AlertCircle size={22} className="text-amber-500" />}
          trend={metrics.incidentsHSE > 0 ? { value: metrics.incidentsHSE, isUp: false, label: 'À traiter' } : undefined}
        />
        <KPICard
          title="PV GÉNÉRÉS"
          value={metrics.totalPV}
          icon={<FileText size={22} className="text-blue-400" />}
        />
        <KPICard
          title="PV EN RETARD"
          value={metrics.pvRetard}
          icon={<Clock size={22} className="text-orange-400" />}
          trend={metrics.pvRetard > 0 ? { value: metrics.pvRetard, isUp: false, label: 'En retard' } : undefined}
        />
        <KPICard
          title="ACTIONS REQ."
          value={metrics.actionRequired}
          icon={<Activity size={22} className="text-purple-400" />}
          trend={metrics.actionRequired > 0 ? { value: metrics.actionRequired, isUp: false, label: 'En attente' } : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {microCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.2rem] border border-white/5 bg-slate-900/40 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:rounded-[1.55rem] sm:p-4.5"
          >
            <h4 className={`mb-2 text-[10px] font-black uppercase tracking-[0.16em] ${card.tone}`}>
              {card.label}
            </h4>
            <p className="text-xl font-black tracking-tight text-white sm:text-[2rem]">{card.value}</p>
            <p className="mt-1 text-[0.74rem] uppercase tracking-[0.12em] text-slate-500 sm:text-[0.78rem]">
              {card.hint}
            </p>
          </div>
        ))}
      </div>

      {/* ── ANALYSIS BREAKDOWN : MOTIFS DE NON-CONFORMITÉ ── */}
      {metrics.nonConforme > 0 && (
        <div className="rounded-[1.8rem] border border-white/5 bg-slate-900/40 p-6 backdrop-blur-2xl shadow-2xl">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter text-white">Analyse des Écarts Techniques</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Répartition des motifs de non-conformité</p>
            </div>
            <div className="rounded-full bg-rose-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-400 border border-rose-500/20">
              {metrics.nonConforme} Ménages Impactés
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Résistance Terre', value: metrics.nonComplianceBreakdown?.grounding || 0, color: 'bg-amber-500', icon: PlugZap, desc: '> 1500Ω Ohm' },
              { label: 'Installation Int.', value: metrics.nonComplianceBreakdown?.installation || 0, color: 'bg-violet-500', icon: Home, desc: 'Défauts pose' },
              { label: 'Branchement Res.', value: metrics.nonComplianceBreakdown?.branchement || 0, color: 'bg-sky-500', icon: Activity, desc: 'Erreurs réseau' },
              { label: 'Autres Motifs', value: metrics.nonComplianceBreakdown?.other || 0, color: 'bg-slate-500', icon: ClipboardList, desc: 'Administratif' },
            ].map((item) => {
              const percent = metrics.nonConforme > 0 ? Math.round((item.value / metrics.nonConforme) * 100) : 0;
              const Icon = item.icon;
              return (
                <div key={item.label} className="group flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                  <div className="flex items-center justify-between">
                    <Icon size={22} className="text-slate-300" />
                    <span className="text-lg font-black text-white">{item.value}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{item.label}</p>
                    <p className="text-[9px] font-medium text-slate-500">{item.desc}</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
                      <span>Poids</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
