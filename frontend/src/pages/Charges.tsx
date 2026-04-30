/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react';
import {
  Download,
  RefreshCcw,
  DollarSign,
  PieChart as PieIcon,
  Table as TableIcon,
  ArrowUpRight,
  Package,
  Wrench,
} from 'lucide-react';
import { useFinances } from '../hooks/useFinances';
import FinancialKpis from '../components/finances/FinancialKpis';
import CostPieChart from '../components/finances/CostPieChart';
import DetailedBreakdown from '../components/finances/DetailedBreakdown';
import DevisVsReel from '../components/finances/DevisVsReel';
import MaterialDatabase from '../components/finances/MaterialDatabase';
import ChargeDotationsSection from '../components/finances/ChargeDotationsSection';
import { motion, AnimatePresence } from 'framer-motion';
import SparklineChart from '../components/finances/SparklineChart';
import { useTheme } from '../contexts/ThemeContext';
import { useProject } from '../contexts/ProjectContext';
import { exportFinancialPDF } from '../services/exportService';
import { Database } from 'lucide-react';

import { PageContainer, Section, DESIGN_TOKENS, COMMON_CLASSES } from '../components';

export default function Charges() {
  const { isLoading, stats, devis, project, toggleClientProvidesMaterials } = useFinances();
  const { refreshProjects } = useProject();
  const [activeTab, setActiveTab] = useState<'overview' | 'devis' | 'dotations' | 'inventory'>(
    'overview'
  );
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
      <div className={`${COMMON_CLASSES.card} mb-6 overflow-hidden p-4 sm:p-5 lg:p-6`}>
        <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
              <DollarSign size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                Charges
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Bilan financier prévisionnel et suivi des marges réelles.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center xl:justify-end">
            <button
              onClick={toggleClientProvidesMaterials}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition-all sm:px-4 ${isClientProvided ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' : COMMON_CLASSES.btnSecondary}`}
            >
              <Package size={13} className="shrink-0" />
              <span className="truncate">
                {isClientProvided ? 'Matériaux Fournis par Client' : 'Fourniture Entrepreneur'}
              </span>
            </button>

            <div
              className={`${COMMON_CLASSES.card} grid min-w-0 grid-cols-1 gap-1 rounded-xl p-1 transition-all sm:grid-cols-4 lg:w-auto`}
            >
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition-all ${activeTab === 'overview' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <PieIcon size={14} className="shrink-0" />
                <span className="truncate">Analyse</span>
              </button>
              <button
                onClick={() => setActiveTab('devis')}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition-all ${activeTab === 'devis' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <TableIcon size={14} className="shrink-0" />
                <span className="truncate">Devis</span>
              </button>
              <button
                onClick={() => setActiveTab('dotations')}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition-all ${activeTab === 'dotations' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <Wrench size={14} className="shrink-0" />
                <span className="truncate">Dotations</span>
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition-all ${activeTab === 'inventory' ? COMMON_CLASSES.btnPrimary : 'text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white'}`}
              >
                <Database size={14} className="shrink-0" />
                <span className="truncate">Matériels</span>
              </button>
            </div>
            <button
              aria-label="Actualiser les données"
              onClick={() => {
                void refreshProjects(project?.id);
              }}
              className={`${COMMON_CLASSES.btnSecondary} flex h-11 w-full shrink-0 items-center justify-center rounded-xl p-2.5 lg:w-11`}
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>
      </div>

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
        ) : activeTab === 'devis' ? (
          <motion.div
            id="financial-analysis-content"
            key="devis"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Section title="Devis entreprise vs coûts réels">
              <DevisVsReel />
            </Section>
          </motion.div>
        ) : activeTab === 'dotations' ? (
          <motion.div
            id="financial-analysis-content"
            key="dotations"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Section title="Dotations et charges associées">
              <ChargeDotationsSection />
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
