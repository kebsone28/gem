/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, BarChart3, Users } from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useLabels } from '../../contexts/LabelsContext';
import { missionStatsService } from '../../services/missionStatsService';
import { useAuth } from '../../contexts/AuthContext';
import { MissionMentor } from '../../components/ia/MissionMentor';
import { ConsoleSettings, type ConsoleSettingsConfig } from '../../components/admin/ConsoleSettings';
import { useConsoleLayout } from '../../hooks/useConsoleLayout';

// ── MODULE ARCHITECTURE ──
import { DashboardHeader } from './admin/components/DashboardHeader';
import { GlobalProgressCard } from './admin/components/GlobalProgressCard';
import { KPISection } from './admin/components/KPISection';
import { ComplianceSection } from './admin/components/ComplianceSection';
import { OperationalSection } from './admin/components/OperationalSection';
import { ControlPanel } from './admin/components/ControlPanel';
import { TeamPerformance } from '../../components/dashboards/TeamPerformance';

import { useDashboardData } from './admin/hooks/useDashboardData';
import { useMissionStats } from './admin/hooks/useMissionStats';
import { useMonitoring } from './admin/hooks/useMonitoring';
import { useAuditLogs } from './admin/hooks/useAuditLogs';
import { useSyncHandler } from './admin/hooks/useSyncHandler';
import { useAutoRefresh } from './admin/hooks/useAutoRefresh';

// ── DEFAULT CONSOLE SETTINGS ──
const DEFAULT_CONSOLE_SETTINGS: ConsoleSettingsConfig = {
  showSidebar: true,
  showStats: true,
  showTeams: true,
  showLogs: true,
  theme: 'dark',
  accentColor: 'blue',
  compact: false,
  columns: 3,
  gridSpacing: 'normal',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project } = useProject();
  const { peut, PERMISSIONS } = usePermissions();
  const { getLabel } = useLabels();

  // ── CONSOLE CUSTOMIZATION ──
  const [consoleSettings, setConsoleSettings] = useState<ConsoleSettingsConfig>(DEFAULT_CONSOLE_SETTINGS);
  useConsoleLayout(consoleSettings);

  const canViewReports = peut(PERMISSIONS.VOIR_RAPPORTS);
  const projectId = project?.id || '';

  // ── BUSINESS HOOKS ──
  const {
    metrics,
    isLoading: isMetricsLoading,
    refresh: refreshKPI,
    localZonesCount,
  } = useDashboardData(projectId, canViewReports);
  const { stats: missionStats, missions, refresh: refreshMissions } = useMissionStats(user as any, projectId);
  const { activities, refresh: refreshMonitoring } = useMonitoring(canViewReports);
  const { feedActivities, refresh: refreshAudit } = useAuditLogs(activities);

  // ── ACTIONS & REFRESH ──
  const refreshAll = useCallback(async () => {
    refreshKPI();
    refreshMissions();
    refreshMonitoring();
    refreshAudit();
  }, [refreshKPI, refreshMissions, refreshMonitoring, refreshAudit]);

  const { isSyncing, handleSync } = useSyncHandler(refreshKPI);
  useAutoRefresh(refreshAll, 60000); // Efficient auto-refresh every 1 min

  const lastSyncLabel = isSyncing
    ? 'maintenant'
    : feedActivities[0]?.time || activities[0]?.time || 'recemment';
  const missionsDone = missionStats?.totalCertified ?? metrics.totalArchived;
  const missionsInProgress = Math.max(
    0,
    (missionStats?.totalMissions ?? 0) - (missionStats?.totalCertified ?? 0)
  );
  const errorCount = metrics.problemHouseholds + metrics.actionRequired + metrics.incidentsHSE;
  const exportAvailable = Boolean(missionStats && missionStats.totalMissions >= 0);
  const koboConnected = canViewReports && Boolean(projectId);

  const handleExportCompta = async () => {
    const tid = toast.loading("Préparation de l'export comptable...");
    try {
      await missionStatsService.exportCertifiedMissionsToExcel();
      toast.success('Excel généré avec succès !', { id: tid });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'export";
      toast.error(message, { id: tid });
    }
  };

  return (
    <>
      <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="CONSOLE D'ADMINISTRATION"
        subtitle="Système de pilotage stratégique Haute-Performance"
        icon={<ShieldCheck size={28} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />}
        className="relative z-10 pt-10 pb-8 sm:pt-12 sm:pb-10"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="space-y-5 px-3 pb-28 sm:space-y-7 sm:px-6 sm:pb-24 lg:space-y-9 lg:px-10 xl:px-12">
          {/* Header & Main Actions */}
          <DashboardHeader
            projectName={project?.name || ''}
            isSyncing={isSyncing}
            isLoading={isMetricsLoading}
            onSync={handleSync}
            onExportCompta={handleExportCompta}
            projectProgress={metrics.progressPercent}
            missionsDone={missionsDone}
            missionsInProgress={missionsInProgress}
            errorCount={errorCount}
            syncHealth={metrics.syncHealth}
            lastSyncLabel={lastSyncLabel}
            koboConnected={koboConnected}
            exportAvailable={exportAvailable}
          />

          {/* Level 1: Core Progress */}
          <GlobalProgressCard metrics={metrics} isLoading={isMetricsLoading} />

          {/* Team Production Performance */}
          <div className="pt-1 sm:pt-4">
            <TeamPerformance
              teamStats={metrics.breakdown.byTeam}
              productionRates={project?.config?.productionRates}
            />
          </div>

          {/* Operational Performance & Teams */}
          <OperationalSection metrics={metrics} zonesCount={localZonesCount} />

          {/* Strategic KPIs */}
          <KPISection
            metrics={metrics}
            missionStats={missionStats}
            householdLabel={getLabel('household.plural')}
            isLoading={isMetricsLoading}
          />

          {/* Compliance & Regulation */}
          <ComplianceSection metrics={metrics} />

          {/* Infrastructure Control & Live Activity */}
          <ControlPanel
            metrics={metrics}
            feedActivities={feedActivities}
            missions={missions}
            isLoading={isMetricsLoading}
          />

          {/* Secondary Nav / Data Access */}
          <footer className="grid grid-cols-1 gap-4 border-t border-white/5 pt-6 sm:grid-cols-2 sm:gap-5 sm:pt-10 relative z-10">
            <FooterButton
              onClick={() => navigate('/rapports')}
              label="CENTRE DE DONNÉES"
              title="Exporter Rapport Global"
              Icon={BarChart3}
            />
            <FooterButton
              onClick={() => navigate('/admin/users')}
              label="ACCÈS IDENTITÉS"
              title="Console de Gestion Utilisateurs"
              Icon={Users}
            />
          </footer>
        </div>
      </ContentArea>

      {/* AI Sage (Knowledge Integration) */}
      <MissionMentor stats={missionStats} auditLogs={[]} households={[]} />
    </PageContainer>

    {/* Console Settings Panel - Outside PageContainer for fixed positioning */}
    <ConsoleSettings onSettingsChange={setConsoleSettings} />
  </>
);
}

// ── UTILS ──
import { type LucideIcon } from 'lucide-react';

interface FooterButtonProps {
  onClick: () => void;
  label: string;
  title: string;
  Icon: LucideIcon;
}

const FooterButton = ({ onClick, label, title, Icon }: FooterButtonProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 rounded-[1.4rem] border border-white/5 bg-slate-900/40 px-5 py-4 transition-all group backdrop-blur-xl hover:border-blue-500/40 sm:gap-5 sm:rounded-[1.9rem] sm:px-6 sm:py-5"
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/5 bg-white/5 shadow-lg transition-all group-hover:bg-blue-600 group-hover:text-white sm:h-13 sm:w-13 sm:rounded-[1.1rem]">
      <Icon size={20} className="text-blue-400 transition-colors group-hover:text-white" />
    </div>
    <div className="text-left">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-slate-500 group-hover:text-blue-400 sm:text-[0.68rem] sm:tracking-[0.22em]">{label}</p>
      <p className="mt-1 text-[0.84rem] font-black uppercase tracking-[-0.02em] text-white sm:text-[0.95rem]">{title}</p>
    </div>
  </button>
);
