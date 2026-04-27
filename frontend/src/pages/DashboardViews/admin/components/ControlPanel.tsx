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
    <section className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
      <div className="flex min-h-[320px] flex-col overflow-hidden rounded-[1.45rem] border border-white/5 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-3xl sm:min-h-[380px] sm:rounded-[1.8rem] sm:p-5 lg:row-span-2 lg:min-h-[460px] lg:rounded-[2.2rem] lg:p-6">
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

      <div className="rounded-[1.45rem] border border-white/5 bg-slate-900/40 p-4 shadow-xl backdrop-blur-3xl sm:rounded-[1.8rem] sm:p-5 lg:rounded-[2.1rem] lg:p-6">
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
                className="mb-3 flex gap-3 rounded-[1.15rem] border border-rose-500/20 bg-rose-500/10 p-4 sm:mb-4 sm:gap-4 sm:rounded-[1.35rem] sm:p-4.5"
              >
                <AlertCircle size={22} className="text-rose-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-rose-400 sm:text-xs">INCIDENTS CRITIQUES</p>
                  <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-slate-300">
                    {metrics.problemHouseholds} UNITÉS NÉCESSITENT UNE ACTION IMMÉDIATE.
                  </p>
                </div>
              </motion.div>
            )}
            {metrics.syncHealth !== 'healthy' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-3 rounded-[1.15rem] border border-amber-500/20 bg-amber-500/10 p-4 sm:gap-4 sm:rounded-[1.35rem] sm:p-4.5"
              >
                <RefreshCw size={22} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-amber-400 sm:text-xs">ALERTE SYNCHRO</p>
                  <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-slate-300">LATENCE DÉTECTÉE DANS LA LIAISON CLOUD.</p>
                </div>
              </motion.div>
            )}
            {metrics.problemHouseholds === 0 && metrics.syncHealth === 'healthy' && (
              <div className="rounded-[1.3rem] border border-dashed border-white/10 bg-white/[0.02] py-8 text-center sm:rounded-[1.7rem] sm:py-10">
                <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:tracking-[0.22em]">SYSTÈMES OPÉRATIONNELS</p>
              </div>
            )}
          </AnimatePresence>
          )}
        </AlertPanel>
      </div>

      <div className="group relative overflow-hidden rounded-[1.45rem] border border-indigo-500/20 bg-indigo-600/10 p-4 shadow-xl backdrop-blur-3xl sm:rounded-[1.8rem] sm:p-5 lg:rounded-[2.1rem] lg:p-6">
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-1000" />
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-indigo-300 sm:mb-6 sm:gap-3 sm:tracking-[0.2em]">
          <Calendar size={18} /> PLANIFICATEUR DE MISSIONS
        </h3>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:mb-5 sm:grid-cols-2">
          {priorityActions.map((action) => (
            <div
              key={action}
              className="rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-slate-200 sm:text-[12px]"
            >
              {action}
            </div>
          ))}
        </div>
        <div className="relative z-10 space-y-3 sm:space-y-4">
          {!isLoading && missions.length > 0 ? (
            missions.slice(0, 4).map((m, i) => (
              <div key={i} className="cursor-pointer rounded-[1.1rem] border border-white/5 bg-white/[0.03] p-3.5 transition-all hover:bg-white/[0.06] sm:rounded-[1.35rem] sm:p-4">
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-[12px] font-black uppercase tracking-[0.02em] text-white sm:text-sm">{m.purpose}</p>
                  <StatusBadge status={m.isCertified ? 'success' : 'info'} label={m.isCertified ? 'CERT' : 'LIVE'} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-200 opacity-75">
                  {m.startDate} › {m.endDate}
                </p>
              </div>
            ))
          ) : isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-20 rounded-[1.1rem] bg-white/10" />
              <div className="h-20 rounded-[1.1rem] bg-white/10" />
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 py-8 text-center opacity-20 sm:rounded-2xl sm:py-10">
              <Calendar size={32} className="mb-4 text-white" />
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white sm:tracking-[0.2em]">AUCUNE MISSION À VENIR</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
