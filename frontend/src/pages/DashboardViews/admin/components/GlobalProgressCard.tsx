import React from 'react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { fmtNum } from '../../../../utils/format';
import type { DashboardMetrics } from '../types';

interface GlobalProgressCardProps {
  metrics: DashboardMetrics;
}

export const GlobalProgressCard: React.FC<GlobalProgressCardProps> = ({ metrics }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-14 rounded-3xl md:rounded-[3.5rem] bg-slate-900/40 border border-white/10 shadow-3xl relative overflow-hidden backdrop-blur-3xl group"
    >
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/[0.03] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] flex items-center gap-3 italic">
              <Compass size={18} className="text-blue-500" /> Progression des activités terrain
            </h3>
            <div className="flex flex-wrap items-baseline gap-3 md:gap-4">
              <span className="text-7xl md:text-9xl font-black text-white tracking-tighter italic leading-none drop-shadow-xl">
                {metrics.progressPercent}%
              </span>
              <span
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase italic shadow-lg mt-2 md:mt-0 ${
                  metrics.progressPercent > 50 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                MISE EN ŒUVRE EN COURS
              </span>
            </div>
            <p className="text-base text-slate-400 font-medium max-w-md leading-relaxed">
              Le programme de déploiement est lancé dans le respect du cadre technique,
              réglementaire et institutionnel. Indice de performance opérationnelle (IPO):{' '}
              <span className="font-black text-blue-400 italic">{metrics.igppScore}%</span>.
            </p>
          </div>

          <div className="space-y-4">
            <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metrics.progressPercent}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.5)]"
              />
            </div>
            <div className="flex justify-between text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-widest italic">
              <span>PHASE INITIALE</span>
              <span>NIVEAU DE RÉALISATION OPTIMAL</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
            <p className="text-[10px] font-black text-blue-400/30 uppercase tracking-[0.3em] mb-4 italic">
              CHANTIERS ACHEVÉS
            </p>
            <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
              {fmtNum(metrics.electrifiedHouseholds)}
            </p>
            <div className="mt-6 h-1 w-16 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner hover:bg-white/[0.05] transition-all">
            <p className="text-[10px] font-black text-blue-400/30 uppercase tracking-[0.3em] mb-4 italic">
              OBJECTIF TOTAL PROJET
            </p>
            <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
              {fmtNum(metrics.totalHouseholds)}
            </p>
            <div className="mt-6 h-1 w-16 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
