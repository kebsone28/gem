import { useMemo } from 'react';
import { fmtNum } from '../../utils/format';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { motion } from 'framer-motion';
import {
    MapPin, Users, CheckCircle2, Clock, AlertTriangle,
    TrendingUp, ExternalLink, Layers, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Status pipeline: each status group corresponds to a trade stage ────────
// A household progresses through: Non débuté → Murs → Réseau → Intérieur → Terminé
// Each trade "owns" the step that moves households into its stage.
// Trade progress = (households at or beyond its stage) / total
const PIPELINE_ORDER = ['Non débuté', 'Murs', 'Réseau', 'Intérieur', 'Terminé'];

interface TradeConfig {
    teamId: string;           // matches user.teamId
    label: string;
    icon: string;
    color: string;
    // All statuses considered "done" for this trade (at or past)
    doneStatuses: string[];
    description: string;
}

const TRADES: TradeConfig[] = [
    {
        teamId: 'team_macons',
        label: 'Maçons',
        icon: '🧱',
        color: 'indigo',
        doneStatuses: ['Murs', 'Réseau', 'Intérieur', 'Terminé'],
        description: 'Travaux de maçonnerie (fondations, murs)',
    },
    {
        teamId: 'team_reseau',
        label: 'Réseau',
        icon: '🔌',
        color: 'blue',
        doneStatuses: ['Réseau', 'Intérieur', 'Terminé'],
        description: 'Câblage réseau + potelets',
    },
    {
        teamId: 'team_interieur',
        label: 'Électricien',
        icon: '💡',
        color: 'emerald',
        doneStatuses: ['Intérieur', 'Terminé'],
        description: 'Installation intérieure et compteur',
    },
    {
        teamId: 'team_livraison',
        label: 'Livreur / Contrôle',
        icon: '✅',
        color: 'amber',
        doneStatuses: ['Terminé'],
        description: 'Livraison kits + validation SENELEC',
    },
];

const COLOR_MAP: Record<string, string> = {
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-400',
};
const TEXT_MAP: Record<string, string> = {
    indigo: 'text-indigo-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
};
const BORDER_MAP: Record<string, string> = {
    indigo: 'border-indigo-500/30',
    blue: 'border-blue-500/30',
    emerald: 'border-emerald-500/30',
    amber: 'border-amber-500/30',
};
const BG_MAP: Record<string, string> = {
    indigo: 'bg-indigo-500/10',
    blue: 'bg-blue-500/10',
    emerald: 'bg-emerald-500/10',
    amber: 'bg-amber-500/10',
};

export default function TeamDashboard() {
    const { isDarkMode } = useTheme();
    const { user } = useAuth();
    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];
    const navigate = useNavigate();

    // ── Compute real progress for each trade from Dexie ──────────────
    const total = households.length;

    const pipeline = useMemo(() => {
        return TRADES.map(trade => {
            let done: number;
            if (total === 0) {
                // No data yet → show demo percentages
                const demoMap: Record<string, number> = {
                    team_macons: 82, team_reseau: 64, team_interieur: 47, team_livraison: 31
                };
                done = Math.round((demoMap[trade.teamId] ?? 0) * 100 / 100);
                return {
                    ...trade,
                    progress: demoMap[trade.teamId] ?? 0,
                    done: 0,
                    total: 0,
                    activeZones: 0,
                };
            }
            done = households.filter(h => trade.doneStatuses.includes(h.status)).length;
            const progress = Math.round((done / total) * 100);

            // Count zones with at least one household at this trade's stage
            const zoneIds = new Set(
                households
                    .filter(h => trade.doneStatuses.includes(h.status))
                    .map(h => h.zoneId)
            );
            const activeZones = zoneIds.size;

            return { ...trade, progress, done, total, activeZones };
        });
    }, [households, total]);

    // ── Identify current user's trade ────────────────────────────────
    const myTrade = user?.teamId ? pipeline.find(t => t.teamId === user.teamId) : null;
    const myIndex = myTrade ? pipeline.findIndex(t => t.teamId === user?.teamId) : -1;
    const predecessorTrade = myIndex > 0 ? pipeline[myIndex - 1] : null;
    const isBlocked = predecessorTrade ? predecessorTrade.progress < 80 : false;

    const completedCount = myTrade?.done ?? 0;
    const pendingCount = (myTrade?.total ?? 0) - completedCount;

    // ── Status breakdown for the "my team" panel ─────────────────────
    const myStatusBreakdown = useMemo(() => {
        if (!myTrade || total === 0) return [];
        return PIPELINE_ORDER.map(status => {
            const count = households.filter(h => h.status === status).length;
            return { status, count, pct: Math.round((count / total) * 100) };
        });
    }, [myTrade, households, total]);

    // ── Regional breakdown ────────────────────────────────────────────
    const regionBreakdown = useMemo(() => {
        if (!myTrade || total === 0) return [];
        const regionMap: Record<string, { done: number; all: number }> = {};
        households.forEach(h => {
            const zone = zones.find(z => z.id === h.zoneId);
            const region = zone?.region ?? zone?.name ?? 'Inconnue';
            if (!regionMap[region]) regionMap[region] = { done: 0, all: 0 };
            regionMap[region].all++;
            if (myTrade.doneStatuses.includes(h.status)) regionMap[region].done++;
        });
        return Object.entries(regionMap)
            .map(([region, { done, all }]) => ({ region, done, all, pct: Math.round((done / all) * 100) }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 4);
    }, [myTrade, households, zones]);

    const baseCard = isDarkMode
        ? 'bg-slate-900/60 border-slate-800'
        : 'bg-white border-slate-100 shadow-sm';

    return (
        <div className="p-4 md:p-6 space-y-5 md:space-y-8">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className={`text-2xl md:text-3xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Mon Équipe{myTrade ? ` — ${myTrade.icon} ${myTrade.label}` : ' — Chef d\'Équipe'}
                    </h2>
                    <p className={`text-[13px] font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {total > 0
                            ? `${fmtNum(total)} ménages suivis en temps réel`
                            : 'Connexion Kobo requise pour les données réelles'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/terrain')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all shrink-0"
                >
                    <MapPin size={16} /> Voir la Carte Terrain
                </button>
            </header>

            {/* Dependency blocker alert */}
            {isBlocked && predecessorTrade && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400"
                >
                    <AlertTriangle size={22} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-black text-sm">Dépendance en cours</h4>
                        <p className="text-xs mt-1">
                            L'équipe <strong>{predecessorTrade.label}</strong> est à{' '}
                            <strong>{predecessorTrade.progress}%</strong> — attendez 80% pour démarrer vos prochaines grappes.
                        </p>
                    </div>
                </motion.div>
            )}

            {/* KPIs — My team */}
            {myTrade && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Mon Avancement', value: `${myTrade.progress}%`, icon: TrendingUp, sub: 'de l\'objectif' },
                        { label: 'Zones Actives', value: myTrade.activeZones || myTrade.progress > 0 ? myTrade.activeZones : '—', icon: MapPin, sub: 'zones en cours' },
                        { label: 'Ménages Faits', value: total > 0 ? fmtNum(completedCount) : '—', icon: CheckCircle2, sub: 'raccordés / validés' },
                        { label: 'En Attente', value: total > 0 ? fmtNum(pendingCount) : '—', icon: Clock, sub: 'restants' },
                    ].map((kpi, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08 }}
                            className={`p-5 rounded-2xl border ${baseCard}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <kpi.icon size={16} className={TEXT_MAP[myTrade.color]} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</span>
                            </div>
                            <div className={`text-2xl font-black mb-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</div>
                            <div className="text-[10px] text-slate-500">{kpi.sub}</div>
                        </motion.div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Pipeline: all teams */}
                <div className={`lg:col-span-2 p-7 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
                    <h3 className={`text-lg font-black tracking-tighter mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <Users size={20} className="text-indigo-400" /> Pipeline des Sous-Équipes
                        {total > 0 && (
                            <span className="ml-auto text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                                <Activity size={10} /> Données réelles
                            </span>
                        )}
                    </h3>

                    <div className="space-y-5">
                        {pipeline.map((trade, i) => {
                            const isMe = trade.teamId === user?.teamId;
                            return (
                                <motion.div
                                    key={trade.teamId}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`p-4 rounded-2xl border transition-all ${isMe
                                        ? `${BG_MAP[trade.color]} ${BORDER_MAP[trade.color]}`
                                        : isDarkMode ? 'border-slate-800/50 bg-slate-900/30' : 'border-slate-100 bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{trade.icon}</span>
                                            <div>
                                                <span className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                                    {trade.label}
                                                    {isMe && (
                                                        <span className={`ml-2 text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${BG_MAP[trade.color]} ${TEXT_MAP[trade.color]}`}>
                                                            Mon Équipe
                                                        </span>
                                                    )}
                                                </span>
                                                <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {total > 0
                                                        ? `${fmtNum(trade.done ?? 0)} / ${fmtNum(total)} ménages`
                                                        : trade.description
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`font-black text-lg ${TEXT_MAP[trade.color]}`}>{trade.progress}%</span>
                                    </div>
                                    <div className={`h-2.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <motion.div
                                            className={`h-2.5 rounded-full ${COLOR_MAP[trade.color]}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${trade.progress}%` }}
                                            transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-5">

                    {/* Status breakdown */}
                    {myTrade && (
                        <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
                            <h3 className={`text-sm font-black mb-5 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <Layers size={16} className="text-indigo-400" /> Répartition des Statuts
                            </h3>
                            <div className="space-y-3">
                                {(total > 0 ? myStatusBreakdown : [
                                    { status: 'Non débuté', count: 0, pct: 18 },
                                    { status: 'Murs', count: 0, pct: 24 },
                                    { status: 'Réseau', count: 0, pct: 18 },
                                    { status: 'Intérieur', count: 0, pct: 22 },
                                    { status: 'Terminé', count: 0, pct: 18 },
                                ]).map(({ status, count, pct: p }) => {
                                    const color = status === 'Terminé' ? 'bg-emerald-500'
                                        : status === 'Non débuté' ? 'bg-slate-600'
                                            : status === 'Murs' ? 'bg-indigo-500'
                                                : status === 'Réseau' ? 'bg-blue-500'
                                                    : 'bg-amber-400';
                                    return (
                                        <div key={status}>
                                            <div className="flex justify-between text-[11px] font-medium mb-1">
                                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{status}</span>
                                                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                                                    {total > 0 ? `${fmtNum(count)} (${p}%)` : `${p}%`}
                                                </span>
                                            </div>
                                            <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <motion.div
                                                    className={`h-1.5 rounded-full ${color}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${p}%` }}
                                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Regional breakdown */}
                    {myTrade && (
                        <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
                            <h3 className={`text-sm font-black mb-5 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <MapPin size={16} className="text-indigo-400" /> Top Régions
                            </h3>
                            {regionBreakdown.length > 0 ? (
                                <div className="space-y-3">
                                    {regionBreakdown.map(({ region, done, all, pct: p }) => (
                                        <div key={region}>
                                            <div className="flex justify-between text-[11px] font-medium mb-1">
                                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{region}</span>
                                                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{done}/{all} ({p}%)</span>
                                            </div>
                                            <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <motion.div
                                                    className={`h-1.5 rounded-full ${p >= 50 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${p}%` }}
                                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-xs text-center py-4">
                                    Synchronisez les données Kobo pour voir les régions.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Link to map */}
            <button
                onClick={() => navigate('/terrain')}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-indigo-500/40 text-indigo-400 rounded-2xl font-black text-sm hover:bg-indigo-500/10 transition-all"
            >
                <ExternalLink size={18} /> Voir la répartition géographique des grappes
            </button>
        </div>
    );
}
