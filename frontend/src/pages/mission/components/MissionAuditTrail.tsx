import React from 'react';
import { History, User, Clock, Info } from 'lucide-react';
import type { AuditEntry } from '../core/missionTypes';

interface MissionAuditTrailProps {
  entries: AuditEntry[];
}

/**
 * COMPOSANT : Audit Trail (Journal d'activité)
 * Affiche l'historique complet des modifications de la mission.
 */
export const MissionAuditTrail: React.FC<MissionAuditTrailProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <section className="glass-card !p-8 !rounded-[2.5rem] text-center text-slate-400 italic">
        Aucun historique d'activité pour le moment.
      </section>
    );
  }

  return (
    <section className="glass-card !p-5 !rounded-[2rem] space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <History className="text-indigo-500" size={16} />
        </div>
        <div>
          <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-[10px]">
            Journal d'Audit
          </h2>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">
            Traçabilité & Historique SaaS
          </p>
        </div>
      </div>

      <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="relative pl-5 pb-3 border-l-2 border-slate-100 dark:border-white/5 last:pb-0"
          >
            {/* Timeline dot */}
            <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/20" />

            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                  {entry.action}
                </span>
                <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-1.5 py-0.5 rounded-full">
                  <Clock size={8} />
                  {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold">
                  <User size={9} />
                  {entry.author}
                </div>
                {entry.details && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 italic">
                    <Info size={9} />
                    {entry.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
