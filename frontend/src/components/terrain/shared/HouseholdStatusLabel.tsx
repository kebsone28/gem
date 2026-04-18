import React from 'react';
import { getStatusMeta } from '../../../domain/status/statusUtils';

export interface HouseholdStatusLabelProps {
  currentStatus?: string;
  updatedAt?: string;
}

export const HouseholdStatusLabel: React.FC<HouseholdStatusLabelProps> = React.memo(({
  currentStatus,
  updatedAt
}) => {
  const meta = getStatusMeta(currentStatus);

  return (
    <div className="flex flex-col">
      <p
        className={`text-xl font-black italic uppercase tracking-tight ${meta.color} animate-pulse-slow`}
      >
        {meta.label}
      </p>

      {updatedAt && (
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2">
          Dernière inspection :{' '}
          {new Date(updatedAt).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
});
