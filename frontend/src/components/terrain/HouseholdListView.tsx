import React from 'react';
import { motion } from 'framer-motion';
import { FileDown, MapPin } from 'lucide-react';
import type { Household } from '../../utils/types';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';

interface HouseholdListViewProps {
    households: Household[];
    isDarkMode: boolean;
    onSelectHousehold: (household: Household) => void;
}

export const HouseholdListView: React.FC<HouseholdListViewProps> = ({ 
    households, 
    isDarkMode, 
    onSelectHousehold 
}) => {
    return (
        <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`h-full w-full overflow-hidden flex flex-col rounded-3xl border shadow-lg ${isDarkMode ? 'bg-transparent border-none' : 'bg-white border-slate-200'}`}
        >
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500">Ménages ({households.length})</h3>
                <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                >
                    <FileDown size={14} /> Exporter CSV
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className={`sticky top-0 z-10 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                        <tr>
                            <th className="px-6 py-4">ID / Propriétaire</th>
                            <th className="px-6 py-4">Région</th>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4 flex justify-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                        {households.slice(0, 100).map(h => (
                            <tr key={h.id} className={`transition-colors hover:${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                            <MapPin size={14} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{h.id}</span>
                                            <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {typeof h.owner === 'object' && h.owner !== null ? ((h.owner as any).nom || '—') : (h.owner || '—')}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                        {h.region || '—'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {(() => {
                                        const status = getHouseholdDerivedStatus(h);
                                        const colors = getStatusTailwindClasses(status);
                                        return (
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                                                {status}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onSelectHousehold(h)}
                                        className="text-indigo-500 hover:text-indigo-600 font-bold text-xs"
                                    >
                                        Détails
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};
