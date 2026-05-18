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
    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
      {showTeamFilter && (
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-[0.2em]">Équipe</span>
          <select
            title="Sélectionner l'équipe"
            value={selectedTeam}
            onChange={(e) => onTeamChange(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase text-blue-400 cursor-pointer outline-none appearance-none truncate hover:text-blue-300 transition-colors"
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
        <div className="flex flex-col gap-1 min-w-0 flex-1 border-l border-white/5 pl-4">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-[0.2em]">Statut</span>
          <select
            title="Filtrer par statut"
            value={selectedStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase text-blue-400 cursor-pointer outline-none appearance-none truncate hover:text-blue-300 transition-colors"
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
        <div className="flex flex-col gap-1 shrink-0 border-l border-white/5 pl-4">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-[0.2em] text-center">Data Hub</span>
          <button
            onClick={onOpenDataHub}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all group"
            title="Ouvrir le Data Hub Kobo"
          >
            <Cloud size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(FiltersPanel);
