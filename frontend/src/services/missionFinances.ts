/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
export interface ExpenseItem {
  id: string;
  category: 'transport' | 'accommodation' | 'meals' | 'materials' | 'other';
  description: string;
  amount: number;
  date: string;
  receipt?: string; // Base64 image
  approved: boolean;
  approvedBy?: string;
}

export interface FuelStats {
  kmStart: number;
  kmEnd: number;
  rate: number;
}

interface FinancialSummary {
  personelCosts: number;
  transportCosts: number;
  otherExpenses: number;
  totalBudgeted: number;
  totalActual: number;
  variance: number;
  variancePercentage: number;
}

export const calculateFinancialSummary = (
  members: { dailyIndemnity: number; days: number }[],
  expenses: ExpenseItem[] | undefined,
  fuelStats: FuelStats | undefined
): FinancialSummary => {
  // Personnel costs
  const personelCosts = members.reduce((sum, m) => sum + m.dailyIndemnity * m.days, 0);

  // Fuel costs
  const kmTraveled = (fuelStats?.kmEnd || 0) - (fuelStats?.kmStart || 0);
  const fuelCosts = kmTraveled * (fuelStats?.rate || 0);

  // Other expenses
  const otherExpenses = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

  const totalActual = personelCosts + fuelCosts + otherExpenses;

  return {
    personelCosts,
    transportCosts: fuelCosts,
    otherExpenses,
    totalBudgeted: personelCosts, // Base budget is personnel
    totalActual,
    variance: totalActual - personelCosts,
    variancePercentage:
      personelCosts > 0 ? ((totalActual - personelCosts) / personelCosts) * 100 : 0,
  };
};

export const addExpense = (
  expenses: ExpenseItem[] | undefined,
  expense: Omit<ExpenseItem, 'id'>
): ExpenseItem[] => {
  const newExpense: ExpenseItem = {
    ...expense,
    id: `exp_${Date.now()}`,
  };
  return [...(expenses || []), newExpense];
};

export const removeExpense = (
  expenses: ExpenseItem[] | undefined,
  expenseId: string
): ExpenseItem[] => {
  return (expenses || []).filter((e) => e.id !== expenseId);
};

export const approveExpense = (
  expenses: ExpenseItem[] | undefined,
  expenseId: string,
  approverName: string
): ExpenseItem[] => {
  return (expenses || []).map((e) =>
    e.id === expenseId ? { ...e, approved: true, approvedBy: approverName } : e
  );
};

export const generateFinanceReport = (summary: FinancialSummary, memberName: string) => {
  return `
RAPPORT FINANCIER - ${memberName}
================================

COÛTS PERSONNELS:        ${summary.personelCosts.toLocaleString('fr-FR')} XOF
FRAIS DE TRANSPORT:      ${summary.transportCosts.toLocaleString('fr-FR')} XOF
AUTRES DÉPENSES:         ${summary.otherExpenses.toLocaleString('fr-FR')} XOF
                         ─────────────────────────
TOTAL RÉALISÉ:           ${summary.totalActual.toLocaleString('fr-FR')} XOF

VARIANCE:                 ${summary.variance > 0 ? '+' : ''}${summary.variance.toLocaleString('fr-FR')} XOF (${summary.variancePercentage.toFixed(1)}%)

${Math.abs(summary.variancePercentage) < 5 ? '✓ Budget maîtrisé' : '⚠️ Dépassement détecté'}
  `;
};

export const exportFinancialDataCSV = (expenses: ExpenseItem[]): string => {
  const header = 'Date,Catégorie,Description,Montant (XOF),Approuvé\n';
  const rows = expenses
    .map(
      (e) =>
        `${e.date},"${e.category}","${e.description}",${e.amount},${e.approved ? 'OUI' : 'NON'}`
    )
    .join('\n');

  return header + rows;
};
