import React from 'react';

import { Cloud } from 'lucide-react';

interface FiltersPanelProps {
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  allAvailableTeams: string[];
  selectedStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  statusOptions: string[];
  showTeamFilter: boolean;
  showStatusFilter: boolean;
  onOpenDataHub?: () => void;
  showDataHub?: boolean;
  peutVoirDataHub?: boolean;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  selectedTeam,
  onTeamChange,
  allAvailableTeams,
  selectedStatusFilter,
  onStatusFilterChange,
  statusOptions,
  showTeamFilter,
  showStatusFilter,
  onOpenDataHub,
  showDataHub,
  peutVoirDataHub,
}) => {
  const hasFilters = showTeamFilter || showStatusFilter;
  const hasDataHub = showDataHub && peutVoirDataHub;

  if (!hasFilters && !hasDataHub) return null;

  return (
    <div className="flex flex-col gap-2 mt-2.5 pt-2.5 border-t border-white/5">
      {showTeamFilter && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="shrink-0 text-[8px] font-black uppercase text-slate-500 tracking-[0.16em]">Équipe</span>
          <select
            title="Sélectionner l'équipe"
            value={selectedTeam}
            onChange={(e) => onTeamChange(e.target.value)}
            className="min-w-0 max-w-[62vw] bg-transparent text-[10px] font-black uppercase text-blue-400 cursor-pointer outline-none text-right appearance-none truncate hover:text-blue-300 transition-colors md:max-w-[150px]"
          >
            <option value="all" className="bg-[#050F1F]">Toutes</option>
            {allAvailableTeams.map((team) => (
              <option key={team} value={team} className="bg-[#050F1F]">
                {team}
              </option>
            ))}
          </select>
        </div>
      )}

      {showStatusFilter && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="shrink-0 text-[8px] font-black uppercase text-slate-500 tracking-[0.16em]">Statut</span>
          <select
            title="Filtrer par statut"
            value={selectedStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="min-w-0 max-w-[62vw] bg-transparent text-[10px] font-black uppercase text-blue-400 cursor-pointer outline-none text-right appearance-none truncate hover:text-blue-300 transition-colors md:max-w-[140px]"
          >
            <option value="all" className="bg-[#050F1F]">Tous</option>
            {statusOptions.map((status) => (
              <option key={status} value={status} className="bg-[#050F1F]">
                {status}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasDataHub && (
        <div className="mt-0.5 pt-2.5 border-t border-white/5">
          <button
            onClick={onOpenDataHub}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Cloud size={12} className="text-blue-400" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.14em]">Data Hub Kobo</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(FiltersPanel);
