 
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

  const dateObj = updatedAt ? new Date(updatedAt) : null;
  const isValidDate = dateObj && !isNaN(dateObj.getTime());

  return (
    <div className="flex flex-col">
      <p
        className={`text-2xl font-black uppercase tracking-[-0.04em] ${meta.color}`}
      >
        {meta.label}
      </p>
      
      {/* Affichage de la date avec protection robuste */}
      {updatedAt && (
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] mt-3">
          Dernière inspection :{' '}
          {isValidDate 
            ? dateObj.toLocaleDateString('fr-FR') 
            : new Date().toLocaleDateString('fr-FR') 
          }
        </p>
      )}
    </div>
  );
});
