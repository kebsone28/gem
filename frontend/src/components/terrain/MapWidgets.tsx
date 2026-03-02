import React, { useState } from 'react';
import {
    LayoutGrid,
    ChevronDown,
    ChevronUp,
    Settings,
    Layers,
    Activity,
    Search,
    Sun,
    Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

interface WidgetBarProps {
    activeWidgets: {
        pipeline: boolean;
        kpi: boolean;
        tools: boolean;
        search: boolean;
    };
    onToggleWidget: (id: string) => void;
}

export const WidgetBar: React.FC<WidgetBarProps> = ({ activeWidgets, onToggleWidget }) => {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1">
            <div className={`p-0.5 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-0.5 ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                <button
                    onClick={() => onToggleWidget('pipeline')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeWidgets.pipeline
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                >
                    <Activity size={12} />
                    Pipeline
                </button>
                <button
                    onClick={() => onToggleWidget('kpi')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeWidgets.kpi
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                >
                    <LayoutGrid size={12} />
                    KPI
                </button>
                <button
                    onClick={() => onToggleWidget('tools')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeWidgets.tools
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                >
                    <Settings size={12} />
                    Outils
                </button>
                <button
                    onClick={() => onToggleWidget('search')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeWidgets.search
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                >
                    <Search size={12} />
                    Recherche
                </button>

                <div className={`w-px h-3 mx-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

                <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${isDarkMode ? 'text-amber-400 hover:bg-amber-400/10' : 'text-indigo-600 hover:bg-indigo-50'}`}
                    title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
                >
                    {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                    <span className="hidden lg:inline">{isDarkMode ? 'Clair' : 'Sombre'}</span>
                </button>
            </div>
        </div>
    );
};

interface PipelineWidgetProps {
    selectedPhases: string[];
    onTogglePhase: (phase: string) => void;
}

export const PipelineWidget: React.FC<PipelineWidgetProps> = ({ selectedPhases, onTogglePhase }) => {
    const { isDarkMode } = useTheme();
    const [isMinimized, setIsMinimized] = useState(false);

    const phases = [
        { label: 'Toutes', color: 'bg-indigo-500', value: 'all' },
        { label: 'Non débuté', color: 'bg-slate-400', value: 'Non débuté' },
        { label: 'Murs', color: 'bg-amber-500', value: 'Murs' },
        { label: 'Réseau', color: 'bg-blue-500', value: 'Réseau' },
        { label: 'Intérieur', color: 'bg-indigo-500', value: 'Intérieur' },
        { label: 'Terminé', color: 'bg-emerald-500', value: 'Terminé' },
        { label: 'Alertes/Bloqué', color: 'bg-red-500', value: 'Problème' }
    ];

    const isPhaseSelected = (value: string) => {
        if (value === 'all') return selectedPhases.length === phases.length - 1;
        return selectedPhases.includes(value);
    };

    return (
        <motion.div
            drag
            dragMomentum={false}
            className={`absolute bottom-32 left-8 z-[1000] w-56 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl transition-colors ${isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}
        >
            <div className="p-4 bg-indigo-600 flex items-center justify-between cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-white" />
                    <span className="text-xs font-black text-white italic uppercase tracking-widest">Pipeline Travaux</span>
                </div>
                <button onClick={() => setIsMinimized(!isMinimized)} className="text-white/50 hover:text-white transition-colors">
                    {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="p-5 space-y-4"
                    >
                        <div className={`flex items-center justify-between text-[10px] font-black uppercase transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Phases</span>
                            <Layers size={12} />
                        </div>

                        <div className="space-y-2">
                            {phases.map((phase, i) => {
                                const active = isPhaseSelected(phase.value);
                                return (
                                    <div
                                        key={i}
                                        onClick={() => onTogglePhase(phase.value)}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${active ? (isDarkMode ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm shadow-indigo-100') : (isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full ${phase.color}`} />
                                            <span className="text-[11px] tracking-tight">{phase.label}</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            title={`Filtrer par ${phase.label}`}
                                            checked={active}
                                            onChange={() => { }}
                                            className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export const KpiWidget: React.FC<{
    statsData: {
        total: number;
        enAttente: number;
        enCours: number;
        termine: number;
        bloque: number;
    } | null;
}> = ({ statsData }) => {
    const { isDarkMode } = useTheme();
    const [isMinimized, setIsMinimized] = useState(false);

    const stats = [
        { label: 'Conformes', value: statsData?.termine || 0, color: 'text-emerald-500', bgColor: 'bg-emerald-500' },
        { label: 'En cours', value: statsData?.enCours || 0, color: 'text-blue-500', bgColor: 'bg-blue-500' },
        { label: 'Problèmes', value: statsData?.bloque || 0, color: 'text-amber-500', bgColor: 'bg-amber-500' }
    ];

    const total = statsData?.total || 0;
    const completedPct = total > 0 ? Math.round(((statsData?.termine || 0) / total) * 100) : 0;

    return (
        <motion.div
            drag
            dragMomentum={false}
            className={`absolute bottom-32 right-8 z-[1000] w-56 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl transition-colors ${isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}
        >
            <div className="p-4 bg-indigo-600 flex items-center justify-between cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2">
                    <LayoutGrid size={16} className="text-white" />
                    <span className="text-xs font-black text-white italic uppercase tracking-widest">Tableau de bord</span>
                </div>
                <button onClick={() => setIsMinimized(!isMinimized)} className="text-white/50 hover:text-white transition-colors">
                    {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="p-6 space-y-6"
                    >
                        <div className={`flex justify-between items-center text-[10px] font-black uppercase transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Total</span>
                            <span className={isDarkMode ? 'text-white font-bold' : 'text-slate-900 font-bold'}>{total}</span>
                        </div>

                        <div className="space-y-4">
                            {stats.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${s.bgColor}`} />
                                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{s.label}</span>
                                    </div>
                                    <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className={`pt-4 border-t transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <div className="flex justify-between text-[11px] mb-2 font-black uppercase tracking-tight">
                                <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{completedPct}% complété</span>
                                <span className="text-indigo-600 font-black">{total} CIBLES</span>
                            </div>
                            <div className={`h-1.5 w-full rounded-full overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completedPct}%` }}
                                    className="h-full bg-indigo-500 rounded-full"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
