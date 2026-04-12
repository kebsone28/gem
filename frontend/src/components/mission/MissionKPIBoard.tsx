import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { MissionReportDay } from '../../pages/mission/core/missionTypes';

interface MissionKPIBoardProps {
  reportDays: MissionReportDay[] | undefined;
  members: any[];
  expenses: any[] | undefined;
}

export const MissionKPIBoard: React.FC<MissionKPIBoardProps> = ({
  reportDays = [],
  members,
  expenses,
}) => {
  // Calculer les KPI
  const totalDays = reportDays.length;
  const completedDays = reportDays.filter((d) => d.isCompleted).length;
  const daysWithPhotos = reportDays.filter((d) => d.photo).length;
  const daysWithGPS = reportDays.filter((d) => d.location).length;
  const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  const approvedExpenses = (expenses || []).filter((e) => e.approved).length || 0;
  const totalExpenseItems = expenses?.length || 0;
  const approvalRate = totalExpenseItems > 0 ? (approvedExpenses / totalExpenseItems) * 100 : 0;

  const getHealthStatus = (rate: number): { color: string; label: string; icon: any } => {
    if (rate === 100) return { color: 'text-emerald-500', label: 'Parfait', icon: CheckCircle2 };
    if (rate >= 80) return { color: 'text-amber-500', label: 'Bon', icon: TrendingUp };
    if (rate >= 50) return { color: 'text-orange-500', label: 'À Améliorer', icon: AlertTriangle };
    return { color: 'text-rose-500', label: 'Critique', icon: AlertTriangle };
  };

  const completionStatus = getHealthStatus(completionRate);
  const dataStatus = getHealthStatus(((daysWithPhotos + daysWithGPS) / (totalDays * 2)) * 100);

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">
        📊 Tableaux de Bord Exécution
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Completion Rate */}
        <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
              Progression Jours
            </span>
            <div className={`${completionStatus.color}`}>
              <completionStatus.icon size={13} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
              {completionRate.toFixed(0)}
              <span className="text-xs text-slate-500">%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  completionRate === 100
                    ? 'bg-emerald-500'
                    : completionRate >= 80
                      ? 'bg-amber-500'
                      : completionRate >= 50
                        ? 'bg-orange-500'
                        : 'bg-rose-500'
                }`}
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 leading-tight">
              {completedDays} / {totalDays} jours réalisés
            </div>
          </div>
        </div>

        {/* Data Collection */}
        <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
              Capture de Données
            </span>
            <div className={`${dataStatus.color}`}>
              <dataStatus.icon size={13} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                {daysWithPhotos + daysWithGPS}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">événements</span>
            </div>
            <div className="space-y-0.5 text-[9px] text-slate-600 dark:text-slate-400 leading-tight">
              <div>📷 {daysWithPhotos} photos terrain</div>
              <div>📍 {daysWithGPS} positions GPS</div>
            </div>
          </div>
        </div>

        {/* Budget Tracking */}
        {totalExpenseItems > 0 && (
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
            <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">
              Dépenses Approuvées
            </span>
            <div className="space-y-1.5">
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {approvalRate.toFixed(0)}
                <span className="text-xs">%</span>
              </div>
              <div className="text-[9px] text-slate-600 dark:text-slate-400 leading-tight">
                {approvedExpenses} / {totalExpenseItems} déboursés validés
              </div>
            </div>
          </div>
        )}

        {/* Team Involvement */}
        <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl space-y-2">
          <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">
            Équipe Mobilisée
          </span>
          <div className="space-y-1.5">
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">
              {members.length}
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 leading-tight">
              opératifs en mission
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies Detected */}
      {completionRate < 50 && totalDays > 0 && (
        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-rose-600 dark:text-rose-500" />
            <span className="text-[9px] font-black text-rose-700 dark:text-rose-300">ALERTE</span>
          </div>
          <p className="text-[10px] text-rose-700 dark:text-rose-200 leading-tight">
            La mission est à {completionRate.toFixed(0)}%. Accélérer les travaux ou investiguer
            retards.
          </p>
        </div>
      )}

      {/* Data Quality Warning */}
      {daysWithPhotos + daysWithGPS < totalDays && totalDays > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-500" />
            <span className="text-xs font-black text-amber-700 dark:text-amber-300">
              QUALITÉ DONNÉES
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-200">
            {totalDays - (daysWithPhotos + daysWithGPS)} jours manquent photos ou GPS. Compléter les
            observations.
          </p>
        </div>
      )}
    </div>
  );
};
