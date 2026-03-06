import { useState, useMemo } from 'react';
import {
    FileText, Download, Filter, Calendar, MapPin,
    CheckCircle2, BarChart3, Search, ChevronDown,
    Printer, TrendingUp, Package, RefreshCw, ShieldCheck
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { useAuth } from '../contexts/AuthContext';
import { useFinances } from '../hooks/useFinances';
import {
    generateRapportAvancement,
    generateRapportFinancier,
    generateRapportLogistique,
    generateRapportKobo
} from '../services/reportGenerator';

import { StatusBadge } from '../components/dashboards/DashboardComponents';

type GenerationState = Record<string, 'idle' | 'loading' | 'done' | 'error'>;

interface ReportCard {
    id: string;
    title: string;
    desc: string;
    type: 'PDF' | 'Excel' | 'CSV';
    icon: typeof FileText;
    color: string;
    textColor: string;
    lseVisible: boolean;
    roles: string[];
    handler: () => Promise<void>;
    preview: string[];
}

export default function Reports() {
    const [searchTerm, setSearchTerm] = useState('');
    const [states, setStates] = useState<GenerationState>({});
    const households = useLiveQuery(() => db.households.toArray()) || [];
    const zones = useLiveQuery(() => db.zones.toArray()) || [];
    const { user } = useAuth();
    const isLSE = user?.role === 'CLIENT_LSE';
    const isAdmin = user?.role === 'ADMIN_PROQUELEC' || user?.role === 'DG_PROQUELEC';
    const finances = useFinances();

    const markState = (id: string, state: 'loading' | 'done' | 'error') =>
        setStates(s => ({ ...s, [id]: state }));

    const run = async (id: string, fn: () => void) => {
        markState(id, 'loading');
        await new Promise(r => setTimeout(r, 600)); // visual delay
        try {
            fn();
            markState(id, 'done');
            setTimeout(() => setStates(s => ({ ...s, [id]: 'idle' })), 3000);
        } catch (e) {
            markState(id, 'error');
        }
    };

    const completionRate = useMemo(() => {
        if (households.length === 0) return 0;
        const done = households.filter(h => h.status === 'Terminé' || h.status === 'Conforme').length;
        return Math.round((done / households.length) * 100);
    }, [households]);

    const stats = useMemo(() => {
        const allStats = [
            { label: 'Taux de Complétion', value: `${completionRate}%`, icon: CheckCircle2, color: 'text-emerald-500', lseVisible: true },
            { label: 'Ménages Servis', value: households.length.toLocaleString('fr-FR') || '0', icon: Calendar, color: 'text-blue-500', lseVisible: true },
            { label: 'Zones Actives', value: zones.length || 0, icon: MapPin, color: 'text-amber-500', lseVisible: true },
            { label: 'Écarts Budgétaires', value: finances.devis?.marginPct ? `${finances.devis.marginPct.toFixed(1)}%` : '0%', icon: BarChart3, color: 'text-indigo-500', lseVisible: false },
        ];
        return allStats.filter(s => !isLSE || s.lseVisible);
    }, [completionRate, households.length, zones.length, finances, isLSE]);

    const reportCards: ReportCard[] = [
        {
            id: 'avancement',
            title: 'Rapport Journalier d\'Avancement',
            desc: 'Progression par région, pipeline des équipes, tableau des derniers raccordements validés.',
            type: 'PDF',
            icon: TrendingUp,
            color: 'bg-indigo-500/10 border-indigo-500/30',
            textColor: 'text-indigo-400',
            lseVisible: true,
            roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC', 'CLIENT_LSE', 'CHEF_EQUIPE'],
            preview: ['Avancement global (%)', 'Progression par région', 'Pipeline sous-équipes', 'Tableau des validations'],
            handler: async () => {
                generateRapportAvancement({
                    households,
                    zones,
                    projectName: 'Projet GEM — Sénégal',
                    userName: user?.name
                });
            }
        },
        {
            id: 'financier',
            title: 'Analyse Économique Complète',
            desc: 'Devis vs Réel, marges par poste, décomposition des coûts, budget vs plafond.',
            type: 'PDF',
            icon: BarChart3,
            color: 'bg-emerald-500/10 border-emerald-500/30',
            textColor: 'text-emerald-400',
            lseVisible: false,
            roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
            preview: ['Marge globale (FCFA)', 'Tableau Devis vs Réel', 'Comparatif Budget/Plafond', 'Coûts Équipes + Matériaux'],
            handler: async () => {
                if (!isAdmin) return;
                generateRapportFinancier({
                    devisReport: finances.devis?.report || [],
                    totalPlanned: finances.devis?.totalPlanned || 0,
                    totalReal: finances.devis?.totalReal || 0,
                    globalMargin: finances.devis?.globalMargin || 0,
                    marginPct: finances.devis?.marginPct || 0,
                    ceiling: finances.devis?.ceiling || 300823750,
                    stats: finances.stats,
                    projectName: 'Projet GEM — Sénégal',
                });
            }
        },
        {
            id: 'logistique',
            title: 'Bilan Logistique & Matériel',
            desc: 'État des stocks de kits, consommation par région, planning des prochaines livraisons.',
            type: 'PDF',
            icon: Package,
            color: 'bg-amber-500/10 border-amber-500/30',
            textColor: 'text-amber-400',
            lseVisible: false,
            roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
            preview: ['Kits chargés / livrés / posés', 'Conso. matériaux par région', 'Planning livraisons à venir'],
            handler: async () => {
                generateRapportLogistique({ households, zones });
            }
        },
        {
            id: 'kobo',
            title: 'Rapport de Validation Kobo',
            desc: 'Taux de synchronisation, journal des pulls/push, erreurs et doublons — usage interne uniquement.',
            type: 'PDF',
            icon: RefreshCw,
            color: 'bg-blue-500/10 border-blue-500/30',
            textColor: 'text-blue-400',
            lseVisible: false,
            roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
            preview: ['Taux sync par formulaire', 'Journal des opérations', 'Erreurs / Doublons'],
            handler: async () => {
                generateRapportKobo({ households });
            }
        },
    ];

    const visible = reportCards.filter(r => {
        const roleOk = r.roles.includes(user?.role ?? '');
        const lseOk = !isLSE || r.lseVisible;
        const search = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.desc.toLowerCase().includes(searchTerm.toLowerCase());
        return roleOk && lseOk && (searchTerm === '' || search);
    });

    const typeColor = (t: string) =>
        t === 'PDF' ? 'bg-red-500/10 text-red-400' :
            t === 'Excel' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400';

    return (
        <div className="p-6 md:p-8 lg:p-10 pb-32 transition-colors duration-500 min-h-screen bg-[#F8FAFC] dark:bg-slate-950">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* ── HEADER ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
                            <FileText size={24} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-black tracking-tight uppercase italic leading-none text-slate-900 dark:text-white">Rapports & Analyses</h1>
                                <StatusBadge status="success" label="Certifié" />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none">Intelligence Opérationnelle & Exports</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-1 md:max-w-md">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Rechercher un rapport..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            />
                        </div>
                        <button className="p-2.5 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl text-gray-400 hover:text-blue-600 transition-all shadow-sm">
                            <Filter size={18} />
                        </button>
                    </div>
                </header>

                {/* ── KPI STRATÉGIQUES ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="group p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all shadow-sm shadow-gray-200/50 dark:shadow-none">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/10 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                                    <stat.icon size={20} />
                                </div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
                                <TrendingUp size={14} className="text-emerald-500 opacity-50" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── LISTE DES RAPPORTS ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    <div className="xl:col-span-2 space-y-8">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <Printer size={20} className="text-blue-500" />
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Modèles Disponibles</h3>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{visible.length} RAPPORTS TROUVÉS</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {visible.map((report) => {
                                const state = states[report.id] || 'idle';
                                const Icon = report.icon;
                                return (
                                    <div key={report.id} className={`group relative bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all shadow-sm hover:shadow-xl hover:shadow-blue-500/5`}>
                                        <div className="flex items-start justify-between mb-6">
                                            <div className={`w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/10 flex items-center justify-center ${report.textColor} group-hover:scale-110 transition-transform shadow-inner`}>
                                                <Icon size={28} />
                                            </div>
                                            <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg ${typeColor(report.type)} uppercase tracking-widest`}>
                                                {report.type}
                                            </span>
                                        </div>

                                        <h4 className="text-slate-900 dark:text-white font-black text-base mb-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{report.title}</h4>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-6 font-medium">{report.desc}</p>

                                        <div className="space-y-2 mb-8 bg-gray-50/50 dark:bg-white/5 p-4 rounded-2xl">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Inclus dans l'export :</p>
                                            {report.preview.map((p, i) => (
                                                <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                                    <div className={`w-1 h-1 rounded-full ${report.textColor.replace('text-', 'bg-')}`} />
                                                    {p}
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => run(report.id, report.handler)}
                                            disabled={state === 'loading'}
                                            className={`w-full py-4 font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 text-xs uppercase tracking-widest
                                                ${state === 'done' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                                                    state === 'error' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-none' :
                                                        'bg-slate-900 dark:bg-blue-600 text-white shadow-blue-500/20 hover:brightness-110 active:scale-95'}`}
                                        >
                                            {state === 'loading' ? <><RefreshCw size={16} className="animate-spin" /> Génération...</> :
                                                state === 'done' ? <><CheckCircle2 size={16} /> Prêt !</> :
                                                    state === 'error' ? 'Échec — Réessayer' :
                                                        <><Download size={16} /> Télécharger</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── CONFIGURATION D'EXPORT ── */}
                    <aside className="xl:col-span-1">
                        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-[2.5rem] space-y-8 xl:sticky xl:top-10 shadow-sm">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Export Avancé</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Paramétrez votre extraction de données terrain.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block" htmlFor="export-format">Format du fichier</label>
                                    <div className="relative">
                                        <select
                                            id="export-format"
                                            title="Choisir le format d'export"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        >
                                            <option>PDF Document (.pdf)</option>
                                            <option>Excel Spreadsheet (.xlsx)</option>
                                            <option>Structured JSON (.json)</option>
                                        </select>
                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block" htmlFor="export-date">Date d'Arrêt technique</label>
                                    <input
                                        id="export-date"
                                        type="date"
                                        title="Sélectionner une date"
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                </div>

                                <div className="pt-4 space-y-4">
                                    {!isLSE && (
                                        <label className="flex items-center gap-4 cursor-pointer group">
                                            <div className="w-6 h-6 rounded-lg border-2 border-blue-500 transition-all flex items-center justify-center bg-blue-500/10">
                                                <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                                            </div>
                                            <span className="text-slate-700 dark:text-gray-300 font-bold text-xs uppercase tracking-tight">Résumé Stratégique</span>
                                        </label>
                                    )}
                                    {isAdmin && (
                                        <label className="flex items-center gap-4 cursor-pointer group text-gray-400 hover:text-blue-500 transition-colors">
                                            <div className="w-6 h-6 rounded-lg border-2 border-gray-200 dark:border-white/10 group-hover:border-blue-500 transition-all flex items-center justify-center">
                                                <div className="w-2.5 h-2.5 rounded-sm opacity-0 group-hover:opacity-100 bg-blue-500 transition-opacity" />
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-tight">Données Financières</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className={`flex items-center gap-4 p-5 rounded-3xl border text-[11px] font-bold leading-relaxed
                                ${isAdmin ? 'bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400' :
                                    isLSE ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                                        'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                <ShieldCheck size={20} className="shrink-0" />
                                <div>
                                    <span className="uppercase text-[9px] font-black opacity-60">Permissions :</span><br />
                                    {isAdmin ? 'Contrôle Total — Accès expert au hub financier & Kobo.' :
                                        isLSE ? 'Mode Client — Données d\'avancement certifiées uniquement.' :
                                            'Mode Opérationnel — Rapports terrain et logistique.'}
                                </div>
                            </div>

                            <button
                                onClick={() => run('global', () => generateRapportAvancement({ households, zones, userName: user?.name }))}
                                disabled={states['global'] === 'loading'}
                                className="w-full text-white font-black py-5 rounded-[1.5rem] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] text-xs uppercase tracking-[0.2em] bg-blue-600"
                            >
                                {states['global'] === 'loading' ? <><RefreshCw size={18} className="animate-spin" /> Extraction...</> :
                                    <><Download size={18} /> Lancer l'Export</>}
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
