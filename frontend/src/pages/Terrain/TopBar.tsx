/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ChevronRight, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';

import { MapToolbar } from '../../components/terrain/MapToolbar';
import { useTerrainUIStore } from '../../store/terrainUIStore';

import type { SearchResult } from '../../hooks/useMapFilters';
import type { Project } from '../../utils/types';

// Sub-components
import ProjectHeader from './components/ProjectHeader';
import SearchInput from './components/SearchInput';
import FiltersPanel from './components/FiltersPanel';
import MobileActions from './components/MobileActions';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSelectResult: (result: SearchResult) => void;

  selectedTeam: string;
  onTeamChange: (team: string) => void;
  allAvailableTeams: string[];
  selectedStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  statusOptions: string[];

  project: Project | null;

  onSync: () => void;
  onOpenDataHub: () => void;

  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;

  onRecenter: () => void;

  peutVoirDataHub: boolean;
  isSyncing: boolean;
  showSearch?: boolean;
  showSync?: boolean;
  showDataHub?: boolean;
  showTeamFilter?: boolean;
  showStatusFilter?: boolean;
  showListToggle?: boolean;
  showRecenter?: boolean;
  showAdvancedTools?: boolean;
  mapToolbarFeatures?: React.ComponentProps<typeof MapToolbar>['features'];
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
  selectedStatusFilter,
  onStatusFilterChange,
  statusOptions,

  project,

  onSync,
  onOpenDataHub,

  viewMode,
  onViewModeChange,

  onRecenter,

  peutVoirDataHub,
  isSyncing,
  showSearch = true,
  showSync = true,
  showDataHub = false,
  showTeamFilter = true,
  showStatusFilter = true,
  showListToggle = true,
  showAdvancedTools = false,
  mapToolbarFeatures,
}) => {
  const showToolbar = useTerrainUIStore((s) => s.showToolbar);
  const toggleToolbar = useTerrainUIStore((s) => s.toggleToolbar);
  const [isMinimized, setIsMinimized] = React.useState(false);

  return (
    <>
      {showToolbar && (
        <div
          className={`
                    fixed md:absolute
                    top-3 md:top-4
                    left-3 md:left-4
                    right-3 md:right-4
                    z-[1300]

                    bg-slate-950/80 dark:bg-[#050F1F]/90 text-white/90
                    backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                    border border-white/10 dark:border-white/5
                    rounded-2xl md:rounded-none
                    transition-all duration-300 ease-in-out

                    ${isMinimized ? 'h-[64px] overflow-hidden' : 'max-h-[85vh] overflow-visible'}

                    px-2.5 pt-1.5 pb-2 md:p-0
                    grid grid-cols-1 md:grid-cols-[auto_1fr_auto]
                    gap-2 md:gap-3
                    pointer-events-none
                `}
        >
          {/* ================= LEFT COLUMN ================= */}
          <div className="flex flex-col gap-2 md:gap-3 pointer-events-auto w-full md:w-[280px] shrink-0">
            <div className="relative flex flex-col p-2 rounded-2xl bg-[#050F1F]/96 border border-white/10 shadow-2xl">
              {/* Branding + Project Info */}
              <ProjectHeader
                project={project}
                onSync={onSync}
                isSyncing={isSyncing}
                showSync={showSync}
                toggleToolbar={toggleToolbar}
              />

              {/* Search Section */}
              {showSearch && (
                <SearchInput
                  searchQuery={searchQuery}
                  onSearchChange={onSearchChange}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  onSelectResult={onSelectResult}
                />
              )}

              {/* Filters Section hidden on mobile for focus and speed */}
              <div className="hidden md:block">
                <FiltersPanel
                  selectedTeam={selectedTeam}
                  onTeamChange={onTeamChange}
                  allAvailableTeams={allAvailableTeams}
                  selectedStatusFilter={selectedStatusFilter}
                  onStatusFilterChange={onStatusFilterChange}
                  statusOptions={statusOptions}
                  showTeamFilter={showTeamFilter}
                  showStatusFilter={showStatusFilter}
                  onOpenDataHub={onOpenDataHub}
                  showDataHub={showDataHub}
                  peutVoirDataHub={peutVoirDataHub}
                />
              </div>
            </div>

            {/* Mobile-only View Actions & Tools */}
            {!isMinimized && (
              <MobileActions
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                showListToggle={showListToggle}
                showAdvancedTools={showAdvancedTools}
                onRecenter={onRecenter}
                mapToolbarFeatures={mapToolbarFeatures}
              />
            )}

            {/* Toggle Control - mobile only */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex md:hidden pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                title={isMinimized ? "Afficher plus d'outils" : "Masquer les outils"}
                aria-label={isMinimized ? "Afficher plus d'outils" : "Masquer les outils"}
                className="w-10 h-10 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center border-4 border-white dark:border-slate-900 transition-all hover:scale-110 active:scale-90"
              >
                {isMinimized ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
              </button>
            </div>
          </div>

          {/* ================= CENTER COLUMN (Desktop) ================= */}
          <div className="hidden md:flex justify-center items-center min-w-0 pointer-events-none overflow-visible">
            <div className="pointer-events-auto max-w-full overflow-x-auto overflow-y-visible py-3 -my-3 flex items-center gap-2 relative z-[1200]">
              {showAdvancedTools && showToolbar && (
                <MapToolbar onRecenter={onRecenter} features={mapToolbarFeatures} />
              )}
              {showAdvancedTools && (
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
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN (Desktop) ================= */}
          <div className="hidden md:flex flex-wrap justify-end items-center gap-2 pointer-events-auto shrink-0 w-full">
            <div className="flex items-center gap-1.5 p-1 rounded-[20px] bg-[#050F1F]/75 backdrop-blur-xl border border-white/10 shadow-2xl">
              {showSync && (
                <button
                  title="Synchroniser"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl border border-white/5 text-blue-400 hover:bg-white/10 transition-colors"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              )}


              {showListToggle && (
                <div className="flex p-0.5 rounded-xl bg-slate-900/50 border border-white/5">
                  <button
                    onClick={() => onViewModeChange('map')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      viewMode === 'map' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Carte
                  </button>

                  <button
                    onClick={() => onViewModeChange('list')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Liste
                  </button>
                </div>
              )}
            </div>

            {showAdvancedTools && (
              <button
                title="Masquer l'en-tête"
                onClick={toggleToolbar}
                className="p-2 rounded-xl bg-[#0D1E35]/80 border border-white/10 text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* RECENTERING BUTTON WHEN TOOLBAR HIDDEN */}
      {!showToolbar && showAdvancedTools && (
        <div className="fixed md:absolute left-1/2 -translate-x-1/2 top-6 z-[1400]">
          <button
            onClick={toggleToolbar}
            title="Afficher l'en-tête"
            className="flex items-center gap-3 rounded-full border border-white/30 bg-[#050F1F]/60 backdrop-blur-xl px-7 py-4 shadow-[0_15px_40px_rgba(0,0,0,0.5)] text-white hover:bg-[#0D1E35]/80 transition-all hover:scale-105 active:scale-95 group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            <ChevronRight size={22} className="-rotate-180 group-hover:-translate-x-1 transition-transform text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            <span className="text-[12px] font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              Retour outils
            </span>
          </button>
        </div>
      )}
    </>
  );
};

export default React.memo(TopBar);
