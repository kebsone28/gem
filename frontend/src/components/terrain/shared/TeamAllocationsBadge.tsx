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
    <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-xl flex items-center justify-between group hover:bg-white/[0.08] transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 bottom-0 w-32 bg-indigo-500/5 blur-2xl rounded-full" />
      
      <div className="flex items-center gap-5 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center shadow-inner border border-indigo-500/20 group-hover:scale-105 transition-transform duration-500">
          <Users size={22} className="text-indigo-400" />
        </div>
        
        <div>
          <p className="text-[9px] font-black text-indigo-400/70 uppercase tracking-[0.25em] mb-1 italic">
            ÉQUIPES ASSIGNÉES
          </p>

          <div className="text-sm font-black text-white tracking-wide leading-snug">
            {Array.isArray(teams) && teams.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {teams.map((t, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs tracking-wide shadow-sm"
                  >
                    {normalizeTeamName(t)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 opacity-60 text-xs tracking-wide">
                {emptyLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
