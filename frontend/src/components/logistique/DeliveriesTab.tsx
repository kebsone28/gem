import {
    History,
    Calendar,
    User,
    Search,
    Filter,
    Truck,
    Hammer,
    Zap,
    HardHat,
    ClipboardCheck,
    Smartphone
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';

export default function DeliveriesTab() {
    const { households, koboStats } = useLogistique();
    const trackingList = households?.filter(h => h.delivery?.date || h.koboSync) || [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Headers & KPI */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h3 className="text-2xl font-bold text-white flex items-center space-x-3">
                        <Smartphone className="text-blue-500" />
                        <span>Suivi des Formulaires Kobo</span>
                    </h3>
                    <p className="text-slate-500 font-medium mt-1">Avancement en temps réel du terrain, synchronisé depuis les tablettes.</p>
                </div>
                <div className="flex items-center space-x-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="flex flex-col border-r border-slate-800 pr-6 mr-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kits Préparés (Kobo)</span>
                        <span className="text-2xl font-black text-emerald-400">{koboStats?.totalPreparateurKits || 0}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Câbles Livrés (m)</span>
                        <span className="text-2xl font-black text-blue-400">
                            {(koboStats?.cableInt25Total || 0) + (koboStats?.cableInt15Total || 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
                <div className="flex items-center space-x-4 flex-1 min-w-[300px]">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Rechercher un ménage..."
                            className="bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                        <Calendar size={16} className="text-slate-500" />
                        <span className="text-xs text-slate-400 font-bold">Derniers 30 jours (Kobo)</span>
                    </div>
                </div>
                <button className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                    <Filter size={16} />
                    <span>Filtres Avancés</span>
                </button>
            </div>

            {/* Main Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ménage</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Livreur</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phases Déploiement (Validé Kobo)</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Matériaux Enregistrés</th>
                                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Statut Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {trackingList?.map((d, i) => {
                                const phasesOptions = [
                                    { label: 'Livreur', ok: !!d.koboSync?.livreurDate || !!d.delivery?.date, icon: Truck, color: 'blue' },
                                    { label: 'Maçon', ok: !!d.koboSync?.maconOk, icon: Hammer, color: 'orange' },
                                    { label: 'Réseau', ok: !!d.koboSync?.reseauOk, icon: Zap, color: 'emerald' },
                                    { label: 'Intérieur', ok: !!d.koboSync?.interieurOk, icon: HardHat, color: 'indigo' },
                                    { label: 'Contrôle', ok: !!d.koboSync?.controleOk, icon: ClipboardCheck, color: 'fuchsia' },
                                ];
                                const finalOk = d.koboSync?.controleOk || d.status === 'Conforme';

                                return (
                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-blue-400 font-bold">{d.id}</span>
                                                <span className="text-[10px] text-slate-500">{d.region}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                                                    <User size={14} className="text-slate-400" />
                                                </div>
                                                <span className="text-slate-300 font-bold text-xs">{d.delivery?.agent || 'En attente'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center space-x-1.5">
                                                {phasesOptions.map((ph, idx) => (
                                                    <div
                                                        key={idx}
                                                        title={ph.label + (ph.ok ? ' (Fait)' : ' (Attente)')}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${ph.ok ? `bg-slate-800 border-slate-700 shadow-sm opacity-100` : `bg-slate-950 border-slate-800/50 opacity-40 grayscale`}`}
                                                    >
                                                        <ph.icon size={13} className={ph.ok ? `text-${ph.color}-400` : 'text-slate-600'} />
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col space-y-1">
                                                {(d.koboSync?.cableInt25 || 0) > 0 && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-md w-fit font-mono">
                                                        Câble 2.5: {d.koboSync?.cableInt25}m
                                                    </span>
                                                )}
                                                {(d.koboSync?.tranchee4 || 0) > 0 && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-md w-fit font-mono">
                                                        Tranchée: {d.koboSync?.tranchee4}m
                                                    </span>
                                                )}
                                                {!(d.koboSync?.cableInt25) && !(d.koboSync?.tranchee4) && (
                                                    <span className="text-[10px] text-slate-600">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${finalOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-800/50 text-slate-400 border border-slate-700'
                                                }`}>
                                                {finalOk ? 'Approuvé' : 'En cours'}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {trackingList.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                                            <History size={64} className="text-slate-400" />
                                            <p className="text-xl font-bold text-slate-400">Aucun historique Kobo</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
