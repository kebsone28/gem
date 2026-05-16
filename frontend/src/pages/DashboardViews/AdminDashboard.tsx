/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, BarChart3, Users, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useLabels } from '../../contexts/LabelsContext';
import { missionStatsService } from '../../services/missionStatsService';
import { useAuth } from '../../contexts/AuthContext';
import {
  ConsoleSettings,
  type ConsoleSettingsConfig,
} from '../../components/admin/ConsoleSettings';
import { useConsoleLayout } from '../../hooks/useConsoleLayout';
import { organizationService } from '../../services/organizationService';
import { ROLES, normalizeRole } from '../../utils/permissions';
import { FileText, CheckCircle, Shield } from 'lucide-react';

// ── MODULE ARCHITECTURE ──
import { DashboardHeader } from './admin/components/DashboardHeader';
import { GlobalProgressCard } from './admin/components/GlobalProgressCard';
import { UnifiedStatsTable } from './admin/components/UnifiedStatsTable';
import { ControlPanel } from './admin/components/ControlPanel';
import { TeamPerformance } from '../../components/dashboards/TeamPerformance';

import { useDashboardData } from './admin/hooks/useDashboardData';
import { useMissionStats } from './admin/hooks/useMissionStats';
import { useMonitoring } from './admin/hooks/useMonitoring';
import { useAuditLogs } from './admin/hooks/useAuditLogs';
import { useSyncHandler } from './admin/hooks/useSyncHandler';
import { useAutoRefresh } from './admin/hooks/useAutoRefresh';
import { useServerAIContext } from './admin/hooks/useServerAIContext';
import { GlobalGedOsAiChat } from '../../components/ia/GlobalGedOsAiChat';
import AIEngineAdminPanel from '../../components/ia/AIEngineAdminPanel';
import { Brain } from 'lucide-react';

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

  const [showAIPanel, setShowAIPanel] = useState(false);
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const nRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isDG = nRole === ROLES.DIRECTEUR;

  useEffect(() => {
    organizationService
      .getConfig()
      .then(setOrgConfig)
      .catch(() => {});
  }, []);

  // 5. Charger et écouter les réglages de la console
  const [consoleSettings, setConsoleSettings] = useState<ConsoleSettingsConfig>(() => {
    const saved = localStorage.getItem('console-settings');
    try {
      return saved ? JSON.parse(saved) : DEFAULT_CONSOLE_SETTINGS;
    } catch {
      return DEFAULT_CONSOLE_SETTINGS;
    }
  });

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      setConsoleSettings(e.detail);
    };

    window.addEventListener('ged-os:console-settings-change', handleSettingsChange);
    return () => window.removeEventListener('ged-os:console-settings-change', handleSettingsChange);
  }, []);
  useConsoleLayout(consoleSettings);

  const canViewReports = peut(PERMISSIONS.TERRAIN_READ) || peut(PERMISSIONS.FINANCE_READ);
  const projectId = project?.id || '';

  // ── BUSINESS HOOKS ──
  const {
    metrics,
    isLoading: isMetricsLoading,
    refresh: refreshKPI,
    localZonesCount,
  } = useDashboardData(projectId, canViewReports);
  const {
    stats: missionStats,
    missions,
    refresh: refreshMissions,
  } = useMissionStats(user as any, projectId);
  const { activities, refresh: refreshMonitoring } = useMonitoring(canViewReports);
  const { feedActivities, refresh: refreshAudit } = useAuditLogs(activities);
  const {
    households: _aiHouseholds,
    teams: _aiTeams,
    auditLogs: _aiAuditLogs,
    regionalSummaries: _aiRegionalSummaries,
    refresh: refreshAIContext,
  } = useServerAIContext(projectId, canViewReports);

  // ── ACTIONS & REFRESH ──
  const refreshAll = useCallback(async () => {
    refreshKPI();
    refreshMissions();
    refreshMonitoring();
    refreshAudit();
    refreshAIContext();
  }, [refreshAIContext, refreshKPI, refreshMissions, refreshMonitoring, refreshAudit]);

  const { isSyncing, handleSync } = useSyncHandler(refreshKPI);
  
  // Raccordement du rafraîchissement auto au réglage de la console
  useAutoRefresh(refreshAll, consoleSettings.autoRefresh ? 60000 : 999999999); 

  const lastSyncLabel = isSyncing
    ? 'maintenant'
    : feedActivities[0]?.time || activities[0]?.time || 'recemment';
  const missionsDone = missionStats?.totalCertified ?? metrics.totalArchived ?? 0;
  const missionsInProgress = Math.max(
    0,
    (missionStats?.totalMissions ?? 0) - (missionStats?.totalCertified ?? 0)
  );
  const errorCount =
    (metrics.problemHouseholds ?? 0) + (metrics.actionRequired ?? 0) + (metrics.incidentsHSE ?? 0);
  const exportAvailable = Boolean(missionStats && missionStats.totalMissions >= 0);
  const koboConnected = canViewReports && Boolean(projectId);
  const situationItems = [
    {
      label: 'Charge critique',
      value: errorCount,
      helper:
        errorCount > 0
          ? `${metrics.problemHouseholds} menages en anomalie, ${metrics.actionRequired} action(s) requise(s)`
          : 'Aucune anomalie bloquante remontee',
      tone:
        errorCount > 0
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
      icon: AlertTriangle,
    },
    {
      label: 'Rythme mission',
      value: missionsInProgress,
      helper:
        missionsInProgress > 0
          ? `${missionsDone} mission(s) cloturee(s), ${missionStats?.totalMissions ?? 0} total`
          : 'Aucune mission ouverte en ce moment',
      tone: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
      icon: Activity,
    },
    {
      label: 'Conformite terrain',
      value: metrics.conforme ?? 0,
      helper: `${metrics.nonConforme ?? 0} non conforme(s), ${metrics.incidentsHSE ?? 0} incident(s) HSE`,
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
      icon: CheckCircle2,
    },
  ];
  const topPriorities = [
    errorCount > 0
      ? `${errorCount} point(s) demandent un arbitrage rapide`
      : 'Aucun point critique remonte dans le flux terrain',
    (metrics.pvRetard ?? 0) > 0
      ? `${metrics.pvRetard ?? 0} PV en retard sur ${metrics.totalPV ?? 0}`
      : 'Aucun retard PV detecte',
    koboConnected ? 'Collecte Kobo disponible pour les equipes' : 'Connexion Kobo a verifier',
  ];

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
          title="GED OS | CONSOLE DE PILOTAGE"
          subtitle="Système d'Exploitation d'Écosystème Digital"
          icon={
            <ShieldCheck
              size={28}
              className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
            />
          }
          className="relative z-10 pt-10 pb-8 sm:pt-12 sm:pb-10"
        />

        <ContentArea
          padding="none"
          className="bg-transparent border-none shadow-none relative z-10"
        >
          <div className="space-y-4 px-2 pb-28 sm:space-y-7 sm:px-6 sm:pb-24 lg:space-y-9 lg:px-10 xl:px-12">
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

            {/* 🎯 DG QUICK ACCESS MODULES */}
            {isDG && orgConfig?.mission_panels_dg && orgConfig.mission_panels_dg.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  {
                    id: 'prep',
                    label: 'Stratégie',
                    desc: 'Planning & Cadrage',
                    icon: FileText,
                    color: 'text-sky-400',
                    bg: 'bg-sky-400/10',
                    border: 'border-sky-400/20',
                    tab: 'prep',
                  },
                  {
                    id: 'report',
                    label: 'Exécution',
                    desc: 'Rapports Terrain',
                    icon: CheckCircle,
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-400/10',
                    border: 'border-emerald-400/20',
                    tab: 'report',
                  },
                  {
                    id: 'approval',
                    label: 'Approbations',
                    desc: 'Validations Métier',
                    icon: Shield,
                    color: 'text-purple-400',
                    bg: 'bg-purple-400/10',
                    border: 'border-purple-400/20',
                    tab: 'approval',
                  },
                ]
                  .filter((m) => orgConfig.mission_panels_dg.includes(m.id))
                  .map((module) => (
                    <button
                      key={module.id}
                      onClick={() => navigate(`/admin/mission?tab=${module.tab}`)}
                      className={`flex flex-col items-start p-6 rounded-3xl border ${module.border} ${module.bg} transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden`}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-colors" />
                      <div
                        className={`p-3 rounded-2xl mb-4 ${module.bg} ${module.color} ring-1 ring-white/10`}
                      >
                        <module.icon size={24} />
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">
                        {module.label}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1 font-medium">{module.desc}</p>
                      <div
                        className={`mt-4 text-[10px] font-black uppercase tracking-[0.2em] ${module.color} flex items-center gap-2`}
                      >
                        Accéder au module
                        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                      </div>
                    </button>
                  ))}
              </div>
            )}

            <section className="rounded-[1.55rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,6,23,0.88))] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)] sm:rounded-[1.9rem] sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 xl:max-w-[340px]">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Situation du jour
                  </div>
                  <h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-xl">
                    Lecture executive du terrain
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Vue compacte pour juger la tension operationnelle, la cadence mission et la
                    conformite sans quitter la console.
                  </p>
                </div>

                <div className="grid flex-1 gap-3 md:grid-cols-3">
                  {situationItems.map(({ label, value, helper, tone, icon: Icon }) => (
                    <div key={label} className={`rounded-[1.25rem] border p-4 ${tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">
                            {label}
                          </div>
                          <div className="mt-2 text-2xl font-black tracking-tight text-white">
                            {value}
                          </div>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                          <Icon size={18} />
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-300">{helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-white/6 pt-4">
                <div className="flex flex-wrap gap-2">
                  {topPriorities.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Level 1: Core Progress */}
            {consoleSettings.showStats && (
              <GlobalProgressCard metrics={metrics} isLoading={isMetricsLoading} />
            )}

            {/* Team Production Performance */}
            {consoleSettings.showTeams && (
              <div className="pt-1 sm:pt-4">
                <TeamPerformance
                  teamStats={metrics.breakdown.byTeam}
                  productionRates={project?.config?.productionRates}
                />
              </div>
            )}

            {/* Strategic Unified Table (Compact Excel View) */}
            {consoleSettings.showStats && (
              <UnifiedStatsTable
                metrics={metrics}
                missionStats={missionStats}
                householdLabel={getLabel('household.plural')}
              />
            )}

            {/* Compliance & Regulation (Optional: We could also hide this if redundant) */}
            {/* <ComplianceSection metrics={metrics} /> */}

            {/* Infrastructure Control & Live Activity */}
            {consoleSettings.showLogs && (
              <ControlPanel
                metrics={metrics}
                feedActivities={feedActivities}
                missions={missions}
                isLoading={isMetricsLoading}
              />
            )}

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
      </PageContainer>

      {/* IA Assistante (Positionnée dynamiquement via Props) */}
      {consoleSettings.showAI && (
        <GlobalGedOsAiChat className="bottom-6 right-6" />
      )}

      {/* Le composant ConsoleSettings est conservé ici pour piloter l'état du dashboard, 
          mais son bouton flottant est masqué (showButton={false}) */}
      <ConsoleSettings onSettingsChange={setConsoleSettings} showButton={false} />

      {/* Modal IA Avancée (Pilotée depuis la Sidebar maintenant, 
          mais on peut garder un backup ici si besoin ou le supprimer) */}
      {showAIPanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
           <AIEngineAdminPanel user={user} onClose={() => setShowAIPanel(false)} />
        </div>
      )}
    </>
  );
};

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
      <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-slate-500 group-hover:text-blue-400 sm:text-[0.68rem] sm:tracking-[0.22em]">
        {label}
      </p>
      <p className="mt-1 text-[0.84rem] font-black uppercase tracking-[-0.02em] text-white sm:text-[0.95rem]">
        {title}
      </p>
    </div>
  </button>
);
