import React, { memo, useMemo, useCallback } from 'react';
import { Filter, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface PlanningFiltersProps {
  phaseFilter: string;
  selectedRegion: string;
  selectedTrade: string;
  selectedTeam: string;
  availableRegions: string[];
  availableTeams: Array<{ id: string; name: string; tradeKey?: string }>;
  onPhaseFilterChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTradeChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onReset: () => void;
  isLoading?: boolean;
}

const PHASE_OPTIONS = [
  { value: 'ALL', label: 'Toutes phases', color: 'bg-gray-500' },
  { value: 'LIVRAISON', label: 'Livraison', color: 'bg-cyan-500' },
  { value: 'MACONNERIE', label: 'Maçonnerie', color: 'bg-amber-500' },
  { value: 'RESEAU', label: 'Réseau', color: 'bg-blue-500' },
  { value: 'INTERIEUR', label: 'Installation', color: 'bg-purple-500' },
  { value: 'CONTROLE', label: 'Contrôle', color: 'bg-emerald-500' },
  { value: 'TERMINE', label: 'Terminé', color: 'bg-emerald-600' },
];

const TRADE_OPTIONS = [
  { value: 'ALL', label: 'Tous les métiers' },
  { value: 'logistique', label: 'Livraison' },
  { value: 'macons', label: 'Maçonnerie' },
  { value: 'reseau', label: 'Réseau' },
  { value: 'interieur_type1', label: 'Installation' },
  { value: 'controle', label: 'Contrôle' },
];

// Optimisation : Memoization des options de régions
const RegionSelect = memo(({ 
  value, 
  onChange, 
  availableRegions 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  availableRegions: string[]; 
}) => {
  const regionOptions = useMemo(() => [
    { value: 'ALL', label: 'Toutes régions' },
    ...availableRegions.map(region => ({ value: region, label: region }))
  ], [availableRegions]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {regionOptions.map(option => (
        <option key={option.value} value={option.value} className="bg-gray-800">
          {option.label}
        </option>
      ))}
    </select>
  );
});

RegionSelect.displayName = 'RegionSelect';

// Optimisation : Memoization des options d'équipes
const TeamSelect = memo(({ 
  value, 
  onChange, 
  availableTeams 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  availableTeams: Array<{ id: string; name: string; tradeKey?: string }>; 
}) => {
  const teamOptions = useMemo(() => [
    { value: 'ALL', label: 'Toutes équipes' },
    ...availableTeams.map(team => ({ 
      value: team.id, 
      label: `${team.name} (${team.tradeKey || 'N/A'})` 
    }))
  ], [availableTeams]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {teamOptions.map(option => (
        <option key={option.value} value={option.value} className="bg-gray-800">
          {option.label}
        </option>
      ))}
    </select>
  );
});

TeamSelect.displayName = 'TeamSelect';

// Optimisation : Composant de badge de filtre
const FilterBadge = memo(({ 
  label, 
  color, 
  isActive, 
  onClick 
}: { 
  label: string; 
  color: string; 
  isActive: boolean; 
  onClick: () => void; 
}) => (
  <motion.button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
      isActive 
        ? `${color} text-white shadow-lg` 
        : 'bg-white/10 text-white/70 hover:bg-white/20'
    }`}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {label}
  </motion.button>
));

FilterBadge.displayName = 'FilterBadge';

export const PlanningFilters = memo(({
  phaseFilter,
  selectedRegion,
  selectedTrade,
  selectedTeam,
  availableRegions,
  availableTeams,
  onPhaseFilterChange,
  onRegionChange,
  onTradeChange,
  onTeamChange,
  onReset,
  isLoading = false,
}: PlanningFiltersProps) => {
  // Optimisation : Calcul du nombre de filtres actifs
  const activeFilterCount = useMemo(() => {
    return [
      phaseFilter !== 'ALL',
      selectedRegion !== 'ALL',
      selectedTrade !== 'ALL',
      selectedTeam !== 'ALL',
    ].filter(Boolean).length;
  }, [phaseFilter, selectedRegion, selectedTrade, selectedTeam]);

  // Optimisation : Gestionnaire de réinitialisation avec confirmation
  const handleReset = useCallback(() => {
    if (activeFilterCount > 0) {
      onReset();
      toast.success('Filtres réinitialisés');
    }
  }, [activeFilterCount, onReset]);

  // Optimisation : Gestionnaire de changement de phase avec animation
  const handlePhaseChange = useCallback((value: string) => {
    onPhaseFilterChange(value);
  }, [onPhaseFilterChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
    >
      {/* En-tête avec compteur de filtres */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Filtres du planning</h3>
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full"
              >
                {activeFilterCount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        
        <button
          onClick={handleReset}
          disabled={activeFilterCount === 0 || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Réinitialiser
        </button>
      </div>

      {/* Filtres par phase */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-white/70 mb-3">
          Phase du projet
        </label>
        <div className="flex flex-wrap gap-2">
          {PHASE_OPTIONS.map((option) => (
            <FilterBadge
              key={option.value}
              label={option.label}
              color={option.color}
              isActive={phaseFilter === option.value}
              onClick={() => handlePhaseChange(option.value)}
            />
          ))}
        </div>
      </div>

      {/* Filtres par dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Région
          </label>
          <RegionSelect
            value={selectedRegion}
            onChange={onRegionChange}
            availableRegions={availableRegions}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Métier
          </label>
          <select
            value={selectedTrade}
            onChange={(e) => onTradeChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TRADE_OPTIONS.map(option => (
              <option key={option.value} value={option.value} className="bg-gray-800">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Équipe
          </label>
          <TeamSelect
            value={selectedTeam}
            onChange={onTeamChange}
            availableTeams={availableTeams}
          />
        </div>
      </div>

      {/* Indicateur de chargement */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-blue-400 text-sm"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            Mise à jour des filtres...
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PlanningFilters.displayName = 'PlanningFilters';
