import React from 'react';
import { MapPin, Search, RefreshCw, Maximize, ChevronRight, X } from 'lucide-react';

import { ActionBar } from '../../components/dashboards/DashboardComponents';
import { MapToolbar } from '../../components/terrain/MapToolbar';
import { useTerrainUIStore } from '../../store/terrainUIStore';

import type { SearchResult } from '../../hooks/useMapFilters';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSelectResult: (result: SearchResult) => void;

  selectedTeam: string;
  onTeamChange: (team: string) => void;
  allAvailableTeams: string[];

  project: any;

  onSync: () => void;
  onOpenDataHub: () => void;

  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;

  onRecenter: () => void;

  peutVoirDataHub: boolean;
  isSyncing: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onSelectResult,

  selectedTeam,
  onTeamChange,
  allAvailableTeams,

  project,

  onSync,
  onOpenDataHub,

  viewMode,
  onViewModeChange,

  onRecenter,

  peutVoirDataHub,
  isSyncing,
}) => {
  const showToolbar = useTerrainUIStore((s) => s.showToolbar);
  const toggleToolbar = useTerrainUIStore((s) => s.toggleToolbar);
  return (
    <>
      {showToolbar && (
        <div
          className="
                    fixed md:absolute
                    top-0 md:top-4
                    left-0 md:left-4
                    right-0 md:right-4
                    z-50

                    bg-[#050F1F]/95 md:bg-transparent
                    backdrop-blur-xl md:backdrop-blur-0

                    px-3 pt-3 pb-2 md:p-0

                    grid grid-cols-1 md:grid-cols-[auto_1fr_auto]
                    gap-2 md:gap-3
                    pointer-events-none
                "
        >
          {/* ================= LEFT ================= */}
          <div className="flex flex-col gap-2 md:gap-3 pointer-events-auto w-full md:w-[260px] shrink-0">
            {/* Branding + Search */}
            <div className="relative flex flex-col p-2 md:p-2.5 rounded-2xl bg-[#050F1F] border border-white/10 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-2 md:mb-3 px-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 text-blue-400">
                    <MapPin size={14} className="md:w-4 md:h-4" />
                  </div>

                  <div>
                    <h3 className="text-[10px] md:text-[11px] font-black uppercase text-white">
                      Explorer Terrain
                    </h3>
                    <p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase mt-0.5 tracking-widest animate-pulse">
                      {project?.name || 'Sans Projet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10">
                <div className="flex-1 flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5">
                  {isSearching ? (
                    <div className="animate-spin h-3 w-3 md:h-3.5 md:w-3.5 border-2 border-blue-400 border-t-transparent rounded-full" />
                  ) : (
                    <Search size={12} className="md:w-3.5 md:h-3.5 text-blue-400/70" />
                  )}

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full bg-transparent outline-none text-[10px] md:text-[11px] text-white placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Results */}
              {searchResults.length > 0 && searchQuery && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full rounded-xl border border-white/10 bg-[#050F1F] shadow-2xl z-[999]">
                  <div className="max-h-40 md:max-h-48 overflow-y-auto">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectResult(res)}
                        className="w-full text-left px-2 md:px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[7px] font-black italic ${
                              res.type === 'household'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {res.type === 'household' ? 'MÉNAGE' : 'LIEU'}
                          </span>

                          <span className="truncate">{res.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Team selector */}
            <div className="flex items-center justify-between md:justify-start gap-2 p-1 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl w-full md:w-fit">
              <div className="pl-2 md:pl-3 pr-2 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase border-r border-white/10">
                Équipe
              </div>

              <select
                title="Sélectionner l'équipe"
                value={selectedTeam}
                onChange={(e) => onTeamChange(e.target.value)}
                className="bg-transparent text-[10px] md:text-[11px] font-black uppercase text-blue-400 cursor-pointer pr-2 md:pr-3 py-1 outline-none"
              >
                <option value="all">Toutes</option>
                {allAvailableTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ================= CENTER ================= */}
          <div className="hidden md:flex justify-center items-center min-w-0 pointer-events-none">
            <div className="pointer-events-auto max-w-full overflow-x-auto flex items-center gap-2">
              {showToolbar && <MapToolbar onRecenter={onRecenter} />}
              <button
                onClick={toggleToolbar}
                title={showToolbar ? "Masquer la barre d'outils" : "Afficher la barre d'outils"}
                className="p-2 rounded-xl bg-[#0D1E35] border border-white/10 shadow-2xl hover:bg-white/5 transition-colors"
              >
                <ChevronRight
                  size={16}
                  className={`text-white transition-transform ${showToolbar ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* ================= RIGHT ================= */}
          <div className="flex flex-wrap justify-between md:justify-end items-center gap-2 pointer-events-auto shrink-0 w-full">
            <div className="p-1 flex flex-wrap items-center gap-1 rounded-xl bg-[#0D1E35]/80 border border-white/10 shadow-2xl">
              <ActionBar>
                <button
                  title="Synchroniser"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="p-1 bg-white/5 rounded-lg border border-white/5 text-blue-400"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                </button>

                {peutVoirDataHub && (
                  <button
                    onClick={onOpenDataHub}
                    className="px-2 md:px-3 py-1 text-[9px] md:text-[8px] font-black uppercase text-white bg-blue-600 rounded-lg"
                  >
                    Données
                  </button>
                )}

                <div className="flex p-0.5 rounded-md bg-white/5 border border-white/5">
                  <button
                    onClick={() => onViewModeChange('map')}
                    className={`px-2 py-1 text-[9px] md:text-[8px] ${
                      viewMode === 'map' ? 'bg-blue-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Carte
                  </button>

                  <button
                    onClick={() => onViewModeChange('list')}
                    className={`px-2 py-1 text-[9px] md:text-[8px] ${
                      viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Liste
                  </button>
                </div>
              </ActionBar>
            </div>

            <button
              title="Plein écran"
              onClick={() => window.location.reload()}
              className="p-2 rounded-xl bg-[#0D1E35]/80 border border-white/10 text-white"
            >
              <Maximize size={14} />
            </button>

            <button
              title="Masquer l'en-tête"
              onClick={toggleToolbar}
              className="p-2 rounded-xl bg-[#0D1E35]/80 border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {!showToolbar && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={toggleToolbar}
            title="Afficher l'en-tête"
            className="p-3 rounded-full bg-[#0D1E35]/95 border border-white/10 shadow-2xl text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
};

export default React.memo(TopBar);
