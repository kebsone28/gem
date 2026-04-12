import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { db } from '../../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import apiClient from '../../api/client';
import {
  Users,
  RefreshCw,
  Activity,
  ShieldCheck,
  AlertCircle,
  Compass,
  Zap,
  Box,
  LayoutGrid,
  Calendar,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Database,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import { useNavigate } from 'react-router-dom';
import { fmtNum } from '../../utils/format';
import { useProject } from '../../contexts/ProjectContext';
import { useSync } from '../../hooks/useSync';
import { usePermissions } from '../../hooks/usePermissions';
import logger from '../../utils/logger';
import { useLabels } from '../../contexts/LabelsContext';
import {
  KPICard,
  StatusBadge,
  ProgressBar,
  ActionBar,
  ActivityFeed,
  AlertPanel,
} from '../../components/dashboards/DashboardComponents';
import { TeamPerformance } from '../../components/dashboards/TeamPerformance';
import { auditService } from '../../services/auditService';
import { missionStatsService } from '../../services/missionStatsService';
import type { MissionStats } from '../../services/missionStatsService';
import { useAuth } from '../../contexts/AuthContext';
import { MissionMentor } from '../../components/ia/MissionMentor';
import type { AuditLog } from '../../utils/types';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const { project } = useProject();
  const { forceSync } = useSync();
  const { peut, PERMISSIONS } = usePermissions();
  const { getLabel } = useLabels();

  const [activities, setActivities] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  // MONITORING DATA FETCHED BELOW
  const canViewReports = peut(PERMISSIONS.VOIR_RAPPORTS);

  const projId = project?.id || '';

  const households =
    useLiveQuery(
      async () => (projId ? db.households.where('projectId').equals(projId).toArray() : []),
      [projId]
    ) || [];
  const zones = useLiveQuery(async () => db.zones.toArray(), []) || [];
  const missions =
    useLiveQuery(
      async () => (projId ? db.missions.where('projectId').equals(projId).toArray() : []),
      [projId]
    ) || [];

  const localTotal = households.length;
  const localDone = households.filter(
    (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
  ).length;

  useEffect(() => {
    const fetchRemoteMetrics = async () => {
      if (!project?.id || !canViewReports) return;
      try {
        const response = await apiClient.get(`kpi/${project.id}`);
        if (response.status === 200 && response.data?.metrics) {
          setMetrics(response.data.metrics);
        }
      } catch (err: any) {
        if (err.response?.status !== 401) logger.error('Failed to fetch metrics', err);
      }
    };
    const fetchMonitoringData = async () => {
      if (!canViewReports) return;
      try {
        const [actRes] = await Promise.all([
          apiClient.get('monitoring/activity'),
          apiClient.get('monitoring/performance'),
        ]);
        setActivities(actRes.data.activities);
        // setPerfData(perfRes.data); // Reserved for future visualization
      } catch (err: any) {
        if (err.response?.status !== 401) logger.error('Failed to fetch monitoring data', err);
      }
    };

    const fetchMissionStats = async () => {
      if (!user) return;
      const isMaster = user.email === 'admingem' || user.role === 'ADMIN_PROQUELEC';
      const stats = isMaster
        ? await missionStatsService.getGlobalStats()
        : await missionStatsService.getUserStats(user.email, user.id);
      setMissionStats(stats);
    };

    fetchRemoteMetrics();
    fetchMonitoringData();
    loadAuditLogs();
    fetchMissionStats();

    // Refresh logs every 30s or on focus
    const interval = setInterval(() => {
      loadAuditLogs();
      fetchMissionStats();
    }, 30000);
    window.addEventListener('focus', loadAuditLogs);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', loadAuditLogs);
    };
  }, [project?.id, canViewReports]);

  const loadAuditLogs = async () => {
    const logs = await auditService.getLastLogs(5);
    setAuditLogs(logs);
  };

  const refreshMetrics = useCallback(async () => {
    if (!project?.id || !canViewReports) return;
    try {
      const [kpiRes, actRes] = await Promise.all([
        apiClient.get(`kpi/${project.id}`),
        apiClient.get('monitoring/activity'),
      ]);
      if (kpiRes.data?.metrics) setMetrics(kpiRes.data.metrics);
      if (actRes.data?.activities) setActivities(actRes.data.activities);
    } catch (err: any) {
      if (err.response?.status !== 401) logger.error('Failed to refresh metrics', err);
    }
  }, [project?.id, canViewReports]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading('Synchronisation en cours...');
    try {
      await forceSync();
      // Attend 1.5s que le backend finisse le pull
      await new Promise((r) => setTimeout(r, 1500));
      await refreshMetrics();
      toast.success('Synchronisation réussie !', { id: toastId });
    } catch (err) {
      logger.error('handleSync failed', err);
      toast.error('Erreur de synchronisation', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCompta = async () => {
    const tid = toast.loading("Préparation de l'export comptable...");
    try {
      await missionStatsService.exportCertifiedMissionsToExcel();
      toast.success('Excel généré avec succès !', { id: tid });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'export", { id: tid });
    }
  };

  const displayStats = metrics || {
    totalHouseholds: localTotal,
    electrifiedHouseholds: localDone,
    progressPercent: localTotal > 0 ? Math.round((localDone / localTotal) * 100) : 0,
    igppScore: 0,
    problemHouseholds: households.filter((h) => h.status === 'Problème').length,
    pipeline: { murs: 0, reseau: 0, interieur: 0, validated: localDone },
    performance: { avgPerDay: 0, daysWorked: 0, avgCablePerHouse: 0, efficiencyRate: 0 },
    logistics: { kitPrepared: 0, kitLoaded: 0, gap: 0 },
    technical: { totalConsumption: 0 },
    breakdown: { byZone: [], byTeam: [] },
  };

  const feedActivities = auditLogs.map((log) => ({
    id: log.id,
    type: (log.severity === 'critical'
      ? 'danger'
      : log.severity === 'warning'
        ? 'warning'
        : 'success') as any,
    message: `${log.userName}: ${log.action} - ${log.details}`,
    time: new Date(log.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  // Fallback if no audit logs
  if (feedActivities.length === 0) {
    feedActivities.push(
      ...activities.slice(0, 5).map((a) => ({
        id: a.id || Math.random().toString(),
        type: (a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'success') as any,
        message: a.message,
        time: a.timestamp || "À l'instant",
      }))
    );
  }

  return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="CONSOLE D'ADMINISTRATION"
        subtitle="Système de pilotage stratégique Haute-Performance"
        icon={
          <ShieldCheck
            size={28}
            className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
          />
        }
        className="relative z-10 pt-12 pb-10"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-6 lg:px-12 pb-24 space-y-12">
          {/* ── HEADER & ACTIONS ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status="info" label="Expert Console V.2" />
                <span className="h-4 w-[1px] bg-white/10" />
                <span className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] font-mono">
                  {project?.name || 'INITIALIZING...'}
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-[0.8] mb-1">
                PILOTAGE{' '}
                <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  STRATÉGIQUE
                </span>
              </h1>
            </div>

            <ActionBar>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="h-14 px-6 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-blue-500/30 transition-all flex items-center gap-3 disabled:opacity-30 group"
              >
                <RefreshCw
                  size={16}
                  className={`${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`}
                />
                {isSyncing ? 'SYNC IN PROGRESS' : 'SYNC CLOUD'}
              </button>
              <button
                onClick={() => navigate('/admin/kobo-mapping')}
                className="h-14 px-6 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white hover:border-blue-500/30 transition-all flex items-center gap-3 active:scale-95 group"
              >
                <Database
                  size={16}
                  className="text-blue-500 group-hover:scale-110 transition-transform"
                />
                KOBO ENGINE
              </button>
              <button
                onClick={handleExportCompta}
                className="h-14 px-6 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-white transition-all flex items-center gap-3 group"
                title="Exporter les missions certifiées en Excel"
              >
                <Download
                  size={16}
                  className="text-emerald-500 group-hover:text-white group-hover:bounce"
                />
                EXPORTER COMPTA
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent('keydown', {
                      key: 'k',
                      navigator: { platform: 'Win32' },
                    } as any)
                  )
                }
                className="h-14 px-8 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-3 italic"
              >
                HUB ACTIONS
                <ArrowRight size={16} />
              </button>
            </ActionBar>
          </div>

          {/* ── LEVEL 1: GLOBAL PROGRESS PREMIUM CARD ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 md:p-14 rounded-[3.5rem] bg-slate-900/40 border border-white/10 shadow-3xl relative overflow-hidden backdrop-blur-3xl group"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/[0.03] to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] flex items-center gap-3 italic">
                    <Compass size={18} className="text-blue-500" /> Progression des activités
                    terrain
                  </h3>
                  <div className="flex items-baseline gap-4">
                    <span className="text-8xl md:text-9xl font-black text-white tracking-tighter italic leading-none drop-shadow-xl">
                      {displayStats.progressPercent}%
                    </span>
                    <span
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase italic shadow-lg ${displayStats.progressPercent > 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'}`}
                    >
                      MISE EN ŒUVRE EN COURS
                    </span>
                  </div>
                  <p className="text-base text-slate-400 font-medium max-w-md leading-relaxed">
                    Le programme de déploiement est lancé dans le respect du cadre technique,
                    réglementaire et institutionnel. Indice de performance opérationnelle (IPO):{' '}
                    <span className="font-black text-blue-400 italic">
                      {displayStats.igppScore}%
                    </span>
                    .
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${displayStats.progressPercent}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest italic">
                    <span>PHASE INITIALE</span>
                    <span>NIVEAU DE RÉALISATION OPTIMAL</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
                  <p className="text-[10px] font-black text-blue-400/30 uppercase tracking-[0.3em] mb-4 italic">
                    COMPLETED ASSETS
                  </p>
                  <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                    {fmtNum(displayStats.electrifiedHouseholds)}
                  </p>
                  <div className="mt-6 h-1 w-16 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
                  <p className="text-[10px] font-black text-blue-400/30 uppercase tracking-[0.3em] mb-4 italic">
                    TOTAL PROJECT TARGET
                  </p>
                  <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                    {fmtNum(displayStats.totalHouseholds)}
                  </p>
                  <div className="mt-6 h-1 w-16 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── LEVEL 1.5: TEAM PERFORMANCE ── */}
          <div className="pt-6">
            <TeamPerformance
              teamStats={displayStats.breakdown.byTeam}
              productionRates={project?.config?.productionRates}
            />
          </div>

          {/* ── LEVEL 2: STRATEGIC KPIs ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <KPICard
              title={`TOTAL ${getLabel('household.plural').toUpperCase()}`}
              value={fmtNum(displayStats.totalHouseholds)}
              icon={<Users size={22} />}
              trend={{ value: 8, isUp: true, label: 'VS PREVIOUS PERIOD' }}
              sparkline={[30, 45, 35, 60, 55, 80, 70]}
            />
            <KPICard
              title="TOTAL INDEMNITÉS (FCFA)"
              value={missionStats ? fmtNum(missionStats.totalIndemnities) : '0'}
              icon={<Zap size={22} className="text-amber-400" />}
              trend={
                missionStats
                  ? {
                      value: Math.round(
                        (missionStats.totalCertified / (missionStats.totalMissions || 1)) * 100
                      ),
                      isUp: true,
                      label: 'Certification Rate',
                    }
                  : undefined
              }
            />
            <KPICard
              title="MISSIONS CERTIFIÉES"
              value={missionStats ? missionStats.totalCertified : '0'}
              icon={<CheckCircle2 size={22} className="text-emerald-400" />}
              sparkline={[40, 70, 45, 90, 65, 80, 95]}
            />
            <KPICard
              title="AGENTS DÉPLOYÉS"
              value={missionStats ? missionStats.totalMembersDeployed : '0'}
              icon={<LayoutGrid size={22} className="text-blue-400" />}
              trend={{ value: 5, isUp: true, label: 'Ressources actives' }}
            />
          </div>

          {/* ── LEVEL 3: OPERATIONAL GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* ── OPERATIONAL METRICS (Left) ── */}
            <div className="lg:col-span-8 space-y-10">
              <div className="p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-white/5">
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] flex items-center gap-3 italic">
                      <LayoutGrid size={18} className="text-blue-500" /> ENGINEERING PIPELINE FLOW
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {zones.length > 0
                        ? `SYNCED WITH ${zones.length} OPERATIONAL ZONES`
                        : 'AWAITING ZONE MAPPING'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/bordereau')}
                    className="h-10 px-6 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white rounded-full text-[9px] font-black uppercase tracking-widest transition-all italic active:scale-95"
                  >
                    ZONE DEEP-DIVE →
                  </button>
                </div>

                <div className="space-y-8">
                  <ProgressBar
                    label="Maçonnerie Structurelle"
                    count={`${displayStats.pipeline?.murs || 0} SITES`}
                    percentage={Math.round(
                      ((displayStats.pipeline?.murs || 0) / (displayStats.totalHouseholds || 1)) *
                        100
                    )}
                  />
                  <ProgressBar
                    label="Réseaux & Infrastructures"
                    count={`${displayStats.pipeline?.reseau || 0} SITES`}
                    percentage={Math.round(
                      ((displayStats.pipeline?.reseau || 0) / (displayStats.totalHouseholds || 1)) *
                        100
                    )}
                  />
                  <ProgressBar
                    label="Installations Intérieures"
                    count={`${displayStats.pipeline?.interieur || 0} SITES`}
                    percentage={Math.round(
                      ((displayStats.pipeline?.interieur || 0) /
                        (displayStats.totalHouseholds || 1)) *
                        100
                    )}
                  />
                  <ProgressBar
                    label="Mise en Service Finale"
                    count={`${displayStats.electrifiedHouseholds} SITES`}
                    percentage={displayStats.progressPercent}
                    status="success"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] mb-8 italic flex items-center gap-3">
                    <Box size={18} className="text-blue-500" /> LOGISTICS TRACKER
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/[0.03] p-6 rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-all">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-blue-400 transition-colors">
                        KITS DEPLOYED
                      </span>
                      <span className="text-2xl font-black text-white italic">
                        {fmtNum(displayStats.logistics?.kitPrepared || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.03] p-6 rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-all">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-blue-400 transition-colors">
                        AVG CABLE / HOUSE
                      </span>
                      <span className="text-2xl font-black text-white italic">
                        {displayStats.performance?.avgCablePerHouse || 0}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-rose-500/5 p-6 rounded-2xl border border-rose-500/10">
                      <span className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest italic">
                        LOGISTICS GAP
                      </span>
                      <span className="text-2xl font-black text-rose-500 italic">
                        -{displayStats.logistics?.gap || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl flex flex-col">
                  <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] mb-4 italic flex items-center gap-3">
                    <Activity size={18} className="text-blue-500" /> DAILY RENDERING
                  </h3>
                  <div className="flex-1 flex flex-col items-center justify-center py-6">
                    <div className="text-7xl font-black text-white italic tracking-tighter drop-shadow-xl">
                      {displayStats.performance?.avgPerDay || 0}
                    </div>
                    <p className="text-[10px] font-black text-blue-500/40 uppercase tracking-[0.3em] mt-2 italic">
                      AVERAGE YIELD / DAY
                    </p>
                    <div className="w-full h-24 flex items-end justify-between px-4 gap-2 mt-10">
                      {[40, 60, 45, 75, 80, 95, 85].map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          className="flex-1 bg-blue-600/30 rounded-t-lg hover:bg-blue-500 transition-colors cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CONTROL & ACTIVITY (Right) ── */}
            <div className="lg:col-span-4 space-y-10">
              <div className="p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl">
                <AlertPanel>
                  <AnimatePresence>
                    {displayStats.problemHouseholds > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex gap-4 p-6 bg-rose-500/10 rounded-3xl border border-rose-500/20 mb-4"
                      >
                        <AlertCircle size={22} className="text-rose-500 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-rose-500 uppercase tracking-[0.1em] italic">
                            CRITICAL INCIDENTS
                          </p>
                          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-bold">
                            {displayStats.problemHouseholds} UNITS REQUIRE IMMEDIATE ACTION.
                          </p>
                        </div>
                      </motion.div>
                    )}
                    {displayStats.syncHealth !== 'healthy' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex gap-4 p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20"
                      >
                        <RefreshCw size={22} className="text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-amber-500 uppercase tracking-[0.1em] italic">
                            SYNC WARNING
                          </p>
                          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-bold">
                            LATENCY DETECTED IN CLOUD UPLINK.
                          </p>
                        </div>
                      </motion.div>
                    )}
                    {displayStats.problemHouseholds === 0 &&
                      displayStats.syncHealth === 'healthy' && (
                        <div className="py-14 text-center bg-white/[0.02] rounded-[2.5rem] border border-dashed border-white/10">
                          <CheckCircle2
                            size={48}
                            className="text-emerald-500 mx-auto mb-4 opacity-20"
                          />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">
                            ALL SYSTEMS NOMINAL
                          </p>
                        </div>
                      )}
                  </AnimatePresence>
                </AlertPanel>
              </div>

              <div className="p-10 rounded-[3.5rm] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl h-[500px] flex flex-col overflow-hidden">
                <ActivityFeed activities={feedActivities} />
              </div>

              <div className="p-10 rounded-[3rem] bg-indigo-600/10 border border-indigo-500/20 backdrop-blur-3xl shadow-xl relative overflow-hidden group">
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-1000" />
                <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 italic flex items-center gap-3">
                  <Calendar size={18} /> MISSION SCHEDULER
                </h3>
                <div className="space-y-5 relative z-10">
                  {missions.length > 0 ? (
                    missions.slice(0, 3).map((m, i) => (
                      <div
                        key={i}
                        className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <p className="text-sm font-black tracking-tight text-white italic uppercase">
                            {m.purpose}
                          </p>
                          <StatusBadge
                            status={m.isCertified ? 'success' : 'info'}
                            label={m.isCertified ? 'CERT' : 'LIVE'}
                          />
                        </div>
                        <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest opacity-60">
                          {m.startDate} › {m.endDate}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-14 text-center opacity-20 flex flex-col items-center border border-dashed border-white/10 rounded-2xl">
                      <Calendar size={32} className="mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                        NO UPCOMING MISSIONS
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="flex flex-col sm:flex-row gap-8 pt-16 border-t border-white/5 relative z-10">
            <button
              onClick={() => navigate('/rapports')}
              className="flex-1 flex items-center gap-6 px-10 py-8 bg-slate-900/40 rounded-[2.5rem] border border-white/5 hover:border-blue-500/40 transition-all group backdrop-blur-xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                <BarChart3
                  size={24}
                  className="text-blue-400 group-hover:text-white transition-colors"
                />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic group-hover:text-blue-400">
                  DATA CENTER
                </p>
                <p className="text-sm font-black text-white italic uppercase tracking-tighter mt-1">
                  Export Global Report
                </p>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="flex-1 flex items-center gap-6 px-10 py-8 bg-slate-900/40 rounded-[2.5rem] border border-white/5 hover:border-blue-500/40 transition-all group backdrop-blur-xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                <Users
                  size={24}
                  className="text-blue-400 group-hover:text-white transition-colors"
                />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic group-hover:text-blue-400">
                  IDENTITY ACCESS
                </p>
                <p className="text-sm font-black text-white italic uppercase tracking-tighter mt-1">
                  User Management Console
                </p>
              </div>
            </button>
          </div>
        </div>
      </ContentArea>

      {/* L'IA SAGE GEM-MINT (OMNISCIENTE & SÉCURE) */}
      <MissionMentor stats={missionStats} auditLogs={[]} households={[]} />
    </PageContainer>
  );
}
