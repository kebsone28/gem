/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { DollarSign } from 'lucide-react';
import { calculateBudgetConsumption, formatFCFA } from '../../../utils/missionBudget';

interface MissionBudgetPanelProps {
  totalFrais: number;
  projectBudget: number;
  members: any[];
}

export const MissionBudgetPanel: React.FC<MissionBudgetPanelProps> = ({
  totalFrais,
  projectBudget,
  members,
}) => {
  const consumption = calculateBudgetConsumption(totalFrais, projectBudget);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-[1.8rem] sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full transition-transform duration-700 group-hover:scale-[2]" />
      <div className="relative z-10 space-y-4 sm:space-y-6">
        <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.14em] sm:tracking-[0.2em] flex items-center gap-2">
          <DollarSign size={14} className="text-emerald-500" /> Projection Budgétaire
        </h3>

        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-white italic tracking-tighter">
            {formatFCFA(totalFrais)}{' '}
            <span className="text-sm sm:text-lg lg:text-xl text-emerald-500 font-bold ml-1">XOF</span>
          </div>
          {projectBudget > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${consumption > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, consumption)}%` }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-slate-500 whitespace-nowrap">
                {consumption.toFixed(1)}% du Budget Projet
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2.5 pt-4 sm:pt-6 border-t border-slate-800">
          {members.slice(0, 4).map((m, i) => (
            <div key={i} className="flex justify-between items-center gap-3 text-[11px] sm:text-xs">
              <span className="text-slate-400 font-bold truncate max-w-[140px]">
                {m.name || 'Non assigné'}
              </span>
              <div className="flex flex-col items-end">
                <span className="text-white font-black font-mono text-[11px] sm:text-xs">
                  {formatFCFA(m.dailyIndemnity * m.days)}{' '}
                  <span className="text-[10px] text-slate-500">XOF</span>
                </span>
              </div>
            </div>
          ))}
          {members.length > 4 && (
            <div className="text-xs font-black text-slate-600 dark:text-slate-400 text-center pt-2 uppercase tracking-widest">
              + {members.length - 4} Autres...
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
