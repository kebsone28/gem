 
import React from 'react';
import { Users } from 'lucide-react';
import { normalizeTeamName, type TeamType } from '../../../utils/teamUtils';

export interface TeamAllocationsBadgeProps {
  teams?: TeamType[];
  emptyLabel?: string;
}

export const TeamAllocationsBadge: React.FC<TeamAllocationsBadgeProps> = React.memo(({
  teams = [],
  emptyLabel = 'NON ASSIGNÉ'
}) => {
  return (
    <div className="p-6 sm:p-7 rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] border border-white/10 shadow-xl flex items-center justify-between group hover:bg-white/[0.08] transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 bottom-0 w-32 bg-indigo-500/10 blur-2xl rounded-full" />
      
      <div className="flex items-center gap-5 relative z-10">
        <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-500/12 flex items-center justify-center shadow-inner border border-indigo-400/20 group-hover:scale-105 transition-transform duration-500">
          <Users size={22} className="text-indigo-300" />
        </div>
        
        <div className="min-w-0">
          <p className="text-[10px] font-black text-indigo-300/80 uppercase tracking-[0.24em] mb-2">
            ÉQUIPES ASSIGNÉES
          </p>

          <div className="text-sm font-black text-white tracking-wide leading-snug">
            {Array.isArray(teams) && teams.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {teams.map((t, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950/30 border border-white/10 text-[11px] tracking-wide shadow-sm text-slate-100"
                  >
                    {normalizeTeamName(t)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-300/85 text-sm tracking-wide">
                {emptyLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
