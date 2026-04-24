 
import React from 'react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { fmtNum } from '../../../../utils/format';
import { DASHBOARD_SECTION_SURFACE } from '../../../../components/dashboards/DashboardComponents';
import type { DashboardMetrics } from '../types';

interface GlobalProgressCardProps {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}

export const GlobalProgressCard: React.FC<GlobalProgressCardProps> = ({
  metrics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={`${DASHBOARD_SECTION_SURFACE} relative overflow-hidden p-4 sm:p-6 md:rounded-[3.5rem] md:p-14`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 items-center animate-pulse">
          <div className="space-y-4">
            <div className="h-4 w-48 rounded-full bg-white/10" />
            <div className="h-20 w-40 rounded-3xl bg-white/10" />
            <div className="h-4 w-full rounded-full bg-white/10" />
            <div className="h-4 w-4/5 rounded-full bg-white/10" />
            <div className="h-4 w-full rounded-full bg-white/10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <div className="h-32 rounded-[1.5rem] bg-white/10" />
            <div className="h-32 rounded-[1.5rem] bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${DASHBOARD_SECTION_SURFACE} group relative overflow-hidden p-4 sm:p-6 md:rounded-[3.5rem] md:p-14`}
    >
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/[0.03] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 items-center">
        <div className="space-y-5 sm:space-y-8">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[11px] sm:text-[11px] font-black text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.26em] flex items-center gap-2 sm:gap-3">
              <Compass size={18} className="text-blue-500" /> Progression terrain
            </h3>
            <div className="flex flex-wrap items-end gap-3 md:gap-4">
              <span className="text-[4rem] sm:text-6xl md:text-9xl font-black text-white tracking-tighter leading-none drop-shadow-xl">
                {metrics.progressPercent}%
              </span>
              <span
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-[10px] sm:text-[10px] font-black tracking-[0.06em] sm:tracking-widest uppercase italic shadow-lg mt-1 md:mt-0 ${
                  metrics.progressPercent > 50
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {metrics.progressPercent >= 80
                  ? 'Rythme cible'
                  : metrics.progressPercent >= 40
                    ? 'En progression'
                    : 'Demarrage'}
              </span>
            </div>
            <p className="text-[15px] sm:text-base text-slate-300 font-medium max-w-xl leading-relaxed">
              {metrics.electrifiedHouseholds} menages raccordes sur {metrics.totalHouseholds} cibles.
              Indice de performance operationnelle: <span className="font-black text-blue-400">{metrics.igppScore}%</span>.
            </p>
          </div>

          <div className="space-y-4">
            <div className="h-3 sm:h-4 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metrics.progressPercent}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.5)]"
              />
            </div>
            <div className="flex justify-between gap-3 text-[9px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.06em] sm:tracking-widest italic">
              <span>0%</span>
              <span>objectif 100%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
            <p className="text-[11px] sm:text-[10px] font-black text-blue-300/70 uppercase tracking-[0.08em] sm:tracking-[0.22em] mb-2 sm:mb-4">
              Menages raccordes
            </p>
            <p className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none">
              {fmtNum(metrics.electrifiedHouseholds)}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">Menages valides et terminés sur le terrain</p>
            <div className="mt-4 sm:mt-6 h-1 w-12 sm:w-16 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
            <p className="text-[11px] sm:text-[10px] font-black text-blue-300/70 uppercase tracking-[0.08em] sm:tracking-[0.22em] mb-2 sm:mb-4">
              Actions a suivre
            </p>
            <p className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none">
              {fmtNum(metrics.problemHouseholds + metrics.actionRequired)}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">Anomalies, incidents et menages en attente d'action</p>
            <div className="mt-4 sm:mt-6 h-1 w-12 sm:w-16 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
