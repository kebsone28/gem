 
import React from 'react';
import { Target, TrendingUp, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';

interface TeamStat {
  worker: string;
  leader: string;
  trade?: string;
  done: number;
  days: number;
  yield: number;
}

interface TeamPerformanceProps {
  teamStats: TeamStat[];
  productionRates?: Record<string, number>;
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({
  teamStats,
  productionRates = {},
}) => {
  if (!teamStats || teamStats.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[20px] border border-gray-100 shadow-sm dark:shadow-none text-center">
        <Users size={32} className="mx-auto mb-3 text-gray-200" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Aucune donnée de performance
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-[20px] border border-gray-100 shadow-sm dark:shadow-none space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <h3 className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-[0.08em] sm:tracking-widest flex items-center gap-2">
          <TrendingUp size={14} className="text-blue-600" /> Rendement & Productivité par Équipe
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {teamStats.map((team, idx) => {
          const target = team.trade ? productionRates[team.trade] || 0 : 0;
          const efficiency =
            target > 0 ? Math.min(100, Math.round((team.yield / target) * 100)) : 0;

          return (
            <div key={idx} className="group relative">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight italic break-words">
                      {team.worker}
                    </span>
                    {team.trade && (
                      <span className="text-[11px] sm:text-xs font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                        {team.trade}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-gray-500 font-bold uppercase tracking-[0.06em] sm:tracking-wider">
                    <span className="flex items-center gap-1">
                      <Users size={10} className="text-gray-400" /> {team.leader}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={10} className="text-amber-400" /> {team.yield} / jour
                    </span>
                    {target > 0 && (
                      <span className="flex items-center gap-1">
                        <Target size={10} /> Objectif: {target}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span
                    className={`text-lg font-black tracking-tighter ${efficiency >= 100 ? 'text-emerald-500' : efficiency >= 70 ? 'text-blue-500' : 'text-rose-500'}`}
                  >
                    {efficiency}%
                  </span>
                  <p className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase">Efficacité</p>
                </div>
              </div>

              <div className="h-3 w-full bg-gray-50 rounded-full overflow-hidden p-0.5 border border-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${efficiency}%` }}
                  className={`h-full rounded-full ${
                    efficiency >= 100
                      ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : efficiency >= 70
                        ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                        : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 text-center">
          <p className="text-2xl font-black text-gray-900">
            {fmtNum(teamStats.reduce((acc, t) => acc + t.done, 0))}
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-[0.08em] sm:tracking-widest">Total Réalisé</p>
        </div>
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 text-center">
          <p className="text-2xl font-black text-gray-900">
            {Math.round((teamStats.reduce((acc, t) => acc + t.yield, 0) / teamStats.length) * 10) /
              10}
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-[0.08em] sm:tracking-widest">
            Moyenne Rendement
          </p>
        </div>
      </div>
    </div>
  );
};
