/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RefreshCw, CheckCircle2, Calendar } from 'lucide-react';
import { AlertPanel, ActivityFeed, StatusBadge } from '../../../../components/dashboards/DashboardComponents';
import type { DashboardMetrics, Activity } from '../types';

interface ControlPanelProps {
  metrics: DashboardMetrics;
  feedActivities: Activity[];
  missions: any[];
  isLoading?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  metrics,
  feedActivities,
  missions,
  isLoading = false,
}) => {
  const priorityActions = [
    metrics.problemHouseholds > 0
      ? `${metrics.problemHouseholds} menages a verifier`
      : 'Aucune alerte menage critique',
    metrics.syncHealth !== 'healthy'
      ? 'Relancer la synchronisation cloud'
      : 'Synchronisation cloud stable',
    metrics.actionRequired > 0
      ? `${metrics.actionRequired} actions terrain en attente`
      : 'Aucune action terrain bloquante',
  ];

  return (
    <div className="lg:col-span-4 space-y-4 sm:space-y-6 lg:space-y-10">
      <div className="p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl">
        <AlertPanel>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-20 rounded-[1.3rem] bg-white/10" />
              <div className="h-20 rounded-[1.3rem] bg-white/10" />
            </div>
          ) : (
          <AnimatePresence>
            {metrics.problemHouseholds > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-3 sm:gap-4 p-4 sm:p-6 bg-rose-500/10 rounded-[1.3rem] sm:rounded-3xl border border-rose-500/20 mb-3 sm:mb-4"
              >
                <AlertCircle size={22} className="text-rose-500 shrink-0" />
                <div>
                  <p className="text-[11px] sm:text-xs font-black text-rose-400 uppercase tracking-[0.06em] italic">INCIDENTS CRITIQUES</p>
                  <p className="text-[11px] sm:text-[11px] text-slate-300 mt-2 leading-relaxed font-bold">
                    {metrics.problemHouseholds} UNITÉS NÉCESSITENT UNE ACTION IMMÉDIATE.
                  </p>
                </div>
              </motion.div>
            )}
            {metrics.syncHealth !== 'healthy' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-3 sm:gap-4 p-4 sm:p-6 bg-amber-500/10 rounded-[1.3rem] sm:rounded-3xl border border-amber-500/20"
              >
                <RefreshCw size={22} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-[11px] sm:text-xs font-black text-amber-400 uppercase tracking-[0.06em] italic">ALERTE SYNCHRO</p>
                  <p className="text-[11px] sm:text-[11px] text-slate-300 mt-2 leading-relaxed font-bold">LATENCE DÉTECTÉE DANS LA LIAISON CLOUD.</p>
                </div>
              </motion.div>
            )}
            {metrics.problemHouseholds === 0 && metrics.syncHealth === 'healthy' && (
              <div className="py-10 sm:py-14 text-center bg-white/[0.02] rounded-[1.5rem] sm:rounded-[2.5rem] border border-dashed border-white/10">
                <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4 opacity-20" />
                <p className="text-[10px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.08em] sm:tracking-[0.22em] italic">SYSTÈMES OPÉRATIONNELS</p>
              </div>
            )}
          </AnimatePresence>
          )}
        </AlertPanel>
      </div>

      <div className="p-4 sm:p-6 lg:p-10 rounded-[1.8rem] sm:rounded-[2.5rem] lg:rounded-[3.5rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl h-[320px] sm:h-[420px] lg:h-[500px] flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 space-y-4 animate-pulse">
            <div className="h-4 w-40 rounded-full bg-white/10" />
            <div className="h-20 rounded-[1.3rem] bg-white/10" />
            <div className="h-20 rounded-[1.3rem] bg-white/10" />
            <div className="h-20 rounded-[1.3rem] bg-white/10" />
          </div>
        ) : (
          <ActivityFeed activities={feedActivities} />
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] lg:rounded-[3rem] bg-indigo-600/10 border border-indigo-500/20 backdrop-blur-3xl shadow-xl relative overflow-hidden group">
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-1000" />
        <h3 className="text-[11px] sm:text-[11px] font-black text-indigo-300 uppercase tracking-[0.08em] sm:tracking-[0.26em] mb-5 sm:mb-8 italic flex items-center gap-2 sm:gap-3">
          <Calendar size={18} /> PLANIFICATEUR DE MISSIONS
        </h3>
        <div className="mb-4 sm:mb-6 grid grid-cols-1 gap-2">
          {priorityActions.map((action) => (
            <div
              key={action}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-slate-200"
            >
              {action}
            </div>
          ))}
        </div>
        <div className="space-y-3 sm:space-y-5 relative z-10">
          {!isLoading && missions.length > 0 ? (
            missions.slice(0, 3).map((m, i) => (
              <div key={i} className="p-4 sm:p-6 rounded-[1.3rem] sm:rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all cursor-pointer group">
                <div className="flex justify-between items-start gap-3 mb-3">
                  <p className="text-[13px] sm:text-sm font-black tracking-tight text-white italic uppercase line-clamp-2">{m.purpose}</p>
                  <StatusBadge status={m.isCertified ? 'success' : 'info'} label={m.isCertified ? 'CERT' : 'LIVE'} />
                </div>
                <p className="text-[10px] sm:text-[10px] text-indigo-200 font-black uppercase tracking-[0.06em] sm:tracking-widest opacity-75">
                  {m.startDate} › {m.endDate}
                </p>
              </div>
            ))
          ) : isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-24 rounded-[1.3rem] bg-white/10" />
              <div className="h-24 rounded-[1.3rem] bg-white/10" />
            </div>
          ) : (
            <div className="py-10 sm:py-14 text-center opacity-20 flex flex-col items-center border border-dashed border-white/10 rounded-xl sm:rounded-2xl">
              <Calendar size={32} className="mb-4 text-white" />
              <p className="text-[10px] sm:text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.2em] text-white">AUCUNE MISSION À VENIR</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
