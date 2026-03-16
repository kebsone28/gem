import { useState, useEffect } from 'react';
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
    BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fmtNum } from '../../utils/format';
import { useProject } from '../../hooks/useProject';
import { useSync } from '../../hooks/useSync';
import logger from '../../utils/logger';
import {
    KPICard,
    StatusBadge,
    ProgressBar,
    ActionBar,
    ActivityFeed,
    AlertPanel
} from '../../components/dashboards/DashboardComponents';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any>(null);
    const navigate = useNavigate();
    const { project } = useProject();
    const { forceSync } = useSync();
    const isSyncing = false;

    const [activities, setActivities] = useState<any[]>([]);
    const [perfData, setPerfData] = useState<any>(null);

    // Use primitive string to avoid object identity issues in deps
    const projId = project?.id || '';

    const households = useLiveQuery(
        async () => projId ? db.households.where('projectId').equals(projId).toArray() : [],
        [projId]
    ) || [];
    const zones = useLiveQuery(async () => db.zones.toArray(), []) || [];
    const missions = useLiveQuery(
        async () => projId ? db.missions.where('projectId').equals(projId).toArray() : [],
        [projId]
    ) || [];

    const localTotal = households.length;
    const localDone = households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length;

    useEffect(() => {
        const fetchRemoteMetrics = async () => {
            if (!project?.id) return;
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
            try {
                const [actRes, perfRes] = await Promise.all([
                    apiClient.get('monitoring/activity'),
                    apiClient.get('monitoring/performance')
                ]);
                setActivities(actRes.data.activities);
                setPerfData(perfRes.data);
            } catch (err) {
                logger.error('Failed to fetch monitoring data', err);
            }
        };
        fetchRemoteMetrics();
        fetchMonitoringData();
    }, [project?.id]);

    const handleSync = async () => {
        await forceSync();
        if (project?.id) {
            try {
                const { data } = await apiClient.get(`kpi/${project.id}`);
                setMetrics(data.metrics);
            } catch (err) {
                console.error('Failed to refresh metrics after sync', err);
            }
        }
    };

    const displayStats = metrics || {
        totalHouseholds: localTotal,
        electrifiedHouseholds: localDone,
        progressPercent: localTotal > 0 ? Math.round((localDone / localTotal) * 100) : 0,
        igppScore: 0,
        problemHouseholds: households.filter(h => h.status === 'Problème').length,
        pipeline: { murs: 0, reseau: 0, interieur: 0, validated: localDone },
        performance: { avgPerDay: 0, daysWorked: 0, avgCablePerHouse: 0, efficiencyRate: 0 },
        logistics: { kitPrepared: 0, kitLoaded: 0, gap: 0 },
        technical: { totalConsumption: 0 },
        breakdown: { byZone: [], byTeam: [] }
    };

    // Prepare activities for ActivityFeed component
    const feedActivities = activities.slice(0, 5).map(a => ({
        id: a.id || Math.random().toString(),
        type: (a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'success') as any,
        message: a.message,
        time: a.timestamp || 'À l\'instant'
    }));

    // Silence lint for unused vars if they are intended for future use or part of the larger plan
    // But since I'm fixing lints, I'll use them or comment them.
    // perfData is fetched but not yet visualised in a specific chart here (ActivityFeed uses feedActivities).
    // zones is used for localTotal etc but maybe display breakdown later.

    return (
        <div className="p-6 lg:p-10 space-y-10 bg-[#F8FAFC] min-h-full">

            {/* ── HEADER & ACTIONS ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status="info" label="Expert Dashboard" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">• {project?.name || 'Proquelec GEM'}</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">
                        Console de <span className="text-blue-600">Pilotage</span>
                    </h1>
                </div>

                <ActionBar>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                    >
                        Centre d'Actions
                        <ArrowRight size={14} />
                    </button>
                </ActionBar>
            </div>

            {/* ── LEVEL 1: GLOBAL PROGRESS ── */}
            <div className="bg-white rounded-[20px] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-50/50 to-transparent pointer-events-none" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Compass size={14} className="text-blue-600" /> Progression Globale du Projet
                        </h3>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-6xl font-black text-gray-900 tracking-tighter">{displayStats.progressPercent}%</span>
                            <span className={`text-sm font-bold ${displayStats.progressPercent > 50 ? 'text-emerald-500' : 'text-blue-500'}`}>ÉLECTRIFIÉ</span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium mb-8 max-w-md">
                            Le déploiement national progresse conformément aux objectifs techniques.
                            Le score de performance IGPP est actuellement de <span className="font-bold text-gray-900">{displayStats.igppScore}%</span>.
                        </p>

                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden p-1 border border-gray-50">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${displayStats.progressPercent}%` }}
                                className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(0,102,255,0.4)]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ménages Terminés</p>
                            <p className="text-2xl font-black text-gray-900">{fmtNum(displayStats.electrifiedHouseholds)}</p>
                            <div className="mt-2 h-1 w-12 bg-emerald-500 rounded-full" />
                        </div>
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Objectif Total</p>
                            <p className="text-2xl font-black text-gray-900">{fmtNum(displayStats.totalHouseholds)}</p>
                            <div className="mt-2 h-1 w-blue-500 bg-blue-500 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── LEVEL 2: STRATEGIC KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Ménages"
                    value={fmtNum(displayStats.totalHouseholds)}
                    icon={<Users size={20} />}
                    trend={{ value: 8, isUp: true, label: "vs mois dernier" }}
                    sparkline={[30, 45, 35, 60, 55, 80, 70]}
                />
                <KPICard
                    title="Ciblés"
                    value={fmtNum(displayStats.electrifiedHouseholds)}
                    icon={<ShieldCheck size={20} />}
                    trend={{ value: 12, isUp: true, label: "Points validés" }}
                    sparkline={[20, 30, 40, 50, 45, 65, 85]}
                />
                <KPICard
                    title="Alertes"
                    value={displayStats.problemHouseholds}
                    icon={<AlertCircle size={20} />}
                    trend={{ value: 4, isUp: false, label: "Anomalies terrain" }}
                    sparkline={[10, 20, 15, 5, 8, 12, 4]}
                />
                <KPICard
                    title="Productivité"
                    value={`${displayStats.performance?.efficiencyRate || 0}%`}
                    icon={<Zap size={20} />}
                    trend={{ value: 2, isUp: true, label: "Efficacité globale" }}
                    sparkline={[60, 65, 62, 70, 68, 75, 72]}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── LEVEL 3: OPERATIONAL METRICS (Left) ── */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-4">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={14} className="text-blue-600" /> Flux Technique Terrain {zones.length > 0 && `(${zones.length} Zones)`}
                            </h3>
                            <button onClick={() => navigate('/bordereau')} className="text-[10px] font-bold text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded-full tracking-wider uppercase">
                                Détails par zone
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                            <ProgressBar
                                label="Maçonnerie (Préparation Murs)"
                                count={`${displayStats.pipeline?.murs || 0} sites`}
                                percentage={Math.round(((displayStats.pipeline?.murs || 0) / (displayStats.totalHouseholds || 1)) * 100)}
                                status="info"
                            />
                            <ProgressBar
                                label="Réseaux Extérieurs & Distribution"
                                count={`${displayStats.pipeline?.reseau || 0} sites`}
                                percentage={Math.round(((displayStats.pipeline?.reseau || 0) / (displayStats.totalHouseholds || 1)) * 100)}
                                status="info"
                            />
                            <ProgressBar
                                label="Installations Intérieures / Kits"
                                count={`${displayStats.pipeline?.interieur || 0} sites`}
                                percentage={Math.round(((displayStats.pipeline?.interieur || 0) / (displayStats.totalHouseholds || 1)) * 100)}
                                status="info"
                            />
                            <ProgressBar
                                label="Mise en Service & Réception"
                                count={`${displayStats.electrifiedHouseholds} sites`}
                                percentage={displayStats.progressPercent}
                                status="success"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Box size={14} className="text-blue-600" /> Logistique & Kits
                            </h3>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                                    <span className="text-xs font-bold text-gray-600">KITS PRÉPARÉS</span>
                                    <span className="text-lg font-black text-gray-900">{fmtNum(displayStats.logistics?.kitPrepared || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                                    <span className="text-xs font-bold text-gray-600">CÂBLE MOY. / MÉNAGE</span>
                                    <span className="text-lg font-black text-gray-900">{displayStats.performance?.avgCablePerHouse || 0}m</span>
                                </div>
                                <div className="flex justify-between items-center border border-rose-100 bg-rose-50/30 p-4 rounded-xl">
                                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">ÉCART LOGISTIQUE</span>
                                    <span className="text-lg font-black text-rose-700">{displayStats.logistics?.gap || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Activity size={14} className="text-blue-600" /> Rendement Quotidien
                            </h3>
                            <div className="flex flex-col items-center justify-center h-full pb-8">
                                <div className="text-5xl font-black text-gray-900 mb-1">{displayStats.performance?.avgPerDay || 0}</div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Ménages / Jour (Moyenne)</p>
                                <div className="w-full h-24 flex items-end justify-between px-2 gap-1">
                                    {perfData?.dailyYield?.map((h: number, i: number) => (
                                        <div key={i} className="flex-1 bg-blue-100 rounded-t-lg group relative" style={{ height: `${h}%` }} /* eslint-disable-line no-inline-styles */>​
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-1 rounded">J{i + 1}</div>
                                        </div>
                                    )) || [40, 60, 45, 75, 80, 95, 85].map((h, i) => (
                                        <div key={i} className="flex-1 bg-blue-100 rounded-t-lg group relative" style={{ height: `${h}%` }} /* eslint-disable-line no-inline-styles */>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-1 rounded">J{i + 1}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── LEVEL 4: CONTROL & ACTIVITY (Right) ── */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm">
                        <AlertPanel>
                            {displayStats.problemHouseholds > 0 && (
                                <div className="flex gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100 mb-3">
                                    <AlertCircle size={18} className="text-rose-600 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-rose-900 tracking-tight">Anomalies Détectées</p>
                                        <p className="text-[10px] text-rose-700 mt-0.5">{displayStats.problemHouseholds} ménages nécessitent une intervention immédiate.</p>
                                    </div>
                                </div>
                            )}
                            {displayStats.syncHealth !== 'healthy' && (
                                <div className="flex gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                    <RefreshCw size={18} className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-900 tracking-tight">Synchronisation Requise</p>
                                        <p className="text-[10px] text-amber-700 mt-0.5">Le faisceau Cloud GEM présente un retard de synchronisation.</p>
                                    </div>
                                </div>
                            )}
                            {displayStats.problemHouseholds === 0 && displayStats.syncHealth === 'healthy' && (
                                <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3 opacity-30" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aucune alerte critique</p>
                                </div>
                            )}
                        </AlertPanel>
                    </div>

                    <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm h-[400px] overflow-hidden flex flex-col">
                        <ActivityFeed activities={feedActivities} />
                    </div>

                    <div className="bg-[#0D1E35] p-6 rounded-[20px] shadow-xl text-white relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
                        <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar size={14} /> Planning Missions
                        </h3>
                        <div className="space-y-4">
                            {missions.length > 0 ? missions.slice(0, 2).map((m, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold tracking-tight text-white mb-0.5">{m.purpose}</p>
                                        <StatusBadge status={m.isCertified ? 'success' : 'info'} label={m.isCertified ? 'Certifié' : 'Actif'} />
                                    </div>
                                    <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-wider">{m.startDate} au {m.endDate}</p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-400" style={{ width: '65%' }} /* eslint-disable-line no-inline-styles *//>
                                        </div>
                                        <span className="text-[9px] font-black">65%</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-10 text-center opacity-30 flex flex-col items-center">
                                    <Calendar size={24} className="mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest tracking-widest">Aucune mission</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-gray-100">
                <button onClick={() => navigate('/rapports')} className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-gray-200 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all hover:shadow-lg hover:shadow-blue-500/5 group">
                    <BarChart3 size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    Exporter Rapport Global
                </button>
                <button onClick={() => navigate('/admin/users')} className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-gray-200 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all hover:shadow-lg hover:shadow-blue-500/5 group">
                    <Users size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    Console Utilisateurs
                </button>
            </div>

        </div>
    );
}
