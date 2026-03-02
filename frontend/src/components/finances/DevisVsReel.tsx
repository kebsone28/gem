import {
    Search,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    FileSpreadsheet
} from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { useTheme } from '../../context/ThemeContext';

const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(Math.round(val)) + ' F';

export default function DevisVsReel() {
    const { devis, updateRealCost, updatePlannedCost } = useFinances();
    const { isDarkMode } = useTheme();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="relative w-full lg:w-96 group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} size={18} />
                    <input
                        type="text"
                        placeholder="Rechercher un poste de dépense..."
                        className={`w-full border rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 transition-all shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:ring-indigo-500/30' : 'bg-white border-slate-200 text-slate-700 focus:ring-indigo-500/20'}`}
                    />
                </div>

                <div className="flex items-center gap-4 flex-wrap justify-center">
                    <div className={`backdrop-blur-md border rounded-[2rem] px-8 py-4 shadow-xl flex items-center gap-8 transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <div className="flex flex-col items-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Marge Globale</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-xl font-black ${devis.globalMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {formatFCFA(devis.globalMargin)}
                                </span>
                                {devis.globalMargin >= 0 ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-rose-500" />}
                            </div>
                        </div>
                        <div className={`w-[1px] h-8 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                        <div className="flex flex-col items-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Performance</span>
                            <span className="text-xl font-black text-indigo-600">{devis.marginPct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                        <FileSpreadsheet size={16} />
                        <span>EXPORTER CSV</span>
                    </button>
                </div>
            </div>

            {/* Comparison Table */}
            <div className={`border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className={`${isDarkMode ? 'bg-slate-950/50 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-100'}`}>
                                <th className={`px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] w-1/4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Poste de Dépense</th>
                                <th className={`px-6 py-6 text-[9px] font-black border-x text-center ${isDarkMode ? 'text-slate-400 border-slate-800 bg-blue-500/5' : 'text-slate-500 border-slate-100 bg-blue-50/30'}`} colSpan={2}>Prévision (Devis)</th>
                                <th className={`px-6 py-6 text-[9px] font-black border-x text-center ${isDarkMode ? 'text-slate-400 border-slate-800 bg-indigo-500/5' : 'text-slate-500 border-slate-100 bg-indigo-50/30'}`} colSpan={2}>Réalisation (Réel)</th>
                                <th className={`px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ecart / Marge</th>
                            </tr>
                            <tr className={`border-b ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                <th className="px-8 py-4"></th>
                                <th className={`px-6 py-4 text-[9px] font-black text-right ${isDarkMode ? 'text-slate-500 bg-blue-500/5' : 'text-slate-400 bg-blue-50/30'}`}>Qté</th>
                                <th className={`px-6 py-4 text-[9px] font-black text-right ${isDarkMode ? 'text-slate-500 bg-blue-500/5' : 'text-slate-400 bg-blue-50/30'}`}>P.U</th>
                                <th className={`px-6 py-4 text-[9px] font-black text-right border-l ${isDarkMode ? 'text-slate-500 bg-indigo-500/5 border-slate-800' : 'text-slate-400 bg-indigo-50/30 border-slate-100'}`}>Qté Réelle</th>
                                <th className={`px-6 py-4 text-[9px] font-black text-right ${isDarkMode ? 'text-slate-500 bg-indigo-500/5' : 'text-slate-400 bg-indigo-50/30'}`}>P.U Réel</th>
                                <th className="px-8 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/50' : 'divide-slate-50'}`}>
                            {devis.report.map((item: any) => {
                                const isKaffrine = item.region === 'Kaffrine';
                                const isTamba = item.region === 'Tambacounda';

                                const bgClass = isKaffrine
                                    ? (isDarkMode ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'bg-amber-50/50 hover:bg-amber-100/80')
                                    : isTamba
                                        ? (isDarkMode ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'bg-emerald-50/50 hover:bg-emerald-100/80')
                                        : (isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30');

                                const borderClass = isKaffrine
                                    ? 'border-l-4 border-l-amber-500'
                                    : isTamba
                                        ? 'border-l-4 border-l-emerald-500'
                                        : 'border-l-4 border-l-transparent';

                                return (
                                    <tr key={item.id} className={`group transition-all ${bgClass} ${borderClass}`}>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-xs tracking-tight transition-all ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{item.label}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isKaffrine ? 'text-amber-500/80' : isTamba ? 'text-emerald-500/80' : 'text-slate-500 opacity-50'}`}>{item.region}</span>
                                            </div>
                                        </td>

                                        {/* Devis - Inputs */}
                                        <td className={`px-6 py-6 transition-all ${isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50/10'}`}>
                                            <input
                                                title={`Quantité prévue pour ${item.label}`}
                                                type="number"
                                                value={item.qty}
                                                onChange={(e) => updatePlannedCost(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                                className={`w-full border p-2 rounded-xl text-right text-[11px] font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600'}`}
                                            />
                                        </td>
                                        <td className={`px-6 py-6 border-r transition-all ${isDarkMode ? 'bg-blue-500/5 border-slate-800/50' : 'bg-blue-50/10 border-slate-100'}`}>
                                            <input
                                                title={`Prix unitaire prévu pour ${item.label}`}
                                                type="number"
                                                value={item.unit}
                                                onChange={(e) => updatePlannedCost(item.id, 'unit', parseFloat(e.target.value) || 0)}
                                                className={`w-full border p-2 rounded-xl text-right text-[11px] font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600'}`}
                                            />
                                        </td>

                                        {/* Réel - Inputs */}
                                        <td className={`px-6 py-6 transition-all ${isDarkMode ? 'bg-indigo-500/5' : 'bg-indigo-50/10'}`}>
                                            <input
                                                title={`Quantité réelle pour ${item.label}`}
                                                type="number"
                                                value={item.rq}
                                                onChange={(e) => updateRealCost(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                                className={`w-full border p-2 rounded-xl text-right text-[11px] font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-600'}`}
                                            />
                                        </td>
                                        <td className={`px-6 py-6 border-r transition-all ${isDarkMode ? 'bg-indigo-500/5 border-slate-800/50' : 'bg-indigo-50/10 border-slate-100'}`}>
                                            <input
                                                title={`Prix unitaire réel pour ${item.label}`}
                                                type="number"
                                                value={item.ru}
                                                onChange={(e) => updateRealCost(item.id, 'unit', parseFloat(e.target.value) || 0)}
                                                className={`w-full border p-2 rounded-xl text-right text-[11px] font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-600'}`}
                                            />
                                        </td>

                                        {/* Ecart / Marge */}
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-[13px] font-black tracking-tighter ${item.margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {formatFCFA(item.margin)}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {item.margin >= 0 ?
                                                        <CheckCircle2 size={10} className="text-emerald-500/50" /> :
                                                        <AlertTriangle size={10} className="text-rose-500/50" />
                                                    }
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${item.margin >= 0 ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
                                                        {item.margin >= 0 ? 'CONFORME' : 'DÉPASSEMENT'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className={`border-t-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                            <tr className="font-black">
                                <td className={`px-8 py-8 tracking-widest text-[9px] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAUX CONSOLIDÉS</td>
                                <td colSpan={2} className={`px-6 py-8 text-right border-r text-lg tabular-nums tracking-tighter transition-all ${isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-slate-800' : 'text-indigo-600 bg-indigo-50/30 border-slate-100'}`}>{formatFCFA(devis.totalPlanned)}</td>
                                <td colSpan={2} className={`px-6 py-8 text-right border-r text-lg tabular-nums tracking-tighter transition-all ${isDarkMode ? 'text-white bg-indigo-500/10 border-slate-800' : 'text-slate-900 bg-indigo-50/50 border-slate-100'}`}>{formatFCFA(devis.totalReal)}</td>
                                <td className="px-8 py-8 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={`text-3xl font-black tracking-tighter ${devis.globalMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {formatFCFA(devis.globalMargin)}
                                        </span>
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Marge Reliquat</span>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
