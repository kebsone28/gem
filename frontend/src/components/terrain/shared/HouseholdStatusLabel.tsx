 
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
        className={`text-2xl font-black uppercase tracking-[-0.04em] ${meta.color}`}
      >
        {meta.label}
      </p>

      {updatedAt && (
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] mt-3">
          Dernière inspection :{' '}
          {new Date(updatedAt).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
});
