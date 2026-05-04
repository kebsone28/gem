/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Wallet } from 'lucide-react';
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
  const over = consumption > 100;
  const warn = consumption > 80;

  return (
    <section className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-xl relative overflow-hidden group">
      {/* Ambient glow */}
      <div className={`absolute -top-4 -right-4 w-28 h-28 blur-[50px] rounded-full transition-all duration-700 group-hover:scale-150 ${over ? 'bg-rose-500/20' : warn ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`} />

      <div className="relative z-10 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Wallet size={11} className={over ? 'text-rose-400' : 'text-emerald-400'} />
            Budget Mission
          </span>
          {projectBudget > 0 && (
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
              over ? 'bg-rose-500/20 text-rose-400' : warn ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {consumption.toFixed(0)}%
            </span>
          )}
        </div>

        {/* Montant total */}
        <div>
          <div className={`text-xl font-black tracking-tight leading-none ${over ? 'text-rose-400' : 'text-white'}`}>
            {formatFCFA(totalFrais)}
            <span className="text-xs text-slate-500 font-bold ml-1">XOF</span>
          </div>
          {projectBudget > 0 && (
            <div className="mt-2 space-y-1">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-rose-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, consumption)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-black text-slate-600">
                <span>0</span>
                <span className={over ? 'text-rose-400' : warn ? 'text-amber-400' : 'text-emerald-500'}>
                  {formatFCFA(projectBudget)} XOF budget
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Membres */}
        {members.length > 0 && (
          <div className="space-y-1.5 pt-2.5 border-t border-slate-800/80">
            {members.slice(0, 5).map((m, i) => (
              <div key={i} className="flex justify-between items-center gap-2 group/row">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                  <span className="text-[9px] text-slate-400 font-semibold truncate">
                    {m.name || 'Non assigné'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-300 font-black font-mono shrink-0">
                  {formatFCFA(m.dailyIndemnity * m.days)}
                </span>
              </div>
            ))}
            {members.length > 5 && (
              <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest text-center pt-1">
                +{members.length - 5} autres membres
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
