 
import React from 'react';
import { Users, Zap, CheckCircle2, LayoutGrid } from 'lucide-react';
import { KPICard } from '../../../../components/dashboards/DashboardComponents';
import { fmtNum } from '../../../../utils/format';
import type { DashboardMetrics, MissionStats } from '../types';

interface KPISectionProps {
  metrics: DashboardMetrics;
  missionStats: MissionStats | null;
  householdLabel: string;
  isLoading?: boolean;
}

export const KPISection: React.FC<KPISectionProps> = ({
  metrics,
  missionStats,
  householdLabel,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="min-h-[126px] animate-pulse rounded-[1.3rem] border border-white/10 bg-slate-900/40 p-4 sm:min-h-[142px] sm:rounded-[1.55rem] sm:p-5"
          >
            <div className="h-10 w-10 rounded-xl bg-white/10" />
            <div className="mt-6 h-4 w-28 rounded-full bg-white/10" />
            <div className="mt-3 h-10 w-20 rounded-2xl bg-white/10" />
            <div className="mt-3 h-3 w-24 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
      <KPICard
        title={`TOTAL ${householdLabel.toUpperCase()}`}
        value={fmtNum(metrics.totalHouseholds)}
        icon={<Users size={22} />}
        trend={{ value: metrics.progressPercent, isUp: true, label: 'Base terrain active' }}
        sparkline={[30, 45, 35, 60, 55, 80, 70]}
      />
      <KPICard
        title="TOTAL INDEMNITÉS (FCFA)"
        value={missionStats ? fmtNum(missionStats.totalIndemnities) : '0'}
        icon={<Zap size={22} className="text-amber-400" />}
        trend={
          missionStats
            ? {
                value: Math.round((missionStats.totalCertified / (missionStats.totalMissions || 1)) * 100),
                isUp: true,
                label: 'Certification',
              }
            : undefined
        }
      />
      <KPICard
        title="MISSIONS CERTIFIÉES"
        value={missionStats ? missionStats.totalCertified.toString() : '0'}
        icon={<CheckCircle2 size={22} className="text-emerald-400" />}
        trend={
          missionStats
            ? {
                value: missionStats.totalCertified,
                isUp: true,
                label: 'Validees terrain',
              }
            : undefined
        }
        sparkline={[40, 70, 45, 90, 65, 80, 95]}
      />
      <KPICard
        title="AGENTS DÉPLOYÉS"
        value={missionStats ? missionStats.totalMembersDeployed.toString() : '0'}
        icon={<LayoutGrid size={22} className="text-blue-400" />}
        trend={{ value: Math.max(0, metrics.breakdown.byTeam.length), isUp: true, label: 'Equipes actives' }}
      />
    </div>
  );
};
