import {
    TrendingUp,
    Activity,
    AlertTriangle,
    Zap,
    Timer,
    CalendarCheck
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';

export default function AgentsTab() {
    const { agents } = useLogistique();

    const activeAnomalies = agents?.flatMap(a => {
        const list = [];
        if (a.status === 'Inactif') {
            list.push({ type: 'danger', msg: `L'agent ${a.name} est inactif depuis plus de ${a.daysSince} jours.`, icon: AlertTriangle, color: 'rose' });
        }
        if (a.avgTime > 45) {
            list.push({ type: 'warning', msg: `Temps moyen excessif (${a.avgTime} min) pour ${a.name}.`, icon: Timer, color: 'amber' });
        }
        if (a.status === 'Actif' && a.visits < 5) {
            list.push({ type: 'info', msg: `Volume de visites anormalement faible (${a.visits}) pour l'agent actif ${a.name}.`, icon: Activity, color: 'blue' });
        }
        return list;
    }) || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Left Column: Performance Table */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
                    <div className="p-6 bg-gradient-to-r from-blue-600/10 to-transparent border-b border-slate-800 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <TrendingUp className="text-blue-400" />
                            <h3 className="text-xl font-bold text-white">Performances Agents</h3>
                        </div>
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Temps Réel</span>
                        </div>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Agent</th>
                                    <th className="text-center px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Visites</th>
                                    <th className="text-center px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tps Moyen</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Activité</th>
                                    <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {agents?.map((a, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <span className="text-white font-bold">{a.name}</span>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <span className="text-blue-400 font-black text-lg">{a.visits}</span>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-slate-300 font-bold">{a.avgTime} min</span>
                                                <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-blue-500 w-[var(--avg-time-width)]" style={{ '--avg-time-width': `${Math.min(a.avgTime * 2, 100)}%` } as React.CSSProperties} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-slate-400 text-xs font-medium">
                                            {a.lastDate ? new Date(a.lastDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${a.status === 'Actif' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                a.status === 'Ralenti' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Column: Anomalies & Insights */}
            <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-500/50" />
                    <div className="flex items-center space-x-3 mb-6">
                        <AlertTriangle className="text-amber-500" />
                        <h3 className="text-xl font-bold text-white">Anomalies</h3>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {activeAnomalies.length > 0 ? activeAnomalies.map((anom, i) => (
                            <div key={i} className={`bg-${anom.color}-500/5 border border-${anom.color}-500/20 p-4 rounded-2xl flex items-start space-x-3`}>
                                <anom.icon size={18} className={`text-${anom.color}-500 mt-0.5 shrink-0`} />
                                <p className={`text-xs text-${anom.color}-200/70 leading-relaxed font-medium`}>
                                    {anom.msg}
                                </p>
                            </div>
                        )) : (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-start space-x-3">
                                <Activity size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-emerald-200/70 leading-relaxed">
                                    Aucune anomalie détectée sur le terrain. L'activité des agents est nominale.
                                </p>
                            </div>
                        )}
                        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl flex items-start space-x-3 mt-4">
                            <Timer size={18} className="text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-300/70 leading-relaxed">
                                Temps de visite moyen global calculé : <span className="font-bold text-slate-200">{agents?.length ? Math.round(agents.reduce((a, b) => a + b.avgTime, 0) / agents.length) : 0} min</span>.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all cursor-pointer">
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                        <Zap size={120} className="text-indigo-500" />
                    </div>
                    <div className="flex items-center space-x-3 mb-6">
                        <CalendarCheck className="text-indigo-400" />
                        <h3 className="text-xl font-bold text-white">Insight Logistique</h3>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        La productivité a augmenté de <span className="text-emerald-400 font-bold">+12%</span> cette semaine grâce à une meilleure répartition des équipes sur Kaffrine.
                    </p>
                    <button className="mt-6 text-indigo-400 text-xs font-black uppercase tracking-widest hover:text-indigo-300">Voir le rapport complet</button>
                </div>
            </div>
        </div>
    );
}
