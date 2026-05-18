/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react';
import { calculateBudgetConsumption, formatFCFA } from '../../../../../utils/missionBudget';

interface MissionBudgetPanelProps {
  totalFrais: number;
  projectBudget: number;
  members: any[];
  excludeFromFinance?: boolean;
}

export const MissionBudgetPanel: React.FC<MissionBudgetPanelProps> = ({
  totalFrais,
  projectBudget,
  members,
  excludeFromFinance = false,
}) => {
  const consumption = calculateBudgetConsumption(totalFrais, projectBudget);
  const over   = consumption > 100;
  const warn   = consumption > 80;
  const hasMembers = members.length > 0;

  /* colour palette */
  const palette = excludeFromFinance
    ? { glow: 'from-amber-500/10', bar: 'bg-amber-400', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: 'text-amber-400' }
    : over
    ? { glow: 'from-rose-500/15', bar: 'bg-rose-500', text: 'text-rose-400', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25', icon: 'text-rose-400' }
    : warn
    ? { glow: 'from-amber-500/10', bar: 'bg-amber-400', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: 'text-amber-400' }
    : { glow: 'from-emerald-500/10', bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20', icon: 'text-emerald-400' };

  const pct = Math.min(100, consumption);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#0d1117] border border-white/[0.07] p-4 mb-3 group">
      {/* Ambient glow */}
      <div className={`absolute -top-8 -right-8 w-28 h-28 bg-gradient-radial ${palette.glow} to-transparent blur-3xl rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150`} />

      <div className="relative z-10 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wallet size={11} className={palette.icon} />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
              {excludeFromFinance ? 'Hors Budget' : 'Budget Mission'}
            </span>
          </div>
          {excludeFromFinance ? (
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${palette.badge}`}>OFF-BUDGET</span>
          ) : projectBudget > 0 ? (
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${palette.badge}`}>
              {over ? '⚠ ' : ''}{consumption.toFixed(0)}%
            </span>
          ) : null}
        </div>

        {/* ── Amount ── */}
        <div>
          <div className={`text-[22px] font-black leading-none tracking-tight ${over ? palette.text : 'text-white'}`}>
            {formatFCFA(totalFrais)}
            <span className="text-[10px] text-slate-600 font-bold ml-1.5">XOF</span>
          </div>

          {/* Progress bar */}
          {projectBudget > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="h-[3px] bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${palette.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] text-slate-700 font-bold">0</span>
                <div className="flex items-center gap-1">
                  {over
                    ? <TrendingUp size={8} className="text-rose-500" />
                    : <TrendingDown size={8} className="text-emerald-500" />
                  }
                  <span className={`text-[8px] font-black ${palette.text}`}>
                    {formatFCFA(projectBudget)} XOF
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Members breakdown ── */}
        {hasMembers && (
          <div className="pt-3 border-t border-white/[0.05] space-y-1">
            <div className="flex items-center gap-1 mb-2">
              <Users size={8} className="text-slate-700" />
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-700">Membres</span>
            </div>
            {members.slice(0, 4).map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-4 h-4 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <span className="text-[7px] font-black text-slate-500">{(m.name || '?')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-semibold truncate">{m.name || 'Non assigné'}</span>
                </div>
                <span className="text-[9px] font-black text-slate-300 font-mono shrink-0">
                  {formatFCFA((m.dailyIndemnity || 0) * (m.days || 1))}
                </span>
              </div>
            ))}
            {members.length > 4 && (
              <div className="flex items-center gap-1 pt-1">
                <AlertCircle size={8} className="text-slate-700" />
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                  +{members.length - 4} autres
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
