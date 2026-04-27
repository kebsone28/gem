 
import React from 'react';
import { ShieldCheck, AlertCircle, FileText, Clock, Activity } from 'lucide-react';
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
    </div>
  );
};
