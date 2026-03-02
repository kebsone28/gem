import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, TrendingUp, AlertCircle, MapPin, FileText, ArrowRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';

export default function ClientDashboard() {
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();

    // ─── Live Dexie data ──────────────────────────────────────────
    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];

    const total = households.length;
    const done = households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length;
    const inProgress = households.filter(h => !['Non débuté', 'Terminé', 'Réception: Validée', 'Inéligible', 'Problème'].includes(h.status ?? '')).length;
    const pending = households.filter(h => h.status === 'Non débuté').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 68;

    // Recent validated households (last 5 "Terminé")
    const recentValidated = households
        .filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée')
        .slice(-5)
        .reverse();

    // Regional breakdown (top 4 by total)
    const regionData: Record<string, { done: number; total: number }> = {};
    households.forEach(h => {
        const zone = zones.find(z => z.id === h.zoneId);
        const r = zone?.region ?? zone?.name ?? 'Inconnue';
        if (!regionData[r]) regionData[r] = { done: 0, total: 0 };
        regionData[r].total++;
        if (h.status === 'Terminé' || h.status === 'Réception: Validée') regionData[r].done++;
    });
    const topRegions = Object.entries(regionData)
        .map(([name, { done: d, total: t }]) => ({ name, done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4);

    const baseCard = isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-sm';

    const kpis = [
        { label: 'Total Ménages', value: total > 0 ? fmtNum(total) : '—', icon: Users, bg: 'bg-indigo-500/10 text-indigo-400', sub: 'dans la zone projet' },
        { label: 'Raccordés', value: total > 0 ? fmtNum(done) : '—', icon: CheckCircle2, bg: 'bg-emerald-500/10 text-emerald-400', sub: `${pct}% d'avancement` },
        { label: 'En Cours', value: total > 0 ? fmtNum(inProgress) : '—', icon: Activity, bg: 'bg-blue-500/10 text-blue-400', sub: 'travaux en cours' },
        { label: 'En Attente', value: total > 0 ? fmtNum(pending) : '—', icon: AlertCircle, bg: 'bg-amber-500/10 text-amber-400', sub: 'Non commencés' },
    ];

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={`text-4xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Suivi d'Avancement
                    </h2>
                    <p className={`text-[13px] font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {total > 0
                            ? `${fmtNum(total)} ménages suivis — ${pct}% raccordés`
                            : 'Données en attente de synchronisation Kobo.'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/rapports')}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-500/20 transition-all"
                >
                    <FileText size={15} /> Générer un Rapport
                </button>
            </header>

            {/* Progress banner */}
            <div className={`p-6 rounded-[2rem] border ${baseCard} flex flex-col md:flex-row items-center gap-6`}>
                <div className="flex-1 w-full">
                    <div className="flex justify-between text-sm font-bold mb-2">
                        <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>Progression Globale du Projet</span>
                        <span className={`font-black text-lg ${pct >= 70 ? 'text-emerald-400' : 'text-indigo-400'}`}>{pct}%</span>
                    </div>
                    <div className={`h-4 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <motion.div
                            className={`h-4 rounded-full ${pct >= 70 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                        <span>Démarrage</span>
                        <span>{fmtNum(done)} / {fmtNum(total)} ménages terminés</span>
                        <span>Objectif 100%</span>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className={`p-6 rounded-[2rem] border ${baseCard}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.bg}`}>
                            <kpi.icon size={18} />
                        </div>
                        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</div>
                        <div className={`text-3xl font-black tracking-tighter mb-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-500">{kpi.sub}</div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Regional breakdown */}
                <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border ${baseCard}`}>
                    <h3 className={`text-lg font-black tracking-tighter mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <MapPin size={20} className="text-indigo-400" /> Avancement par Région
                    </h3>
                    {topRegions.length > 0 ? (
                        <div className="space-y-5">
                            {topRegions.map((r, i) => (
                                <motion.div key={r.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{r.name}</span>
                                        <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                                            {fmtNum(r.done)} / {fmtNum(r.total)} ({r.pct}%)
                                        </span>
                                    </div>
                                    <div className={`h-2.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <motion.div
                                            className={`h-2.5 rounded-full ${r.pct >= 70 ? 'bg-emerald-500' : r.pct >= 40 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${r.pct}%` }}
                                            transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-10 text-center space-y-3">
                            <MapPin size={32} className="text-slate-500" />
                            <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                Les données régionales apparaîtront après synchronisation.
                            </p>
                        </div>
                    )}
                </div>

                {/* Recent validations */}
                <div className={`p-6 rounded-[2rem] border ${baseCard}`}>
                    <h3 className={`text-sm font-black mb-5 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <TrendingUp size={16} className="text-emerald-400" /> Dernières Validations
                    </h3>
                    {recentValidated.length > 0 ? (
                        <div className="space-y-3">
                            {recentValidated.map((h, i) => {
                                const zone = zones.find(z => z.id === h.zoneId);
                                return (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-800/40' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <CheckCircle2 size={14} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className={`text-[11px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                                {h.id?.toString().substring(0, 12) || `MEN-${1000 + i}`}
                                            </p>
                                            <p className="text-[10px] text-slate-500">{zone?.name ?? 'Zone inconnue'}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 space-y-2">
                            <CheckCircle2 size={28} className="mx-auto text-slate-500" />
                            <p className="text-[11px] text-slate-500">Aucune validation pour l'instant.</p>
                            <button onClick={() => navigate('/rapports')} className="text-indigo-400 font-black text-[10px] flex items-center gap-1 mx-auto hover:gap-2 transition-all">
                                Voir les rapports <ArrowRight size={11} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
