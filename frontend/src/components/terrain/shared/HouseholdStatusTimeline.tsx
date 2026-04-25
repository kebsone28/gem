 
import React from 'react';
import { HouseholdStatusLabel } from './HouseholdStatusLabel';

export interface StatusStage {
  label: string;
  value: string;
}

export interface HouseholdStatusTimelineProps {
  currentStatus?: string;
  updatedAt?: string;
  isAdmin?: boolean;
  onEdit?: (status: string) => void;
  // TODO: `stages` will be mapped here for the actual visual timeline later
  stages?: StatusStage[];
}

export const HouseholdStatusTimeline: React.FC<HouseholdStatusTimelineProps> = React.memo(({
  currentStatus,
  updatedAt,
  isAdmin = false,
  onEdit
}) => {
  return (
    <div className="p-6 sm:p-8 rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] border border-white/10 shadow-inner">
      <h4 className="text-[10px] font-black uppercase tracking-[0.28em] mb-6 text-slate-300/70">
        GLOBAL STATUS TRACKING
      </h4>

      <div className="flex items-center justify-between gap-4">
        <HouseholdStatusLabel currentStatus={currentStatus} updatedAt={updatedAt} />

        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(currentStatus || 'UNKNOWN')}
            title="Changer l'état global du ménage"
            className="px-5 py-3 bg-slate-950/25 text-slate-100 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] shadow-inner hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-95"
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  );
});
