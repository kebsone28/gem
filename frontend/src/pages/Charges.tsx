import { useState } from 'react';
import {
  Download,
  RefreshCcw,
  DollarSign,
  PieChart as PieIcon,
  Table as TableIcon,
  ArrowUpRight,
  Package,
} from 'lucide-react';
import { useFinances } from '../hooks/useFinances';
import FinancialKpis from '../components/finances/FinancialKpis';
import CostPieChart from '../components/finances/CostPieChart';
import DetailedBreakdown from '../components/finances/DetailedBreakdown';
import DevisVsReel from '../components/finances/DevisVsReel';
import MaterialDatabase from '../components/finances/MaterialDatabase';
import { motion, AnimatePresence } from 'framer-motion';
import SparklineChart from '../components/finances/SparklineChart';
import { useTheme } from '../contexts/ThemeContext';
import { exportFinancialPDF } from '../services/exportService';
import { Database } from 'lucide-react';

import { PageContainer, PageHeader, Section, DESIGN_TOKENS, COMMON_CLASSES } from '../components';

export default function Charges() {
  const { isLoading, stats, devis, project, toggleClientProvidesMaterials } = useFinances();
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'inventory'>('overview');
  const { isDarkMode } = useTheme();

  const isClientProvided = !!project?.config?.clientProvidesMaterials;

  if (isLoading) {
    return (
      <div className={`${COMMON_CLASSES.flexCenter} min-h-[60vh]`}>
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="CHARGES & FINANCES"
        subtitle="Bilan financier prévisionnel et suivi des marges réelles."
        icon={DollarSign}
        actions={
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={toggleClientProvidesMaterials}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border whitespace-nowrap ${isClientProvided ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' : COMMON_CLASSES.btnSecondary}`}
            >
              <Package size={13} />
              <span className="hidden sm:inline">
                {isClientProvided ? 'Matériaux Fournis par Client' : 'Fourniture Entrepreneur'}
              </span>
              <span className="sm:hidden">
                {isClientProvided ? 'Client fournit' : 'Entrepreneur'}
              </span>
            </button>

            <div
              className={`${COMMON_CLASSES.card} p-1 rounded-2xl flex overflow-x-auto scrollbar-none transition-all w-full sm:w-auto`}
            >
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'overview' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <PieIcon size={14} />
                ANALYSE
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'comparison' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <TableIcon size={14} />
                PRESTATION (DEVIS)
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'inventory' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <Database size={14} />
                MATÉRIELS
              </button>
            </div>
            <button
              aria-label="Actualiser les données"
              className={`${COMMON_CLASSES.btnSecondary} p-2.5 shrink-0`}
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        }
      />

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
            <Section aria-label="Indicateurs Financiers">
              <FinancialKpis stats={stats} devis={devis} />
            </Section>

            <Section title="Évolution">
              <SparklineChart />
            </Section>

            <div className={COMMON_CLASSES.grid2}>
              <Section title="Répartition des Coûts">
                <CostPieChart stats={stats} />
              </Section>
              <Section title="Détail par Catégorie">
                <DetailedBreakdown stats={stats} />
              </Section>
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
            <Section title="Devis vs Réel">
              <DevisVsReel />
            </Section>
          </motion.div>
        ) : (
          <motion.div
            id="financial-analysis-content"
            key="inventory"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Section title="Base de Données Matériels">
              <MaterialDatabase />
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Summary Footer Card */}
      <div
        className={`${COMMON_CLASSES.card} p-6 md:p-12 overflow-hidden relative shadow-2xl ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-900'}`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-8">
          <div>
            <h3
              className={`${COMMON_CLASSES.heading2} text-white mb-1 md:mb-2 italic tracking-tighter uppercase`}
            >
              Besoin d'un rapport complet ?
            </h3>
            <p className={`${COMMON_CLASSES.body} text-indigo-100/70 text-xs md:text-sm max-w-xl`}>
              Générez une analyse financière détaillée incluant tous les postes de dépense et les
              projections de marge.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button
              id="pdf-export-trigger"
              onClick={async (e) => {
                const target = e.currentTarget;
                const originalHtml = target.innerHTML;
                target.innerHTML = '<span>⏳ GÉNÉRATION...</span>';
                target.disabled = true;
                try {
                  const result = await exportFinancialPDF(
                    devis.report,
                    devis,
                    stats,
                    project?.name
                  );
                  if (result === true) {
                    alert('✅ PDF généré ! Le téléchargement va démarrer.');
                  } else {
                    alert(`❌ Erreur PDF: ${result}`);
                  }
                } finally {
                  target.innerHTML = originalHtml;
                  target.disabled = false;
                }
              }}
              className={`${COMMON_CLASSES.btnPrimary} flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs hover:scale-105 transition-all disabled:opacity-50`}
            >
              <Download size={18} />
              EXPORTER PDF
            </button>
            <button
              className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-xs transition-all border ${isDarkMode ? 'bg-indigo-500/20 text-white border-white/10 hover:bg-indigo-500/30' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'}`}
            >
              EXPLORER LES SCÉNARIOS
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
