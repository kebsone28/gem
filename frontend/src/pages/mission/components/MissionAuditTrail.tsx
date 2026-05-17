 
import React from 'react';
import { History, User, Clock, Info, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AuditEntry } from '../core/missionTypes';

interface MissionAuditTrailProps {
  entries: AuditEntry[];
}

/** Maps common action strings to a colour/icon hint */
const getEntryStyle = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes('valid') || a.includes('certif') || a.includes('officiel'))
    return { dot: 'bg-emerald-500 shadow-emerald-500/40', text: 'text-emerald-400' };
  if (a.includes('soumet') || a.includes('submit'))
    return { dot: 'bg-amber-400 shadow-amber-400/40', text: 'text-amber-400' };
  if (a.includes('supprim') || a.includes('delet') || a.includes('reject'))
    return { dot: 'bg-rose-500 shadow-rose-500/40', text: 'text-rose-400' };
  if (a.includes('sync') || a.includes('enregistr'))
    return { dot: 'bg-blue-500 shadow-blue-500/40', text: 'text-blue-400' };
  return { dot: 'bg-indigo-500 shadow-indigo-500/30', text: 'text-slate-400' };
};

export const MissionAuditTrail: React.FC<MissionAuditTrailProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[#0d1117] border border-white/[0.07] p-6 text-center">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] mx-auto flex items-center justify-center mb-3">
          <History size={16} className="text-slate-700" />
        </div>
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Aucun historique</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-[#0d1117] border border-white/[0.07] p-5 space-y-4">
      {/* Glow */}
      <div className="absolute -top-8 -left-8 w-28 h-28 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06] relative z-10">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <History size={15} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Journal d'Audit</h2>
          <p className="text-[8px] font-semibold text-slate-600 mt-0.5 tracking-wide">Traçabilité & Historique SaaS</p>
        </div>
        <div className="ml-auto px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <span className="text-[8px] font-black text-slate-600">{entries.length} événement{entries.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="space-y-0 max-h-[260px] overflow-y-auto custom-scrollbar relative z-10">
        {entries.map((entry, idx) => {
          const style    = getEntryStyle(entry.action);
          const isLast   = idx === entries.length - 1;
          const timeStr  = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const dateStr  = new Date(entry.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
              className={`relative pl-7 ${!isLast ? 'pb-4' : 'pb-1'}`}
            >
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[6px] top-5 bottom-0 w-px bg-white/[0.05]" />
              )}

              {/* Dot */}
              <div className={`absolute left-[2px] top-1.5 w-2.5 h-2.5 rounded-full shadow-sm ${style.dot}`} />

              <div className="flex items-start gap-2 justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-300 leading-tight">{entry.action}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User size={8} className="text-slate-700" />
                      <span className={`text-[9px] font-bold ${style.text}`}>{entry.author}</span>
                    </div>
                    {entry.details && (
                      <div className="flex items-center gap-1">
                        <Info size={8} className="text-slate-700" />
                        <span className="text-[8px] text-slate-600 italic">{entry.details}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="shrink-0 text-right ml-2">
                  <p className="text-[9px] font-black text-slate-700">{timeStr}</p>
                  <p className="text-[8px] text-slate-800 font-bold">{dateStr}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Footer badge ── */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.05] relative z-10">
        <Shield size={9} className="text-slate-700" />
        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Journal immuable — SaaS Multi-Tenant</span>
      </div>
    </section>
  );
};
