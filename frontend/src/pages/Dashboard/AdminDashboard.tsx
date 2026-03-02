import { useState, useEffect } from 'react';
import { db } from '../../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import apiClient from '../../api/client';
import {
    Users, RefreshCw, Database, CheckCircle2,
    Zap, Clock, Activity, MapPin,
    ArrowRight, AlertCircle, BarChart3
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fmtNum } from '../../utils/format';

export default function AdminDashboard() {
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();

    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];
    const syncLogs = useLiveQuery(() => db.sync_logs.orderBy('id').reverse().limit(5).toArray()) || [];

    const total = households.length;
    const done = households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length;
    const inProgress = households.filter(h => h.status && !['Non débuté', 'Terminé', 'Réception: Validée', 'Inéligible', 'Problème'].includes(h.status)).length;
    const problems = households.filter(h => h.status === 'Problème' || h.status === 'Inéligible').length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 84;

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

    useEffect(() => {
        const getLastSync = async () => {
            const lastLog = await db.sync_logs.orderBy('id').last();
            if (lastLog) {
                const d = new Date(lastLog.timestamp);
                setLastSync(`${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
            }
        };
        getLastSync();
    }, [syncLogs]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { data: pullData } = await apiClient.get('/sync/pull');
            for (const table of Object.keys(pullData.changes)) {
                const items = pullData.changes[table];
                for (const item of items) {
                    if (item.deletedAt) {
                        await (db as any)[table].delete(item.id);
                    } else {
                        await (db as any)[table].put(item);
                    }
                }
            }
            await db.sync_logs.add({ timestamp: new Date(), action: 'PULL_SUCCESS', details: {} });
            const now = new Date();
            setLastSync(`${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setSyncing(false);
        }
    };

    const statCards = [
        {
            label: 'Total Ménages',
            value: total > 0 ? fmtNum(total) : '—',
            icon: Users,
            accent: 'text-primary',
            accentBg: 'bg-primary/10',
            sub: total > 0 ? `${fmtNum(done)} terminés` : 'En attente de sync',
        },
        {
            label: 'Avancement Global',
            value: `${completionPct}%`,
            icon: CheckCircle2,
            accent: 'text-success',
            accentBg: 'bg-success/10',
            sub: `${fmtNum(inProgress)} en cours`,
        },
        {
            label: 'Zones Actives',
            value: zones.length > 0 ? fmtNum(zones.length) : '—',
            icon: MapPin,
            accent: 'text-accent',
            accentBg: 'bg-accent/10',
            sub: `${topRegions.length} régions`,
        },
        {
            label: 'Alertes Terrain',
            value: problems > 0 ? fmtNum(problems) : '0',
            icon: problems > 0 ? AlertCircle : CheckCircle2,
            accent: problems > 0 ? 'text-danger' : 'text-success',
            accentBg: problems > 0 ? 'bg-danger/10' : 'bg-success/10',
            sub: 'Problèmes / Inéligibles',
        },
    ];

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>
                        Dashboard Global
                    </h2>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>
                        {total > 0
                            ? `${fmtNum(total)} ménages — ${completionPct}% complétés`
                            : 'Synchronisez les données pour voir les statistiques.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastSync && (
                        <span className={`hidden lg:flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-[var(--radius-full)] border ${isDarkMode ? 'bg-dark-surface border-dark-border text-dark-text-muted' : 'bg-surface-elevated border-border text-text-muted'}`}>
                            <CheckCircle2 size={12} className="text-success" /> {lastSync}
                        </span>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="btn-primary flex items-center gap-2 text-xs disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sync...' : 'SYNCHRONISER'}
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {statCards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="kpi-card"
                    >
                        <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center mb-4 ${card.accentBg}`}>
                            <card.icon size={18} className={card.accent} />
                        </div>
                        <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>{card.label}</div>
                        <div className={`text-3xl font-bold tracking-tight mb-1 ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>{card.value}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>{card.sub}</div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Regional Progress */}
                <div className={`lg:col-span-2 card p-8`}>
                    <h3 className={`text-lg font-bold tracking-tight mb-6 flex items-center gap-2 ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>
                        <BarChart3 size={20} className="text-primary" /> Avancement par Région
                        {total > 0 && (
                            <span className="ml-auto text-[10px] font-semibold bg-success/10 text-success border border-success/20 px-3 py-1 rounded-[var(--radius-full)] flex items-center gap-1">
                                <Activity size={10} /> Temps réel
                            </span>
                        )}
                    </h3>

                    {topRegions.length > 0 ? (
                        <div className="space-y-5">
                            {topRegions.map((r, i) => (
                                <motion.div key={r.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                                    <div className="flex justify-between text-sm font-medium mb-2">
                                        <span className={isDarkMode ? 'text-dark-text' : 'text-text'}>{r.name}</span>
                                        <span className={isDarkMode ? 'text-dark-text-secondary' : 'text-text-secondary'}>
                                            {fmtNum(r.done)} / {fmtNum(r.total)} ({r.pct}%)
                                        </span>
                                    </div>
                                    <div className="progress-bar">
                                        <motion.div
                                            className={`progress-bar-fill ${r.pct >= 70 ? '!bg-success' : r.pct < 40 ? '!bg-warning' : ''}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${r.pct}%` }}
                                            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className={`w-16 h-16 rounded-[var(--radius-xl)] flex items-center justify-center ${isDarkMode ? 'bg-dark-elevated' : 'bg-surface-alt'}`}>
                                <Database size={28} className="text-text-muted" />
                            </div>
                            <p className={`text-sm max-w-xs ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>
                                Lancez une synchronisation pour voir les données régionales.
                            </p>
                            <button onClick={() => navigate('/rapports')} className="text-primary font-semibold text-xs flex items-center gap-1 hover:gap-2 transition-all">
                                Accéder aux Rapports <ArrowRight size={13} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div className="space-y-5">
                    {/* Sync logs */}
                    <div className="card p-6">
                        <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>
                            <Clock size={16} className="text-primary" /> Journal Sync
                        </h3>
                        {syncLogs.length > 0 ? (
                            <div className="space-y-3">
                                {syncLogs.map((log, i) => {
                                    const d = new Date(log.timestamp);
                                    const isOk = log.action === 'PULL_SUCCESS';
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-success' : 'bg-danger'}`} />
                                            <div className="flex-1">
                                                <p className={`text-xs font-medium ${isDarkMode ? 'text-dark-text-secondary' : 'text-text-secondary'}`}>{log.action}</p>
                                                <p className={`text-[10px] ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>
                                                    {d.toLocaleDateString('fr-FR')} {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className={`text-xs ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>Aucune synchronisation récente.</p>
                        )}
                    </div>

                    {/* Quick access */}
                    <div className="gradient-primary rounded-[var(--radius-xl)] p-6 text-white shadow-[var(--shadow-glow)]">
                        <Zap size={24} className="mb-3 opacity-80" />
                        <h3 className="text-base font-bold mb-2">Accès Rapide</h3>
                        <div className="space-y-2 mt-4">
                            {[
                                { label: 'Générer un Rapport', path: '/rapports' },
                                { label: 'Gérer les Utilisateurs', path: '/admin/users' },
                                { label: 'Voir la Carte', path: '/terrain' },
                            ].map(item => (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className="w-full flex items-center justify-between text-xs font-medium py-2.5 px-4 bg-white/10 hover:bg-white/20 rounded-[var(--radius-md)] transition-all"
                                >
                                    {item.label} <ArrowRight size={12} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
