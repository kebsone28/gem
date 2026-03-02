import { useState, useEffect } from 'react';
import {
    Zap,
    Plus,
    Minus,
    Calendar,
    ChevronRight,
    Calculator,
    Compass,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Smartphone
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';

export default function WorkshopTab() {
    const { project, updateKitsLoaded, koboStats } = useLogistique();
    const syncedKits = koboStats?.totalPreparateurKits || 0;

    const [tempCount, setTempCount] = useState(project?.config?.logistics_workshop?.kitsLoaded || syncedKits);

    useEffect(() => {
        if (syncedKits > tempCount) {
            setTempCount(syncedKits);
        }
    }, [syncedKits]);

    const handleSave = () => {
        updateKitsLoaded(tempCount);
    };

    // AI Prediction Mock Logic
    const TOTAL_TARGET = 3500;
    const avgPerDay = 42; // Simulated historic average
    const remainingKits = Math.max(0, TOTAL_TARGET - tempCount);
    const daysRemaining = Math.ceil(remainingKits / avgPerDay);
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);
    const progress = Math.min(100, Math.round((tempCount / TOTAL_TARGET) * 100));

    let healthBadge = { text: 'En Avance', color: 'emerald', icon: CheckCircle2 };
    if (avgPerDay < 30) healthBadge = { text: 'En Retard', color: 'rose', icon: AlertTriangle };
    else if (avgPerDay < 40) healthBadge = { text: 'Sous Tension', color: 'amber', icon: Activity };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Daily Entry Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Compass size={120} className="text-blue-500" />
                </div>

                <div className="flex items-center space-x-3 mb-8">
                    <Calendar className="text-blue-400" />
                    <h3 className="text-2xl font-bold text-white">Saisie Atelier</h3>
                </div>

                <p className="text-slate-400 mb-10 leading-relaxed font-medium">
                    Indiquez le nombre de kits chargés ce matin. Les kits préparés (<span className="text-blue-400 font-bold">{syncedKits}</span>) sont synchronisés automatiquement depuis Kobo.
                </p>

                <div className="flex flex-col items-center space-y-6 bg-slate-950/50 p-8 rounded-3xl border border-slate-800 shadow-inner relative overflow-hidden">
                    {syncedKits > 0 && (
                        <div className="absolute top-0 right-0 bg-blue-600/20 px-4 py-1.5 rounded-bl-xl border-b border-l border-blue-500/30 flex items-center space-x-2">
                            <Smartphone size={12} className="text-blue-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Sync Kobo Active</span>
                        </div>
                    )}
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Kits Prêts au Départ</span>
                    <div className="flex items-center space-x-8">
                        <button
                            onClick={() => setTempCount(Math.max(0, tempCount - 1))}
                            title="Diminuer"
                            className="w-14 h-14 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 border border-slate-700"
                        >
                            <Minus size={24} />
                        </button>
                        <span className="text-6xl font-black text-white w-24 text-center">{tempCount}</span>
                        <button
                            onClick={() => setTempCount(tempCount + 1)}
                            title="Augmenter"
                            className="w-14 h-14 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 border border-slate-700"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                    <button
                        onClick={handleSave}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
                    >
                        <span>Valider le chargement</span>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Prediction / IA Insights */}
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all" />
                    <div className="flex items-center space-x-3 mb-6">
                        <Zap className="text-indigo-400 fill-indigo-400/20" />
                        <h3 className="text-xl font-bold text-white tracking-tight">Intelligence GEM</h3>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Fin Estimée</p>
                            <p className="text-2xl font-black text-white">{estimatedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-sm text-indigo-300/80 font-medium">soit dans {daysRemaining} jours ouvrés</p>
                        </div>
                        <div className={`flex items-center space-x-2 px-4 py-2 bg-${healthBadge.color}-500/10 border border-${healthBadge.color}-500/30 rounded-xl`}>
                            <healthBadge.icon size={16} className={`text-${healthBadge.color}-400`} />
                            <span className={`text-${healthBadge.color}-400 font-bold text-sm tracking-wide`}>{healthBadge.text}</span>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                            <span className="text-slate-400">Progression globale ({TOTAL_TARGET} kits)</span>
                            <span className="text-indigo-400">{progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                            <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    <p className="text-sm text-indigo-200/60 leading-relaxed mb-4 font-medium">
                        Besoins estimés pour demain (base: {avgPerDay} kits/jour) :
                    </p>

                    <div className="space-y-4">
                        {[
                            { label: 'Connecteurs CT70', val: avgPerDay * 2, unit: 'u', trend: '+5%' },
                            { label: 'Câble RVFV 2x6', val: avgPerDay * 15, unit: 'm', trend: 'Stable' },
                            { label: 'Coffret Modulaire', val: avgPerDay, unit: 'u', trend: '-2%' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 group-hover:border-indigo-500/30 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-slate-300 font-bold text-sm">{item.label}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-black">{item.unit}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-lg font-black text-white">{item.val}</span>
                                    <span className={`text-[10px] font-bold ${item.trend.startsWith('+') ? 'text-emerald-400' : 'text-slate-500'}`}>{item.trend}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-center space-x-3">
                        <Calculator size={18} className="text-indigo-400" />
                        <p className="text-[11px] text-indigo-300 font-medium">Besoins recalculés chaque jour à 18h00.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
