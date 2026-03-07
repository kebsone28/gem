import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, MapPin, X, CheckCircle2 } from 'lucide-react';

interface ClusterPanelData {
    id: string;
    name: string;
    count: number;
    type: string;
    bbox: [[number, number], [number, number]];
}

interface Props {
    isDarkMode?: boolean;
    onClose: () => void;
    clusters: ClusterPanelData[];
    activeGrappeId: string | null;
    onSelectGrappe: (id: string | null, bbox?: [[number, number], [number, number]]) => void;
}

// Couleurs utilisées de manière déterministe par MapLibre et le Panel
const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e', '#6366f1'
];

export function GrappeSelectorPanel({ isDarkMode = true, onClose, clusters, activeGrappeId, onSelectGrappe }: Props) {
    const [search, setSearch] = useState('');

    const bg = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
    const text = isDarkMode ? 'text-white' : 'text-slate-900';
    const subText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

    const renderClusters = useMemo(() => {
        let list = clusters.sort((a, b) => b.count - a.count);
        if (search) {
            list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()));
        }
        return list;
    }, [clusters, search]);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`absolute top-16 right-4 z-[40] w-80 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden ${bg}`}
            style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl">
                        <Layers size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <h3 className={`font-bold ${text}`}>Régionalisation</h3>
                        <p className={`text-xs ${subText}`}>{clusters.length} grappes générées</p>
                    </div>
                </div>
                <button onClick={onClose} className={`p-1.5 rounded-lg hover:bg-slate-500/10 ${subText}`} title="Fermer le panneau">
                    <X size={16} />
                </button>
            </div>

            <div className="p-3">
                <input
                    type="text"
                    placeholder="Chercher une grappe..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-2">
                {/* Reset button */}
                <button
                    onClick={() => onSelectGrappe(null)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${activeGrappeId === null
                        ? (isDarkMode ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700')
                        : (isDarkMode ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50')
                        }`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <MapPin size={14} />
                    </div>
                    <div className="flex-1">
                        <p className={`text-sm font-bold ${activeGrappeId === null ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : text}`}>
                            🌍 Toutes les zones
                        </p>
                        <p className={`text-[10px] ${subText}`}>Afficher l'ensemble du territoire</p>
                    </div>
                    {activeGrappeId === null && <CheckCircle2 size={16} className="text-indigo-500" />}
                </button>

                {/* Individual Clusters */}
                {renderClusters.map((c) => {
                    const isActive = activeGrappeId === c.id;
                    const color = COLORS[parseInt(c.id.replace(/\D/g, '')) % COLORS.length] || COLORS[0];

                    return (
                        <button
                            key={c.id}
                            onClick={() => onSelectGrappe(c.id, c.bbox)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${isActive
                                ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-800')
                                : (isDarkMode ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50')
                                }`}
                        >
                            <div
                                className="cluster-color-swatch w-4 h-8 rounded-md flex-shrink-0"
                                style={{ '--swatch-color': color } as React.CSSProperties}
                            />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isActive ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : text}`}>
                                    {c.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className={`text-[10px] font-medium ${subText}`}>{c.count} ménages</p>
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                                        <div className="h-full bg-emerald-500 w-0" /> {/* % placeholder status */}
                                    </div>
                                </div>
                            </div>
                            {isActive && <CheckCircle2 size={16} className="text-emerald-500" />}
                        </button>
                    );
                })}
            </div>

        </motion.div>
    );
}
