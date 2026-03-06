import { useState, useMemo } from 'react';
import {
    FileText, Download, Filter, Calendar, MapPin,
    CheckCircle2, BarChart3, Search, ChevronDown,
    Printer, TrendingUp, Package, RefreshCw, Loader2, ShieldCheck
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
        <div className="p-4 md:p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                            <FileText className="text-slate-900 dark:text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Rapports & Analyses</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Générez et exportez vos données de chantier</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                        <button
                            title="Filtrer les rapports"
                            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors shrink-0"
                        >
                            <Filter size={18} />
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="glass-card bg-white/50 dark:bg-slate-900/50 p-6 border-slate-200 dark:border-slate-800/50 hover:border-emerald-500/30 transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center ${stat.color}`}>
                                    <stat.icon size={20} />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Report Cards */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass-card bg-white/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/50 p-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                                <Printer className="text-emerald-500" />
                                Modèles de Rapports Disponibles
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {visible.map((report) => {
                                    const state = states[report.id] || 'idle';
                                    const Icon = report.icon;
                                    return (
                                        <div key={report.id} className={`group bg-slate-50 dark:bg-slate-950/50 p-6 rounded-2xl border ${report.color} hover:scale-[1.01] transition-all cursor-pointer`}>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center ${report.textColor} group-hover:bg-slate-800 transition-all`}>
                                                    <Icon size={24} />
                                                </div>
                                                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${typeColor(report.type)}`}>
                                                    {report.type}
                                                </span>
                                            </div>
                                            <h4 className="text-slate-900 dark:text-white font-bold mb-2 text-sm">{report.title}</h4>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-4">{report.desc}</p>

                                            {/* Preview list */}
                                            <ul className="space-y-1 mb-5">
                                                {report.preview.map((p, i) => (
                                                    <li key={i} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                                        <CheckCircle2 size={11} className={report.textColor} />
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>

                                            <button
                                                onClick={() => run(report.id, report.handler)}
                                                disabled={state === 'loading'}
                                                className={`w-full py-3 font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm
                                                    ${state === 'done' ? 'bg-emerald-500 text-slate-900 dark:text-white border-emerald-400' :
                                                        state === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                            'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-slate-900 dark:text-white text-slate-600 dark:text-slate-400'}`}
                                            >
                                                {state === 'loading' ? <><Loader2 size={16} className="animate-spin" /> Génération...</> :
                                                    state === 'done' ? <><CheckCircle2 size={16} /> Téléchargé !</> :
                                                        state === 'error' ? 'Erreur — Réessayer' :
                                                            <><Download size={16} /> Générer le PDF</>}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right column: Custom export */}
                    <aside className="xl:col-span-1">
                        <div className="glass-card bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/50 p-5 md:p-8 space-y-6 md:space-y-8 xl:sticky xl:top-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Export Personnalisé</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Configurez un export sur mesure.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block" htmlFor="export-format">Format de sortie</label>
                                    <div className="relative">
                                        <select
                                            id="export-format"
                                            title="Format d'export"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold appearance-none focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option>PDF (.pdf)</option>
                                            <option>Excel (.xlsx)</option>
                                            <option>JSON (.json)</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={16} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block" htmlFor="export-date">Date de référence</label>
                                    <input
                                        id="export-date"
                                        type="date"
                                        title="Date du rapport"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                {!isLSE && (
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="w-5 h-5 rounded-md border-2 border-emerald-500 transition-all flex items-center justify-center bg-emerald-500/20">
                                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                                        </div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">Résumé exécutif global</span>
                                    </label>
                                )}
                                {isAdmin && (
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-slate-800 group-hover:border-emerald-500 transition-all flex items-center justify-center">
                                            <div className="w-2.5 h-2.5 rounded-sm opacity-0 group-hover:opacity-100 bg-emerald-500 transition-opacity" />
                                        </div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">Inclure données financières</span>
                                    </label>
                                )}
                            </div>

                            {/* Access level indicator */}
                            <div className={`flex items-center gap-3 p-4 rounded-2xl border text-xs font-medium
                                ${isAdmin ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
                                    isLSE ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                        'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                <ShieldCheck size={18} className="shrink-0" />
                                <div>
                                    <span className="font-black">Niveau d'accès :</span><br />
                                    {isAdmin ? 'Admin — Rapports complets + financiers + Kobo' :
                                        isLSE ? 'Client LSE — Rapport d\'avancement uniquement' :
                                            'Chef Équipe — Avancement terrain uniquement'}
                                </div>
                            </div>

                            <button
                                onClick={() => run('avancement', () => generateRapportAvancement({ households, zones, userName: user?.name }))}
                                disabled={states['avancement'] === 'loading'}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
                            >
                                {states['avancement'] === 'loading' ? <><Loader2 size={20} className="animate-spin" /> Génération...</> :
                                    <><Download size={20} /> Exporter les Données</>}
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
