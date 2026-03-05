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
import './AdminDashboard.css';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any>(null);
    const navigate = useNavigate();
    const { project } = useProject();
    const { sync, isSyncing, syncStatus } = useSync();

    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];
    const syncLogs = useLiveQuery(() => db.sync_logs.orderBy('id').reverse().limit(5).toArray()) || [];
    const missions = useLiveQuery(() => db.missions.where('projectId').equals(project?.id || '').toArray(), [project?.id]) || [];

    // Local Stats cache
    const localTotal = households.length;
    const localDone = households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length;

    useEffect(() => {
        const fetchRemoteMetrics = async () => {
            if (!project?.id) return;

            // Check if we have a token before making the request to avoid 401 in console
            const token = localStorage.getItem('access_token');
            if (!token) return;

            try {
                const response = await apiClient.get(`/kpi/${project.id}`);

                if (response.status === 200 && response.data?.metrics) {
                    setMetrics(response.data.metrics);
                }
            } catch (err: any) {
                // Ignore 401 as handled by interceptors, other 500+ errors are logged
                if (err.response?.status !== 401) {
                    console.error('Failed to fetch metrics', err);
                }
            }
        };
        fetchRemoteMetrics();
    }, [project?.id]);

    useEffect(() => {
        // Logique de récupération des métriques initiales
    }, [syncLogs]);

    // Simplified handleSync using global hook
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
        <div className="p-6 md:p-10 space-y-12 bg-slate-50/5 dark:bg-slate-950/20 min-h-full relative overflow-hidden">
            {/* Background blobs for WOW effect */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(79,70,229,0.3)] rotate-[-4deg] group hover:rotate-0 transition-transform duration-500">
                        <Activity className="text-white" size={32} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-800 dark:text-white leading-none">Command Console</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded-md border border-indigo-500/20 uppercase tracking-widest">Enterprise</span>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest opacity-60">
                                {project?.name || 'Proquelec GEM'} • {syncStatus === 'success' ? 'Synchronized' : 'Live Analytics'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:border-indigo-500 hover:text-indigo-500 shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing...' : 'Force Sync'}
                    </button>
                    <button
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:shadow-indigo-500/50 active:scale-95"
                    >
                        Action Center
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-8">
                    <div className="glass-card !p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="relative z-10 text-center">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Performance Score (IGPP)</h3>
                            <div className="relative w-52 h-52 mx-auto">
                                <svg className="w-full h-full transform -rotate-90">
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
                                        className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter"
                                    >
                                        {displayStats.igppScore}%
                                    </motion.span>
                                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.3em] mt-1">Network Accuracy</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-[9px] mt-10 leading-relaxed font-bold tracking-widest opacity-60 uppercase italic">
                                GEM Project Management Index
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="glass-card !p-6 !rounded-[2rem]">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-3">Sync Health</p>
                            <div className="flex items-center gap-3">
                                <div className="relative flex">
                                    <div className={`w-3 h-3 rounded-full ${displayStats.syncHealth === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${displayStats.syncHealth === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'} animate-ping opacity-75`} />
                                </div>
                                <span className="font-black text-[11px] uppercase tracking-tighter text-slate-700 dark:text-slate-200">{displayStats.syncHealth === 'healthy' ? 'OPTIMIZED' : 'WARNING'}</span>
                            </div>
                        </div>
                        <div className="glass-card !p-6 !rounded-[2rem] border-l-4 border-l-indigo-500">
                            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-3">Active Zones</p>
                            <div className="text-3xl font-black text-indigo-500 tracking-tighter">{zones.length}</div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="glass-card !p-8 flex items-center gap-6 border-b-4 border-b-blue-500 group">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><Users size={28} strokeWidth={2.5} /></div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1">Ménages</p>
                                <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter whitespace-nowrap">{fmtNum(displayStats.totalHouseholds)}</h4>
                            </div>
                        </div>
                        <div className="glass-card !p-8 flex items-center gap-6 border-b-4 border-b-emerald-500 group">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform"><ShieldCheck size={28} strokeWidth={2.5} /></div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1">Ciblés</p>
                                <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter whitespace-nowrap">{fmtNum(displayStats.electrifiedHouseholds)}</h4>
                            </div>
                        </div>
                        <div className="glass-card !p-8 flex items-center gap-6 border-b-4 border-b-rose-500 group">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform"><AlertCircle size={28} strokeWidth={2.5} /></div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1">Alertes</p>
                                <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter whitespace-nowrap">{displayStats.problemHouseholds}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Module Performance - Statistiques Avancées Opérationnelles */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm border-l-4 border-l-indigo-500 transition-all hover:scale-[1.02]">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">📦 Logistique Kits</p>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white font-mono">{fmtNum(displayStats.logistics?.kitPrepared || 0)} Prêts</h4>
                            <div className="text-[7px] text-slate-400 uppercase mt-1 italic">Ecart Livraison: <span className={displayStats.logistics?.gap ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>{displayStats.logistics?.gap || 0}</span></div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm border-l-4 border-l-blue-500 transition-all hover:scale-[1.02]">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">🔌 Optimisation Câble</p>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white font-mono">{displayStats.performance?.avgCablePerHouse || 0}m <span className="text-[10px] font-normal opacity-50">/ ménage</span></h4>
                            <div className="text-[7px] text-slate-400 uppercase mt-1 italic">Moyenne Technique Réelle</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm border-l-4 border-l-emerald-500 transition-all hover:scale-[1.02]">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">⚡ Rendement / Jour</p>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white font-mono">{displayStats.performance?.avgPerDay || 0} <span className="text-[10px] font-normal opacity-50">élec. / jour</span></h4>
                            <div className="text-[7px] text-slate-400 uppercase mt-1 italic">Sur {displayStats.performance?.daysWorked || 0} jours actifs</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm border-l-4 border-l-amber-500 transition-all hover:scale-[1.02]">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">🚀 Efficacité Projet</p>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white font-mono">{displayStats.performance?.efficiencyRate || 0}%</h4>
                            <div className="text-[7px] text-slate-400 uppercase mt-1 italic">Taux d'Achèvement Net</div>
                        </div>
                    </div>

                    <div className="glass-card !p-10 !rounded-[3rem]">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 italic text-indigo-600 dark:text-indigo-400">
                                <HardHat size={20} strokeWidth={3} /> Pipeline Tech Terrain
                            </h3>
                        </div>
                        <div className="space-y-8">
                            {[
                                { label: 'Maçonnerie (Murs)', count: displayStats.pipeline?.murs || 0, color: 'text-indigo-500', bg: 'bg-indigo-500' },
                                { label: 'Réseaux Extérieurs', count: displayStats.pipeline?.reseau || 0, color: 'text-blue-500', bg: 'bg-blue-500' },
                                { label: 'Installations Intérieures', count: displayStats.pipeline?.interieur || 0, color: 'text-violet-500', bg: 'bg-violet-500' },
                                { label: 'Mise en Service', count: displayStats.electrifiedHouseholds, color: 'text-emerald-500', bg: 'bg-emerald-500' },
                            ].map((step, i) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between items-end mb-3">
                                        <div className="flex items-center gap-4">
                                            <div className="text-[12px] font-black opacity-30">0{i + 1}</div>
                                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">{step.label}</span>
                                        </div>
                                        <span className={`text-[12px] font-black uppercase ${step.color}`}>{step.count} Units</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5">
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

            {/* Drill-down Module - NEW: DÉTAILS GRANULAIRES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
                {/* 📍 Performance Par Zone */}
                <div className="glass-card !p-8 !rounded-[2.5rem]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 mb-8 text-slate-500">
                        <MapIcon size={18} className="text-emerald-500" /> Geographic Performance (Zones)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5">
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Zone</th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Efficiency</th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {displayStats.breakdown?.byZone.map((z: any, i: number) => (
                                    <tr key={i} className="group hover:bg-indigo-500/5 transition-colors">
                                        <td className="py-5">
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-slate-700 dark:text-slate-200">{z.name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{z.done} / {z.total} Households</span>
                                            </div>
                                        </td>
                                        <td className="py-5 text-center">
                                            <span className="text-[10px] font-black font-mono text-slate-500">{fmtNum(z.cable)}m</span>
                                        </td>
                                        <td className="py-5 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div className={`h-full bg-emerald-500 w-[${z.progress}%] shadow-[0_0_10px_rgba(16,185,129,0.4)]`} />
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

                {/* 👷 Performance Par Équipe (Utilisateur) */}
                <div className="glass-card !p-8 !rounded-[2.5rem]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 mb-8 text-slate-500">
                        <Activity size={18} className="text-indigo-500" /> Human Capital Yield (Teams)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5">
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Technician / Lead</th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Output</th>
                                    <th className="pb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Yield/Day</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {displayStats.breakdown?.byTeam.map((t: any, i: number) => (
                                    <tr key={i} className="group hover:bg-indigo-500/5 transition-colors">
                                        <td className="py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
                                                    {t.worker.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-slate-700 dark:text-slate-200">{t.worker}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Field Operative</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5">
                                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">{t.done} <span className="opacity-40 font-normal">Units</span></span>
                                        </td>
                                        <td className="py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[12px] font-black text-indigo-500">{t.yield} <span className="text-[9px] opacity-60 font-normal text-slate-400">e/j</span></span>
                                                <span className="text-[7px] text-slate-400 uppercase font-black">{t.days} Days Active</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 🗓️ Live Missions Gantt Timeline - NEW PREMIUM WIDGET */}
            <div className="glass-card !p-10 !rounded-[3rem] overflow-hidden relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="flex items-center justify-between mb-12 relative z-10">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 italic text-slate-800 dark:text-white">
                            <Activity size={20} className="text-indigo-500 animate-pulse" /> Deployment Gantt Control
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 ml-8">Mission Lifecycle Management</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px] font-black text-slate-400 uppercase">Certified</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <span className="text-[9px] font-black text-slate-400 uppercase">Active</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-10 relative z-10">
                    {missions.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] bg-slate-50/50 dark:bg-white/1">
                            <MapPin size={48} className="text-slate-200 dark:text-white/5 mb-6" />
                            <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">Zero Active Deployments Detected</p>
                            <button onClick={() => navigate('/admin/mission')} className="mt-6 px-6 py-3 bg-indigo-600/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Create Launch Protocol</button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {missions.map((m, i) => {
                                const completed = m.reportDays?.filter((d: any) => d.isCompleted).length || 0;
                                const total = m.reportDays?.length || 1;
                                const progress = Math.round((completed / total) * 100);

                                return (
                                    <div key={i} className="group relative">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-indigo-500/20 text-white font-black text-sm rotate-[-3deg] group-hover:rotate-0 transition-transform">
                                                    {m.region?.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-[14px] font-black text-slate-800 dark:text-white leading-tight uppercase tracking-tight">{m.purpose || 'Mission sans objet'}</h4>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className="text-[10px] font-black text-indigo-500/80 font-mono tracking-tight underline opacity-80">{m.orderNumber}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.startDate} — {m.endDate}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-[10px] font-black px-4 py-2 rounded-xl inline-block border ${m.isCertified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'} tracking-widest`}>
                                                    {m.isCertified ? 'MISSION CERTIFIED' : 'IN PROGRESS'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex-1 h-3.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/10 shadow-inner">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    className={`h-full rounded-full shadow-[0_0_15px] ${progress === 100 ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-indigo-500 shadow-indigo-500/30'}`}
                                                />
                                            </div>
                                            <span className="text-[12px] font-black text-slate-800 dark:text-white w-10 text-right">{progress}%</span>
                                        </div>

                                        {/* Micro Timeline Steps */}
                                        <div className="flex gap-1.5 mt-4 ml-[76px]">
                                            {m.reportDays?.map((rd: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    title={rd.title}
                                                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${rd.isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-white/10'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <footer className="flex flex-wrap items-center gap-4">
                <button onClick={() => navigate('/rapports')} className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-600 dark:text-slate-300 shadow-sm">
                    <BarChart3 size={14} className="text-indigo-500" /> Générer Rapport Global
                </button>
                <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-600 dark:text-slate-300 shadow-sm">
                    <Users size={14} className="text-indigo-500" /> Gérer Techniciens
                </button>
            </footer>
        </div>
    );
}
