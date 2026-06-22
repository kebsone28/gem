import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@hooks/usePermissions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/store/db';
import { motion } from 'framer-motion';
import {
   ShieldCheck,
   DollarSign,
   TrendingUp,
   FileText,
   Calculator,
   CreditCard,
   AlertTriangle,
   BarChart3,
   PieChart,
   Activity,
   Download,
   Eye,
   CheckCircle2,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '@components';
import {
   DASHBOARD_ACTION_TILE_PRIMARY,
   DASHBOARD_ACTION_TILE_SECONDARY,
   DASHBOARD_MINI_STAT_CARD,
   DASHBOARD_STICKY_PANEL,
   StatusBadge,
   KPICard,
} from '@components/dashboards/DashboardComponents';
import { fmtNum } from '@utils/format';
import { useLabels } from '@contexts/LabelsContext';

interface BudgetMetrics {
  totalBudget: number;
  utilizedBudget: number;
  remainingBudget: number;
  utilizationRate: number;
  monthlyBurnRate: number;
  projectedCompletion: number;
  budgetVariance: number;
}

interface CashFlowMetrics {
  currentBalance: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  netCashFlow: number;
  cashFlowTrend: 'up' | 'down' | 'stable';
  workingCapital: number;
  liquidityRatio: number;
}

interface FinancialReports {
  revenueGenerated: number;
  operatingCosts: number;
  grossMargin: number;
  netProfit: number;
  profitMargin: number;
  expensesBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

interface ComplianceMetrics {
  auditScore: number;
  complianceRate: number;
  pendingAudits: number;
  validatedTransactions: number;
  flaggedTransactions: number;
  lastAuditDate: Date;
}

const ViewSelector = ({ selectedView, setSelectedView }: { 
  selectedView: 'overview' | 'budget' | 'cashflow' | 'reports' | 'compliance';
  setSelectedView: React.Dispatch<React.SetStateAction<'overview' | 'budget' | 'cashflow' | 'reports' | 'compliance'>>;
}) => (
  <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
    {[
      { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
      { id: 'budget', label: 'Budget', icon: Calculator },
      { id: 'cashflow', label: 'Trésorerie', icon: CreditCard },
      { id: 'reports', label: 'Rapports', icon: FileText },
      { id: 'compliance', label: 'Conformité', icon: CheckCircle2 },
    ].map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => setSelectedView(id as any)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          selectedView === id
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon size={16} />
        {label}
      </button>
    ))}
  </div>
);

export default function AccountingDashboard() {
   const { peut, PERMISSIONS } = usePermissions();
   const { getLabel } = useLabels();
   const navigate = useNavigate();
   const households = useLiveQuery(() => db.households.toArray()) || [];

   const [selectedView, setSelectedView] = useState<
     'overview' | 'budget' | 'cashflow' | 'reports' | 'compliance'
   >('overview');
   const canExportAccounting = peut(PERMISSIONS.FINANCE_EXPORT);

   // Calcul des métriques budgétaires
   const budgetMetrics: BudgetMetrics = useMemo(() => {
     // Simulation de données budgétaires (à remplacer avec vraies données)
     const totalBudget = 50000000; // 50M FCFA
     const completedHouseholds = households.filter((h) => h.status === 'Terminé').length;
     const totalHouseholds = households.length;
     const progress = totalHouseholds > 0 ? completedHouseholds / totalHouseholds : 0;

     const utilizedBudget = totalBudget * progress;
     const remainingBudget = totalBudget - utilizedBudget;
     const utilizationRate = (utilizedBudget / totalBudget) * 100;
     const monthlyBurnRate = totalBudget / 12; // 12 mois de projet
     const projectedCompletion = progress > 0 ? totalBudget / (utilizedBudget / progress) : 0;
     const budgetVariance = utilizationRate > 100 ? -5 : utilizationRate > 80 ? 2 : 0; // déterministe

     return {
       totalBudget,
       utilizedBudget,
       remainingBudget,
       utilizationRate,
       monthlyBurnRate,
       projectedCompletion,
       budgetVariance,
     };
   }, [households]);

   // Calcul des métriques de trésorerie
   const cashFlowMetrics: CashFlowMetrics = useMemo(() => {
     const currentBalance = budgetMetrics.remainingBudget;
     const monthlyInflow = 5000000; // 5M FCFA/mois
     const monthlyOutflow = budgetMetrics.monthlyBurnRate;
     const netCashFlow = monthlyInflow - monthlyOutflow;
     const cashFlowTrend = netCashFlow > 0 ? 'up' : netCashFlow < 0 ? 'down' : 'stable';
     const workingCapital = currentBalance * 0.3; // 30% en fonds de roulement
     const liquidityRatio = currentBalance > 0 ? currentBalance / monthlyOutflow : 0;

     return {
       currentBalance,
       monthlyInflow,
       monthlyOutflow,
       netCashFlow,
       cashFlowTrend,
       workingCapital,
       liquidityRatio,
     };
   }, [budgetMetrics]);

   // Calcul des rapports financiers
   const financialReports: FinancialReports = useMemo(() => {
     const revenueGenerated = budgetMetrics.utilizedBudget * 1.1; // 10% marge
     const operatingCosts = budgetMetrics.utilizedBudget;
     const grossMargin = revenueGenerated - operatingCosts;
     const netProfit = grossMargin * 0.85; // 15% impôts
     const profitMargin = (netProfit / revenueGenerated) * 100;

     const expensesBreakdown = [
       { category: 'Salaires', amount: operatingCosts * 0.4, percentage: 40 },
       { category: 'Matériel', amount: operatingCosts * 0.3, percentage: 30 },
       { category: 'Logistique', amount: operatingCosts * 0.2, percentage: 20 },
       { category: 'Autres', amount: operatingCosts * 0.1, percentage: 10 },
     ];

     return {
       revenueGenerated,
       operatingCosts,
       grossMargin,
       netProfit,
       profitMargin,
       expensesBreakdown,
     };
   }, [budgetMetrics]);

   // Calcul des métriques de conformité
   const complianceMetrics: ComplianceMetrics = useMemo(() => {
     const auditScore = 90; // score fixe — remplacer par API audit réelle
     const complianceRate = 94; // taux fixe — remplacer par API
     const pendingAudits = 0; // à brancher sur API
     const validatedTransactions = Math.floor(households.length * 0.95);
     const flaggedTransactions = Math.floor(households.length * 0.05);
     const lastAuditDate = new Date(new Date().setDate(new Date().getDate() - 7));

     return {
       auditScore,
       complianceRate,
       pendingAudits,
       validatedTransactions,
       flaggedTransactions,
       lastAuditDate,
     };
   }, [households]);

   return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title={getLabel('finance.dashboard_title', 'TABLEAU DE BORD COMPTABILITÉ')}
        subtitle={getLabel('finance.dashboard_subtitle', 'Gestion financière, budget et conformité des projets')}
        icon={
          <ShieldCheck
            size={28}
            className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
          />
        }
        className="relative z-10 pt-6 pb-4"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-3 sm:px-6 lg:px-12 pb-16 sm:pb-24 space-y-6 sm:space-y-8 lg:space-y-12">
          {/* Header avec navigation */}
          <header className={DASHBOARD_STICKY_PANEL}>
               <div className="flex flex-col gap-4">
                 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                   <div className="min-w-0">
                     <div className="mb-2 flex flex-wrap items-center gap-2">
                       <StatusBadge status="success" label="Comptable" />
                       <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                         Gestion financière complète
                       </span>
                     </div>
                     <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                       Console financière
                     </h2>
                     <p className="text-[13px] text-slate-400">
                       Suivi budgétaire, trésorerie et conformité réglementaire.
                     </p>
                   </div>
                   <ViewSelector selectedView={selectedView} setSelectedView={setSelectedView} />
                 </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-2 gap-3">
                {canExportAccounting && (
                  <button
                    onClick={() => navigate('/rapports/comptables')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Download size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Exporter
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Rapports comptables</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewPayments && (
                  <button
                    onClick={() => navigate('/paiements')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Paiements
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Suivi et validation</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewLogistics && (
                  <button
                    onClick={() => navigate('/resources/inventory')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Logistique
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Coûts et stocks</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewFinances && (
                  <button
                    onClick={() => navigate('/finances')}
                    className={DASHBOARD_ACTION_TILE_PRIMARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                        <Eye size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Finances
                        </p>
                        <p className="mt-1 text-[12px] text-blue-100/90">Vue détaillée</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* KPIs principaux */}
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {[
                    {
                      label: 'Budget utilisé',
                      value: `${budgetMetrics.utilizationRate.toFixed(1)}%`,
                      icon: Calculator,
                    },
                    {
                      label: 'Solde actuel',
                      value: fmtNum(cashFlowMetrics.currentBalance),
                      icon: CreditCard,
                    },
                    {
                      label: 'Marge brute',
                      value: `${financialReports.profitMargin.toFixed(1)}%`,
                      icon: TrendingUp,
                    },
                    {
                      label: 'Score audit',
                      value: `${complianceMetrics.auditScore.toFixed(1)}/100`,
                      icon: CheckCircle2,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className={DASHBOARD_MINI_STAT_CARD}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-xl font-black tracking-tight text-white">
                            {value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Vue d'ensemble */}
          {selectedView === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* KPIs financiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
                <KPICard
                  title="BUDGET TOTAL"
                  value={fmtNum(budgetMetrics.totalBudget)}
                  icon={<DollarSign size={22} />}
                  trend={{ value: budgetMetrics.utilizationRate, isUp: true, label: 'UTILISÉ' }}
                />
                <KPICard
                  title="TRÉSORERIE"
                  value={fmtNum(cashFlowMetrics.currentBalance)}
                  icon={<CreditCard size={22} />}
                  trend={{
                    value: cashFlowMetrics.netCashFlow,
                    isUp: cashFlowMetrics.cashFlowTrend === 'up',
                    label: 'NET MENSUEL',
                  }}
                />
                <KPICard
                  title="MARGE NETTE"
                  value={`${financialReports.profitMargin.toFixed(1)}%`}
                  icon={<TrendingUp size={22} />}
                  trend={{ value: 2.5, isUp: true, label: 'CE MOIS' }}
                />
                <KPICard
                  title="CONFORMITÉ"
                  value={`${complianceMetrics.complianceRate.toFixed(1)}%`}
                  icon={<CheckCircle2 size={22} />}
                  trend={{ value: 0.5, isUp: true, label: 'AMÉLIORATION' }}
                />
              </div>

              {/* Répartition des dépenses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <PieChart size={18} className="text-blue-500" /> Répartition des Dépenses
                  </h3>
                  <div className="space-y-3">
                    {financialReports.expensesBreakdown.map((expense) => (
                      <div key={expense.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-blue-500 rounded-full" />
                          <span className="text-sm text-white">{expense.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">
                            {fmtNum(expense.amount)} FCFA
                          </p>
                          <p className="text-xs text-slate-400">{expense.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <AlertTriangle size={18} className="text-blue-500" /> Alertes Financières
                  </h3>
                  <div className="space-y-3">
                    {budgetMetrics.utilizationRate > 80 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm text-amber-400">
                          ⚠️ Budget utilisé à {budgetMetrics.utilizationRate.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {cashFlowMetrics.liquidityRatio < 2 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">🚨 Ratio de liquidité critique</p>
                      </div>
                    )}
                    {complianceMetrics.flaggedTransactions > 0 && (
                      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <p className="text-sm text-orange-400">
                          📋 {complianceMetrics.flaggedTransactions} transactions à vérifier
                        </p>
                      </div>
                    )}
                    {budgetMetrics.utilizationRate <= 80 &&
                      cashFlowMetrics.liquidityRatio >= 2 &&
                      complianceMetrics.flaggedTransactions === 0 && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <p className="text-sm text-emerald-400">✅ Situation financière saine</p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue budget */}
          {selectedView === 'budget' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Calculator size={18} className="text-blue-500" /> Analyse Budgétaire
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Répartition du Budget</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Budget total</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(budgetMetrics.totalBudget)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Budget utilisé</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(budgetMetrics.utilizedBudget)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Budget restant</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {fmtNum(budgetMetrics.remainingBudget)} FCFA
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Indicateurs</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Taux d'utilisation</span>
                        <span className="text-sm font-medium text-white">
                          {budgetMetrics.utilizationRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Burn rate mensuel</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(budgetMetrics.monthlyBurnRate)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Variance budgétaire</span>
                        <span
                          className={`text-sm font-medium ${budgetMetrics.budgetVariance > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {budgetMetrics.budgetVariance > 0 ? '+' : ''}
                          {budgetMetrics.budgetVariance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <ProgressBar
                    label="Progression Budgétaire"
                    count={`${fmtNum(budgetMetrics.utilizedBudget)} / ${fmtNum(budgetMetrics.totalBudget)} FCFA`}
                    percentage={budgetMetrics.utilizationRate}
                    status={
                      budgetMetrics.utilizationRate >= 90
                        ? 'warning'
                        : budgetMetrics.utilizationRate >= 70
                          ? 'info'
                          : 'success'
                    }
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue trésorerie */}
          {selectedView === 'cashflow' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <CreditCard size={18} className="text-blue-500" /> Trésorerie et Cash Flow
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Position Actuelle</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Solde actuel</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(cashFlowMetrics.currentBalance)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Fonds de roulement</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(cashFlowMetrics.workingCapital)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Ratio de liquidité</span>
                        <span className="text-sm font-medium text-white">
                          {cashFlowMetrics.liquidityRatio.toFixed(1)} mois
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Mouvements Mensuels</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Entrées</span>
                        <span className="text-sm font-medium text-emerald-400">
                          +{fmtNum(cashFlowMetrics.monthlyInflow)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Sorties</span>
                        <span className="text-sm font-medium text-red-400">
                          -{fmtNum(cashFlowMetrics.monthlyOutflow)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Net mensuel</span>
                        <span
                          className={`text-sm font-medium ${cashFlowMetrics.netCashFlow > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {cashFlowMetrics.netCashFlow > 0 ? '+' : ''}
                          {fmtNum(cashFlowMetrics.netCashFlow)} FCFA
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue rapports */}
          {selectedView === 'reports' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <FileText size={18} className="text-blue-500" /> Rapports Financiers
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Performance</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Revenus générés</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(financialReports.revenueGenerated)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Coûts opérationnels</span>
                        <span className="text-sm font-medium text-white">
                          {fmtNum(financialReports.operatingCosts)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Marge brute</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {fmtNum(financialReports.grossMargin)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Profit net</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {fmtNum(financialReports.netProfit)} FCFA
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Rentabilité</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Marge nette</span>
                        <span className="text-sm font-medium text-white">
                          {financialReports.profitMargin.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">ROI projet</span>
                        <span className="text-sm font-medium text-white">12.5%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Seuil rentabilité</span>
                        <span className="text-sm font-medium text-emerald-400">Atteint</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue conformité */}
          {selectedView === 'compliance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <CheckCircle2 size={18} className="text-blue-500" /> Conformité et Audit
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Scores de Conformité</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Score d'audit</span>
                        <span className="text-sm font-medium text-white">
                          {complianceMetrics.auditScore.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Taux de conformité</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {complianceMetrics.complianceRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Dernier audit</span>
                        <span className="text-sm font-medium text-white">
                          {complianceMetrics.lastAuditDate.toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3">Transactions</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Transactions validées</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {complianceMetrics.validatedTransactions}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Transactions signalées</span>
                        <span className="text-sm font-medium text-amber-400">
                          {complianceMetrics.flaggedTransactions}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Audits en attente</span>
                        <span className="text-sm font-medium text-blue-400">
                          {complianceMetrics.pendingAudits}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}

const ProgressBar = ({
  label,
  count,
  percentage,
  status = 'info',
}: {
  label: string;
  count: string;
  percentage: number;
  status?: 'success' | 'warning' | 'info' | 'danger';
}) => {
  const colors = {
    success: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    warning: 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    info: 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]',
    danger: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span className="text-[10px] font-black tabular-nums text-white">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5 p-0.5 backdrop-blur-sm">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full ${colors[status]}`}
        />
      </div>
    </div>
  );
};
