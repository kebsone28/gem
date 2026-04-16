import React from 'react';
import { Users, Zap, CheckCircle2, LayoutGrid } from 'lucide-react';
import { KPICard } from '../../../../components/dashboards/DashboardComponents';
import { fmtNum } from '../../../../utils/format';
import type { DashboardMetrics, MissionStats } from '../types';

interface KPISectionProps {
  metrics: DashboardMetrics;
  missionStats: MissionStats | null;
  householdLabel: string;
}

export const KPISection: React.FC<KPISectionProps> = ({ metrics, missionStats, householdLabel }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      <KPICard
        title={`TOTAL ${householdLabel.toUpperCase()}`}
        value={fmtNum(metrics.totalHouseholds)}
        icon={<Users size={22} />}
        trend={{ value: 8, isUp: true, label: 'VS PÉRIODE PRÉCÉDENTE' }}
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
                label: 'Taux de Certification',
              }
            : undefined
        }
      />
      <KPICard
        title="MISSIONS CERTIFIÉES"
        value={missionStats ? missionStats.totalCertified.toString() : '0'}
        icon={<CheckCircle2 size={22} className="text-emerald-400" />}
        sparkline={[40, 70, 45, 90, 65, 80, 95]}
      />
      <KPICard
        title="AGENTS DÉPLOYÉS"
        value={missionStats ? missionStats.totalMembersDeployed.toString() : '0'}
        icon={<LayoutGrid size={22} className="text-blue-400" />}
        trend={{ value: 5, isUp: true, label: 'Ressources actives' }}
      />
    </div>
  );
};
