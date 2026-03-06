import { useState } from 'react';
import {
    Download,
    RefreshCcw,
    Zap,
    DollarSign,
    PieChart as PieIcon,
    Table as TableIcon,
    ArrowUpRight,
    Package
} from 'lucide-react';
import { useFinances } from '../hooks/useFinances';
import FinancialKpis from '../components/finances/FinancialKpis';
import CostPieChart from '../components/finances/CostPieChart';
import DetailedBreakdown from '../components/finances/DetailedBreakdown';
import DevisVsReel from '../components/finances/DevisVsReel';
import MaterialDatabase from '../components/finances/MaterialDatabase';
import { motion, AnimatePresence } from 'framer-motion';
import SparklineChart from '../components/finances/SparklineChart';
import { useTheme } from '../context/ThemeContext';
import { exportToPDF } from '../services/exportService';
import { Database } from 'lucide-react';

export default function Charges() {
    const { isLoading, stats, devis, project, toggleClientProvidesMaterials } = useFinances();
    const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'inventory'>('overview');
    const { isDarkMode } = useTheme();

    const isClientProvided = !!project?.config?.clientProvidesMaterials;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-10 pb-20">
            {/* Header Section */}
            <header className="flex flex-col gap-4">
                <div>
                    <h1 className={`text-2xl md:text-4xl font-black italic tracking-tighter flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <div className="p-2 md:p-3 bg-indigo-600 rounded-xl md:rounded-2xl text-white shadow-xl shadow-indigo-500/20 shrink-0">
                            <DollarSign size={20} />
                        </div>
                        CHARGES & FINANCES
                    </h1>
                    <p className={`text-[12px] font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Bilan financier prévisionnel et suivi des marges réelles.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                        onClick={toggleClientProvidesMaterials}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border whitespace-nowrap ${isClientProvided ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm'}`}
                    >
                        <Package size={13} />
                        <span className="hidden sm:inline">{isClientProvided ? 'Matériaux Fournis par Client' : 'Fourniture Entrepreneur'}</span>
                        <span className="sm:hidden">{isClientProvided ? 'Client fournit' : 'Entrepreneur'}</span>
                    </button>

                    <div className={`backdrop-blur-md border p-1 rounded-2xl flex overflow-x-auto scrollbar-none transition-all w-full sm:w-auto ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                        >
                            <PieIcon size={14} />
                            ANALYSE
                        </button>
                        <button
                            onClick={() => setActiveTab('comparison')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'comparison' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                        >
                            <TableIcon size={14} />
                            PRESTATION (DEVIS)
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                        >
                            <Database size={14} />
                            MATÉRIELS
                        </button>
                    </div>
                    <button
                        title="Actualiser les données"
                        className={`p-2.5 border rounded-2xl transition-all shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm'}`}
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </header>

            <AnimatePresence mode="wait">
                {activeTab === 'overview' ? (
                    <motion.div
                        id="financial-analysis-content"
                        key="overview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <FinancialKpis stats={stats} devis={devis} />

                        <SparklineChart />

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="xl:col-span-1">
                                <CostPieChart stats={stats} />
                            </div>
                            <div className="xl:col-span-2">
                                <DetailedBreakdown stats={stats} />
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'comparison' ? (
                    <motion.div
                        id="financial-analysis-content"
                        key="comparison"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <DevisVsReel />
                    </motion.div>
                ) : (
                    <motion.div
                        id="financial-analysis-content"
                        key="inventory"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <MaterialDatabase />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Summary Footer Card */}
            <div className={`rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 overflow-hidden relative shadow-2xl transition-all ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                <div className="absolute top-0 right-0 p-10 opacity-10 blur-xl">
                    <Zap size={240} className="text-white" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-8">
                    <div>
                        <h3 className="text-xl md:text-3xl font-black text-white mb-1 md:mb-2 italic tracking-tighter uppercase">Besoin d'un rapport complet ?</h3>
                        <p className="text-indigo-100/70 font-medium text-xs md:text-sm max-w-xl">Générez une analyse financière détaillée incluant tous les postes de dépense et les projections de marge.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            id="pdf-export-trigger"
                            onClick={async () => {
                                const ok = await exportToPDF('financial-analysis-content', {
                                    title: 'Bilan Financier Prévisionnel',
                                    subtitle: 'Détail des charges, marges et KPIs du projet actif.',
                                    filename: 'bilan_financier'
                                });
                                if (ok) {
                                    console.log('PDF généré');
                                }
                            }}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl"
                        >
                            <Download size={18} />
                            EXPORTER PDF
                        </button>
                        <button className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-xs transition-all border ${isDarkMode ? 'bg-indigo-500/20 text-white border-white/10 hover:bg-indigo-500/30' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'}`}>
                            EXPLORER LES SCÉNARIOS
                            <ArrowUpRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
