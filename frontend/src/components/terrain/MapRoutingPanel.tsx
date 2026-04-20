/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * MapRoutingPanel.tsx
 *
 * Panneau de planification d'itinéraire multi-stops pour les tournées terrain.
 * Calcule la distance totale, estime le coût carburant, et ouvre le trajet dans Google Maps.
 * Algorithme TSP Nearest-Neighbor intégré pour optimiser l'ordre des arrêts.
 */
import React, { useState, useCallback } from 'react';
import {
  Truck,
  X,
  ChevronDown,
  ChevronUp,
  Navigation2,
  Route,
  MapPin,
  Trash2,
  ExternalLink,
  Shuffle,
  CheckCircle2,
} from 'lucide-react';
import type { Household } from '../../utils/types';
import { TurnByTurnInstructions, type TurnInstruction } from './TurnByTurnInstructions';

interface MapRoutingPanelProps {
  households: Household[];
  isDarkMode: boolean;
  onClose: () => void;
  turnByTurnInstructions?: TurnInstruction[];
  routeDistance?: number;
  routeDuration?: number;
}

function getDistanceKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371;
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180;
  const dLon = ((c2[0] - c1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1[1] * Math.PI) / 180) * Math.cos((c2[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Greedy Nearest-Neighbor TSP: part du premier point, toujours va au plus proche non visité */
function tspNearestNeighbor(houses: Household[]): Household[] {
  if (houses.length <= 2) return houses;
  const remaining = [...houses];
  const result: Household[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    const lastCoord = last.location!.coordinates as [number, number];
    let minDist = Infinity;
    let minIdx = 0;
    remaining.forEach((h, i) => {
      const d = getDistanceKm(lastCoord, h.location!.coordinates as [number, number]);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    });
    result.push(remaining.splice(minIdx, 1)[0]);
  }
  return result;
}

const FUEL_COST_PER_KM = 150; // FCFA per km

export const MapRoutingPanel: React.FC<MapRoutingPanelProps> = ({
  households,
  isDarkMode,
  onClose,
  turnByTurnInstructions,
  routeDistance,
  routeDuration,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);

  const pendingHouseholds = households.filter(
    (h) =>
      h.status !== 'Terminé' &&
      h.status !== 'Réception: Validée' &&
      Array.isArray(h.location?.coordinates) &&
      !isNaN(h.location!.coordinates[0])
  );

  const filtered = searchQ.trim()
    ? pendingHouseholds.filter(
        (h) =>
          h.id.toLowerCase().includes(searchQ.toLowerCase()) ||
          (h.owner || '').toLowerCase().includes(searchQ.toLowerCase())
      )
    : pendingHouseholds.slice(0, 20);

  const toggleHousehold = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setIsOptimized(false);
  }, []);

  const selectedHouseholds = selectedIds
    .map((id) => households.find((h) => h.id === id))
    .filter(Boolean) as Household[];

  const optimizeRoute = useCallback(() => {
    const optimized = tspNearestNeighbor(selectedHouseholds);
    setSelectedIds(optimized.map((h) => h.id));
    setIsOptimized(true);
  }, [selectedHouseholds]);

  const { totalKm, estimatedCost } = React.useMemo(() => {
    if (selectedHouseholds.length < 2) return { totalKm: 0, estimatedCost: 0 };
    let km = 0;
    for (let i = 0; i < selectedHouseholds.length - 1; i++) {
      const c1 = selectedHouseholds[i].location!.coordinates as [number, number];
      const c2 = selectedHouseholds[i + 1].location!.coordinates as [number, number];
      km += getDistanceKm(c1, c2);
    }
    return { totalKm: km, estimatedCost: km * FUEL_COST_PER_KM };
  }, [selectedHouseholds]);

  const openInGoogleMaps = () => {
    if (selectedHouseholds.length < 2) return;
    const origin = selectedHouseholds[0].location!.coordinates;
    const dest = selectedHouseholds[selectedHouseholds.length - 1].location!.coordinates;
    const waypoints = selectedHouseholds
      .slice(1, -1)
      .map((h) => `${h.location!.coordinates[1]},${h.location!.coordinates[0]}`)
      .join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin[1]},${origin[0]}&destination=${dest[1]},${dest[0]}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const base = isDarkMode
    ? 'bg-slate-900/95 border-slate-700 text-white'
    : 'bg-white/95 border-slate-200 text-slate-900';
  const sub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const rowHover = isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50';

  return (
    <div
      className={`absolute top-0 right-0 z-[200] max-w-[calc(100vw-2rem)] md:w-80 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${base}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center">
            <Truck size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm">Planifier une tournée</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded((e) => !e)}
            title={isExpanded ? 'Réduire' : 'Agrandir'}
            className={`p-1 rounded-md transition-colors ${rowHover}`}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className={`p-1 rounded-md transition-colors ${rowHover}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Route Summary */}
          {selectedIds.length > 1 && (
            <div className="px-4 py-3 border-b border-inherit bg-cyan-500/10">
              <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                  <Route size={12} />
                  <span>{totalKm.toFixed(1)} km</span>
                </div>
                <div className={`font-bold text-xs ${sub}`}>
                  ≈ {estimatedCost.toLocaleString()} FCFA
                </div>
                {/* TSP Optimize Button */}
                <button
                  onClick={optimizeRoute}
                  aria-label="Optimiser l'ordre des arrêts (TSP Nearest-Neighbor)"
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${isOptimized ? 'bg-emerald-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}
                >
                  {isOptimized ? <CheckCircle2 size={9} /> : <Shuffle size={9} />}
                  {isOptimized ? 'Optimisé' : 'Optimiser'}
                </button>
                <button
                  onClick={openInGoogleMaps}
                  aria-label="Ouvrir dans Google Maps"
                  className="flex items-center gap-1 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-cyan-600 transition-colors"
                >
                  Maps <ExternalLink size={9} />
                </button>
              </div>
              {isOptimized && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1.5">
                  ✓ Itinéraire optimisé — algorithme Nearest-Neighbor
                </p>
              )}
            </div>
          )}

          {/* Selected stops */}
          {selectedIds.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className={`text-xs font-black uppercase tracking-widest mb-2 ${sub}`}>
                Arrêts ({selectedIds.length})
              </p>
              <div className="flex flex-col gap-1 max-h-28 overflow-auto">
                {selectedHouseholds.map((h, i) => (
                  <div
                    key={h.id}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                  >
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate flex-1 font-medium">{h.id}</span>
                    <button
                      onClick={() => toggleHousehold(h.id)}
                      aria-label="Supprimer de la tournée"
                      className="text-rose-400 hover:text-rose-500 flex-shrink-0"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & household list to add */}
          <div className="px-4 py-3">
            <input
              type="text"
              placeholder="Chercher un ménage..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none mb-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
            />
            <div className="max-h-36 overflow-auto flex flex-col gap-0.5">
              {filtered.length === 0 && (
                <p className={`text-xs text-center py-4 ${sub}`}>Aucun ménage non débuté</p>
              )}
              {filtered.map((h) => {
                const isSelected = selectedIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleHousehold(h.id)}
                    title={h.id}
                    className={`flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg text-xs transition-colors ${isSelected ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : rowHover}`}
                  >
                    <MapPin size={10} className={isSelected ? 'text-cyan-500' : sub} />
                    <span className="flex-1 font-medium truncate">{h.id}</span>
                    {h.owner && <span className={`text-xs ${sub} truncate`}>{h.owner}</span>}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                        {selectedIds.indexOf(h.id) + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedIds.length > 1 && (
            <div className="px-4 pb-3">
              <button
                onClick={openInGoogleMaps}
                aria-label="Lancer la tournée dans Google Maps"
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                <Navigation2 size={12} /> Lancer la tournée
              </button>
            </div>
          )}

          {/* Turn-by-Turn Instructions Panel */}
          {turnByTurnInstructions &&
            turnByTurnInstructions.length > 0 &&
            routeDistance &&
            routeDuration && (
              <div className="px-4 py-3 border-t border-inherit">
                <TurnByTurnInstructions
                  instructions={turnByTurnInstructions}
                  isDarkMode={isDarkMode}
                  totalDistance={routeDistance}
                  totalDuration={routeDuration}
                />
              </div>
            )}
        </>
      )}
    </div>
  );
};
