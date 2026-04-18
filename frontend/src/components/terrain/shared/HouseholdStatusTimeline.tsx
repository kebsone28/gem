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
    <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/5 shadow-inner">
      <h4 className="text-[9px] font-black uppercase tracking-[0.35em] mb-6 text-slate-500/70 italic">
        GLOBAL STATUS TRACKING
      </h4>

      <div className="flex items-center justify-between gap-4">
        <HouseholdStatusLabel currentStatus={currentStatus} updatedAt={updatedAt} />

        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(currentStatus || 'UNKNOWN')}
            title="Changer l'état global du ménage"
            className="px-5 py-3 bg-white/5 text-blue-400 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-inner hover:bg-white/10 hover:text-white transition-all duration-200 italic active:scale-95"
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  );
});
