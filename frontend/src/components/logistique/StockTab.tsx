import { useState } from 'react';
import {
    AlertCircle,
    Info,
    PenLine,
    Save,
    CheckCircle2,
    Box,
    Layers
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { KIT_CATEGORIES, CATEGORY_COLORS } from '../../utils/config';
import { fmtNum } from '../../utils/format';

export default function StockTab() {
    const { stockData, project } = useLogistique();
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Group by category
    const categoriesMap = KIT_CATEGORIES.map(cat => ({
        name: cat,
        items: stockData.filter(i => i.category === cat)
    })).filter(c => c.items.length > 0);

    const totalUnits = stockData.reduce((sum, item) => sum + item.current, 0);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <Layers size={80} className="text-blue-500" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Kits Chargés</h4>
                    <p className="text-4xl font-black text-white">{project?.config?.logistics_workshop?.kitsLoaded || 0}</p>
                    <div className="mt-4 flex items-center space-x-2 text-blue-400 text-xs font-bold">
                        <CheckCircle2 size={14} />
                        <span>Basé sur le chargement réel</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <Box size={80} className="text-emerald-500" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Unités Stock</h4>
                    <p className="text-4xl font-black text-white">{fmtNum(Math.round(totalUnits))}</p>
                    <div className="mt-4 flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                        <Info size={14} />
                        <span>Calculé via nomenclature (BOM)</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <AlertCircle size={80} className="text-amber-500" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Corrections Manuelles</h4>
                    <p className="text-4xl font-black text-white">{stockData.filter(i => i.hasOverride).length}</p>
                    <button
                        onClick={() => setIsAdminMode(!isAdminMode)}
                        className="mt-4 flex items-center space-x-2 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors"
                    >
                        <PenLine size={14} />
                        <span>{isAdminMode ? 'Quitter le mode édition' : 'Éditer les stocks'}</span>
                    </button>
                </div>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {categoriesMap.map((cat) => {
                    const style = CATEGORY_COLORS[cat.name] || { bg: 'bg-slate-800/50', border: 'border-slate-800', text: 'text-slate-400' };
                    return (
                        <div key={cat.name} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                            <div className={`p-4 ${style.bg} border-b ${style.border}`}>
                                <h3 className={`text-sm font-bold uppercase tracking-widest ${style.text}`}>{cat.name}</h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950/50 border-b border-slate-800">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Article</th>
                                            <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase">Qté/Kit</th>
                                            <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase">Stock Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cat.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-medium">{item.label}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">{item.unit}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center font-mono text-slate-400">
                                                    {item.qty}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-lg font-black ${item.hasOverride ? 'text-amber-400' : 'text-slate-200'}`}>
                                                            {fmtNum(Math.round(item.current))}
                                                        </span>
                                                        {item.hasOverride && (
                                                            <span className="text-[9px] text-amber-500/80 font-bold uppercase tracking-tighter">
                                                                Correction Admin
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAdminMode && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-8 overflow-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl shadow-2xl p-10 relative">
                        <button
                            onClick={() => setIsAdminMode(false)}
                            className="absolute top-8 right-8 text-slate-500 hover:text-white text-2xl"
                        >✕</button>
                        <h3 className="text-2xl font-bold text-white mb-2">Audit & Corrections Stock</h3>
                        <p className="text-slate-500 mb-8 font-medium">Forcez les valeurs de stock pour corriger les inventaires physiques.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[50vh] overflow-auto pr-4 mb-8">
                            {stockData.map(item => (
                                <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 truncate" title={item.label}>{item.label}</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            className="bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 w-full"
                                            placeholder={`${Math.round(item.calculated)} (auto)`}
                                            defaultValue={item.hasOverride ? item.current : ''}
                                        />
                                        <span className="text-xs text-slate-600 font-mono">{item.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button onClick={() => setIsAdminMode(false)} className="px-8 py-3 text-slate-400 font-bold hover:text-white transition-colors">Annuler</button>
                            <button
                                onClick={() => {
                                    setShowToast(true);
                                    setTimeout(() => setShowToast(false), 3000);
                                    setIsAdminMode(false);
                                }}
                                className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 text-white px-10 py-3 rounded-2xl font-black shadow-lg shadow-amber-600/20 transition-all active:scale-95"
                            >
                                <Save size={18} />
                                <span>Sauvegarder les Corrections</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showToast && (
                <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-right-8 z-[3000]">
                    <CheckCircle2 size={24} />
                    <p className="font-bold">Stock mis à jour avec succès !</p>
                </div>
            )}
        </div>
    );
}
