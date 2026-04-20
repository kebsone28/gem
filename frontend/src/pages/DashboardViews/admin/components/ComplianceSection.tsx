/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        <KPICard
          title="CONFORMITÉ"
          value={metrics.conforme}
          icon={<ShieldCheck size={22} className="text-emerald-400" />}
          trend={metrics.totalHouseholds ? { value: calculateRate(metrics.conforme), isUp: true, label: 'Taux' } : undefined}
        />
        <KPICard
          title="NON-CONFORME"
          value={metrics.nonConforme}
          icon={<AlertCircle size={22} className="text-rose-400" />}
          trend={metrics.totalHouseholds ? { value: calculateRate(metrics.nonConforme), isUp: false, label: 'Taux' } : undefined}
        />
        <KPICard
          title="INCIDENTS HSE"
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
          title="PV RETARD"
          value={metrics.pvRetard}
          icon={<Clock size={22} className="text-orange-400" />}
          trend={metrics.pvRetard > 0 ? { value: metrics.pvRetard, isUp: false, label: 'En retard' } : undefined}
        />
        <KPICard
          title="ACTIONS REQUISES"
          value={metrics.actionRequired}
          icon={<Activity size={22} className="text-purple-400" />}
          trend={metrics.actionRequired > 0 ? { value: metrics.actionRequired, isUp: false, label: 'En attente' } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-xl">
          <h4 className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] mb-4 italic">PVNC (Non-Conformité)</h4>
          <p className="text-3xl font-black text-white italic">{metrics.pvnc}</p>
        </div>
        <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-xl">
          <h4 className="text-[10px] font-black text-emerald-400/40 uppercase tracking-[0.3em] mb-4 italic">PVR (Réception)</h4>
          <p className="text-3xl font-black text-white italic">{metrics.pvr}</p>
        </div>
        <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-xl">
          <h4 className="text-[10px] font-black text-amber-400/40 uppercase tracking-[0.3em] mb-4 italic">PVHSE (Sécurité)</h4>
          <p className="text-3xl font-black text-white italic">{metrics.pvhse}</p>
        </div>
      </div>
    </div>
  );
};
