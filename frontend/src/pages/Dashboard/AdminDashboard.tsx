import { useState, useEffect } from 'react';
import { db } from '../../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import apiClient from '../../api/client';
import {
    Users, RefreshCw,
    Activity, MapPin,
    BarChart3, ShieldCheck, HardHat, AlertCircle, Map as MapIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fmtNum } from '../../utils/format';
import { useProject } from '../../hooks/useProject';
import { useSync } from '../../hooks/useSync';
import LiveActivityFeed from '../../components/dashboards/LiveActivityFeed';
import PerformanceCompare from '../../components/dashboards/PerformanceCompare';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any>(null);
    const navigate = useNavigate();
    const { project } = useProject();
    const { sync, isSyncing, syncStatus } = useSync();

    const [activities, setActivities] = useState<any[]>([]);
    const [perfData, setPerfData] = useState<any>(null);

    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];
    const syncLogs = useLiveQuery(() => db.sync_logs.orderBy('id').reverse().limit(5).toArray()) || [];
    const missions = useLiveQuery(() => db.missions.where('projectId').equals(project?.id || '').toArray(), [project?.id]) || [];

    const localTotal = households.length;
    const localDone = households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length;

    useEffect(() => {
        const fetchRemoteMetrics = async () => {
            if (!project?.id) return;
            const token = localStorage.getItem('access_token');
            if (!token) return;
            try {
                const response = await apiClient.get(`/kpi/${project.id}`);
                if (response.status === 200 && response.data?.metrics) {
                    setMetrics(response.data.metrics);
                }
            } catch (err: any) {
                if (err.response?.status !== 401) console.error('Failed to fetch metrics', err);
            }
        };
        const fetchMonitoringData = async () => {
            try {
                const [actRes, perfRes] = await Promise.all([
                    apiClient.get('/monitoring/activity'),
                    apiClient.get('/monitoring/performance')
                ]);
                setActivities(actRes.data.activities);
                setPerfData(perfRes.data);
            } catch (err) {
                console.error('Failed to fetch monitoring data', err);
            }
        };
        fetchRemoteMetrics();
        fetchMonitoringData();
    }, [project?.id]);

    useEffect(() => { }, [syncLogs]);

    const handleSync = async () => {
        await sync();
        if (project?.id) {
            try {
                const { data } = await apiClient.get(`/kpi/${project.id}`);
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

    return (
        <div className="p-4 md:p-6 lg:p-10 space-y-8 md:space-y-12 bg-slate-50/5 dark:bg-slate-950/20 min-h-full relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

            {/* ── Header ── */}
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
                <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(79,70,229,0.3)] rotate-[-4deg] hover:rotate-0 transition-transform duration-500 shrink-0">
                        <Activity className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter italic text-slate-800 dark:text-white leading-none">
                            Console <span className="hidden sm:inline">de Commande</span>
                        </h2>
                        <div className="flex items-center gap-2 md:gap-3 mt-1 md:mt-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded-md border border-indigo-500/20 uppercase tracking-widest">Expert</span>
                            <p className="text-slate-500 text-[10px] md:text-[11px] font-bold uppercase tracking-widest opacity-60">
                                {project?.name || 'Proquelec GEM'} • {syncStatus === 'success' ? 'Synchronisé' : 'Live'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:border-indigo-500 hover:text-indigo-500 shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">{isSyncing ? 'Synchronisation...' : 'Forcer la Sync'}</span>
                        <span className="sm:hidden">Sync</span>
                    </button>
                    <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-8 py-3 md:py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] transition-all shadow-[0_15px_30px_rgba(79,70,229,0.3)] active:scale-95 whitespace-nowrap">
                        <span className="hidden sm:inline">Centre d'Actions</span>
                        <span className="sm:hidden">Actions</span>
                    </button>
                </div>
            </header>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Left col: IGPP + mini cards */}
                <div className="lg:col-span-4 space-y-4 md:space-y-8">
                    <div className="glass-card !p-5 md:!p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="relative z-10 text-center">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-5 md:mb-8">Score de Performance (IGPP)</h3>
                            <div className="relative w-32 h-32 md:w-52 md:h-52 mx-auto">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 208 208">
                                    <circle cx="104" cy="104" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-white/5" />
                                    <motion.circle
                                        cx="104" cy="104" r="88" stroke="currentColor" strokeWidth="12" fill="transparent"
                                        strokeDasharray={552.64}
                                        initial={{ strokeDashoffset: 552.64 }}
                                        animate={{ strokeDashoffset: 552.64 - (552.64 * (displayStats.igppScore / 100)) }}
                                        transition={{ duration: 2, ease: "circOut" }}
                                        className="text-indigo-500" strokeLinecap="round"
                                        style={{ filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <motion.span
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter"
                                    >
                                        {displayStats.igppScore}%
                                    </motion.span>
                                    <span className="text-[8px] font-black uppercase text-indigo-500 tracking-[0.2em] mt-1">Précision Réseau</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-[9px] mt-4 md:mt-10 leading-relaxed font-bold tracking-widest opacity-60 uppercase italic">
                                Indice de Gestion de Projet GEM
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-6">
                        <div className="glass-card !p-4 md:!p-6 !rounded-[1.5rem] md:!rounded-[2rem]">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Santé Sync</p>
                            <div className="flex items-center gap-2">
                                <div className="relative flex shrink-0">
                                    <div className={`w-3 h-3 rounded-full ${displayStats.syncHealth === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${displayStats.syncHealth === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'} animate-ping opacity-75`} />
                                </div>
                                <span className="font-black text-[10px] uppercase tracking-tighter text-slate-700 dark:text-slate-200">{displayStats.syncHealth === 'healthy' ? 'OK' : 'ALERTE'}</span>
                            </div>
                        </div>
                        <div className="glass-card !p-4 md:!p-6 !rounded-[1.5rem] md:!rounded-[2rem] border-l-4 border-l-indigo-500">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Zones</p>
                            <div className="text-2xl md:text-3xl font-black text-indigo-500 tracking-tighter">{zones.length}</div>
                        </div>
                    </div>
                </div>

                {/* Right col */}
                <div className="lg:col-span-8 space-y-4 md:space-y-8">
                    {/* KPI Cards — 1 col mobile, 3 col tablet+ */}
                    <div className="grid grid-cols-3 gap-3 md:gap-8">
                        {[
                            { label: 'Ménages', value: fmtNum(displayStats.totalHouseholds), icon: Users, colorBg: 'bg-blue-500/10', colorText: 'text-blue-500', colorBorder: 'border-b-blue-500' },
                            { label: 'Ciblés', value: fmtNum(displayStats.electrifiedHouseholds), icon: ShieldCheck, colorBg: 'bg-emerald-500/10', colorText: 'text-emerald-500', colorBorder: 'border-b-emerald-500' },
                            { label: 'Alertes', value: displayStats.problemHouseholds, icon: AlertCircle, colorBg: 'bg-rose-500/10', colorText: 'text-rose-500', colorBorder: 'border-b-rose-500' },
                        ].map(({ label, value, icon: Icon, colorBg, colorText, colorBorder }) => (
                            <div key={label} className={`glass-card !p-3 md:!p-8 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-6 border-b-4 ${colorBorder} group`}>
                                <div className={`w-8 h-8 md:w-16 md:h-16 ${colorBg} rounded-xl md:rounded-3xl flex items-center justify-center ${colorText} group-hover:scale-110 transition-transform shrink-0`}>
                                    <Icon size={16} strokeWidth={2.5} className="md:hidden" />
                                    <Icon size={28} strokeWidth={2.5} className="hidden md:block" />
                                </div>
                                <div>
                                    <p className="text-[8px] md:text-[11px] font-black uppercase text-slate-500 tracking-widest mb-0.5 md:mb-1">{label}</p>
                                    <h4 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</h4>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Perf mini stats — 2 col mobile, 4 col tablet+ */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {[
                            { emoji: '📦', label: 'Kits Prêts', value: fmtNum(displayStats.logistics?.kitPrepared || 0), sub: `Écart: ${displayStats.logistics?.gap || 0}`, accent: 'border-l-indigo-500' },
                            { emoji: '🔌', label: 'Câble/Ménage', value: `${displayStats.performance?.avgCablePerHouse || 0}m`, sub: 'Moy. technique', accent: 'border-l-blue-500' },
                            { emoji: '⚡', label: 'Rend./Jour', value: `${displayStats.performance?.avgPerDay || 0}`, sub: `${displayStats.performance?.daysWorked || 0}j actifs`, accent: 'border-l-emerald-500' },
                            { emoji: '🚀', label: 'Efficacité', value: `${displayStats.performance?.efficiencyRate || 0}%`, sub: "Taux d'achèvement", accent: 'border-l-amber-500' },
                        ].map(({ emoji, label, value, sub, accent }) => (
                            <div key={label} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border-l-4 ${accent} hover:scale-[1.02] transition-transform`}>
                                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">{emoji} {label}</p>
                                <h4 className="text-sm md:text-lg font-black text-slate-900 dark:text-white font-mono">{value}</h4>
                                <div className="text-[7px] text-slate-400 uppercase mt-1 italic">{sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Flux Technique */}
                    <div className="glass-card !p-5 md:!p-10 !rounded-[2rem] md:!rounded-[3rem]">
                        <div className="flex items-center justify-between mb-5 md:mb-10">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2 italic text-indigo-600 dark:text-indigo-400">
                                <HardHat size={16} strokeWidth={3} />
                                <span className="hidden sm:inline">Flux Technique Terrain</span>
                                <span className="sm:hidden">Flux Terrain</span>
                            </h3>
                        </div>
                        <div className="space-y-4 md:space-y-8">
                            {[
                                { label: 'Maçonnerie (Murs)', count: displayStats.pipeline?.murs || 0, color: 'text-indigo-500', bg: 'bg-indigo-500' },
                                { label: 'Réseaux Extérieurs', count: displayStats.pipeline?.reseau || 0, color: 'text-blue-500', bg: 'bg-blue-500' },
                                { label: 'Installations Intérieures', count: displayStats.pipeline?.interieur || 0, color: 'text-violet-500', bg: 'bg-violet-500' },
                                { label: 'Mise en Service', count: displayStats.electrifiedHouseholds, color: 'text-emerald-500', bg: 'bg-emerald-500' },
                            ].map((step, i) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex items-center gap-2 md:gap-4">
                                            <div className="text-[11px] font-black opacity-30">0{i + 1}</div>
                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">{step.label}</span>
                                        </div>
                                        <span className={`text-[11px] font-black uppercase ${step.color}`}>{step.count}</span>
                                    </div>
                                    <div className="h-1.5 md:h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(step.count / (displayStats.totalHouseholds || 1)) * 100}%` }}
                                            className={`h-full rounded-full shadow-lg ${step.bg}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Live Intelligence ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative z-10">
                <div className="lg:col-span-12 py-3 border-y border-slate-100 dark:border-white/5 bg-slate-500/5 -mx-4 md:-mx-10 px-4 md:px-10">
                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500 flex items-center gap-3">
                        <Activity size={14} className="animate-pulse" /> Live Intelligence
                    </h3>
                </div>

                <div className="lg:col-span-7">
                    <div className="glass-card !p-4 md:!p-8 !rounded-[2rem] md:!rounded-[2.5rem] h-full">
                        <div className="flex items-center justify-between mb-4 md:mb-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Flux d'Activité</h3>
                            <span className="px-2 py-1 bg-indigo-500 text-white text-[8px] font-black rounded-lg animate-pulse">LIVE</span>
                        </div>
                        <LiveActivityFeed activities={activities} />
                    </div>
                </div>

                <div className="lg:col-span-5">
                    <div className="glass-card !p-4 md:!p-8 !rounded-[2rem] md:!rounded-[2.5rem] h-full border-r-4 border-r-emerald-500/30">
                        <PerformanceCompare data={perfData} />
                    </div>
                </div>
            </div>

            {/* ── Drill-down ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
                {/* Par Zone */}
                <div className="glass-card !p-4 md:!p-8 !rounded-[2rem] md:!rounded-[2.5rem]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-4 md:mb-8 text-slate-500">
                        <MapIcon size={15} className="text-emerald-500" /> Performance Géographique
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[260px]">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5">
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Zone</th>
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Câble</th>
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Prog.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {displayStats.breakdown?.byZone.map((z: any, i: number) => (
                                    <tr key={i} className="group hover:bg-indigo-500/5 transition-colors">
                                        <td className="py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{z.name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{z.done}/{z.total}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className="text-[10px] font-black font-mono text-slate-500">{fmtNum(z.cable)}m</span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-10 md:w-16 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 progress-bar-dynamic" data-progress={z.progress} style={{ width: `${Math.min(Math.max(z.progress, 0), 100)}%` }} />
                                                </div>
                                                <span className="text-[11px] font-black text-emerald-500">{z.progress}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Par Équipe */}
                <div className="glass-card !p-4 md:!p-8 !rounded-[2rem] md:!rounded-[2.5rem]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-4 md:mb-8 text-slate-500">
                        <Activity size={15} className="text-indigo-500" /> Rendement Équipes
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[240px]">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5">
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Technicien</th>
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Perf.</th>
                                    <th className="pb-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">R/J</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {displayStats.breakdown?.byTeam.map((t: any, i: number) => (
                                    <tr key={i} className="group hover:bg-indigo-500/5 transition-colors">
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                                                    {t.worker.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[70px]">{t.worker}</span>
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">{t.done}</span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className="text-[12px] font-black text-indigo-500">{t.yield}<span className="text-[8px] opacity-50 ml-0.5">e/j</span></span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Gantt Missions ── */}
            <div className="glass-card !p-5 md:!p-10 !rounded-[2rem] md:!rounded-[3rem] overflow-hidden relative">
                <div className="absolute top-0 right-0 w-[200px] md:w-[500px] h-[200px] md:h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-12 gap-3 relative z-10">
                    <div>
                        <h3 className="text-base md:text-xl font-black uppercase tracking-tighter flex items-center gap-3 italic text-slate-800 dark:text-white">
                            <Activity size={18} className="text-indigo-500 animate-pulse" /> Contrôle Gantt
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestion des Missions</p>
                    </div>
                    <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" />Certifié</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" />Actif</div>
                    </div>
                </div>

                <div className="space-y-5 md:space-y-10 relative z-10">
                    {missions.length === 0 ? (
                        <div className="py-10 md:py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2rem] bg-slate-50/50 dark:bg-white/1">
                            <MapPin size={32} className="text-slate-200 dark:text-white/5 mb-4" />
                            <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">Aucun Déploiement Actif</p>
                            <button onClick={() => navigate('/admin/mission')} className="mt-4 px-6 py-3 bg-indigo-600/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Lancer une Mission</button>
                        </div>
                    ) : (
                        <div className="space-y-5 md:space-y-8">
                            {missions.map((m, i) => {
                                const completed = m.reportDays?.filter((d: any) => d.isCompleted).length || 0;
                                const total = m.reportDays?.length || 1;
                                const progress = Math.round((completed / total) * 100);
                                return (
                                    <div key={i} className="group relative">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-indigo-500/20 text-white font-black text-sm shrink-0">
                                                    {m.region?.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-[12px] md:text-[14px] font-black text-slate-800 dark:text-white leading-tight uppercase">{m.purpose || 'Mission sans objet'}</h4>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-[9px] font-black text-indigo-500/80 font-mono">{m.orderNumber}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{m.startDate} — {m.endDate}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-[9px] font-black px-3 py-1 rounded-xl inline-block border self-start ${m.isCertified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'} tracking-widest uppercase`}>
                                                {m.isCertified ? 'Certifiée' : 'En cours'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/10 shadow-inner">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                />
                                            </div>
                                            <span className="text-[12px] font-black text-slate-800 dark:text-white w-9 text-right">{progress}%</span>
                                        </div>
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            {m.reportDays?.slice(0, 20).map((rd: any, idx: number) => (
                                                <div key={idx} title={rd.title} className={`h-1.5 w-3 md:w-4 rounded-full transition-all ${rd.isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => navigate('/rapports')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-600 dark:text-slate-300 shadow-sm">
                    <BarChart3 size={14} className="text-indigo-500" /> Rapport Global
                </button>
                <button onClick={() => navigate('/admin/users')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-600 dark:text-slate-300 shadow-sm">
                    <Users size={14} className="text-indigo-500" /> Gérer Techniciens
                </button>
            </footer>
        </div>
    );
}
