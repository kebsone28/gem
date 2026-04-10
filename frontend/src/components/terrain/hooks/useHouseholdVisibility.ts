import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Hook: Household Layer Visibility
 *
 * Manages layer visibility based on zoom level via event-driven updates.
 * Clusters visible at zoom < 14, markers visible at zoom >= 14.
 *
 * @param map - MapLibre GL map instance
 */
export const useHouseholdVisibility = (map: maplibregl.Map | null): void => {
  useEffect(() => {
    if (!map) return;

    const updateVisibility = () => {
      const zoom = map.getZoom();

      // ─── 3-TIER ZOOM SYSTEM ──────────────────────────────────────────────
      // Tier 1: zoom < 11   → Supercluster bubbles only  (national/regional view)
      // Tier 2: zoom 11-13  → Supercluster + simple dot fallback (city view)
      // Tier 3: zoom >= 14  → Individual icon markers + labels (street view)

      const isMacroView   = zoom < 11;
      const isMidView     = zoom >= 11 && zoom < 14;
      const isMicroView   = zoom >= 14;

      // Supercluster circles + counts (Tier 1 & 2)
      const clusterVisible = isMacroView || isMidView;
      if (map.getLayer('cluster-circles')) {
        map.setLayoutProperty('cluster-circles', 'visibility', clusterVisible ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-counts')) {
        map.setLayoutProperty('cluster-counts', 'visibility', clusterVisible ? 'visible' : 'none');
      }

      // Simple red-dot fallback: only in mid-view as supplement, hidden otherwise
      // (avoids double rendering — supercluster already shows counts)
      if (map.getLayer('households-circles-simple')) {
        map.setLayoutProperty('households-circles-simple', 'visibility', isMidView ? 'none' : 'none');
      }

      // Full icon markers + labels (Tier 3 only)
      if (map.getLayer('households-local-layer')) {
        map.setLayoutProperty('households-local-layer', 'visibility', isMicroView ? 'visible' : 'none');
      }
      if (map.getLayer('households-labels-simple')) {
        map.setLayoutProperty('households-labels-simple', 'visibility', isMicroView ? 'visible' : 'none');
      }
    };

    // Initial render
    updateVisibility();

    map.on('zoomend', updateVisibility);
    map.on('zoom', updateVisibility); // smooth transition during pinch/scroll

    return () => {
      map.off('zoomend', updateVisibility);
      map.off('zoom', updateVisibility);
    };
  }, [map]);
};

/**
 * Hook: Heatmap Visibility Control
 *
 * Controls heatmap visibility based on prop.
 * Decoupled from layer creation.
 *
 * @param map - MapLibre GL map instance
 * @param showHeatmap - Whether to show heatmap
 */
export const useHeatmapVisibility = (
  map: maplibregl.Map | null,
  showHeatmap: boolean = false
): void => {
  useEffect(() => {
    if (!map) return;

    if (map.getLayer('heatmap')) {
      map.setLayoutProperty('heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
    }
  }, [map, showHeatmap]);
};

/**
 * Hook: Household Layer Filters
 *
 * Applies filters to affected layers based on selected phases and team.
 * Pure reactivity to Zustand state.
 *
 * @param map - MapLibre GL map instance
 * @param selectedPhases - Array of selected phase statuses
 * @param selectedTeam - Selected team ID or 'all'
 */
export const useHouseholdFilters = (
  map: maplibregl.Map | null,
  selectedPhases: string[] = [],
  selectedTeam: string = 'all'
): void => {
  useEffect(() => {
    if (!map) return;

    const buildFilter = () => {
      const filters: any[] = ['all'];

      if (selectedPhases.length > 0) {
        filters.push(['in', ['coalesce', ['get', 'status'], ''], ['literal', selectedPhases]]);
      }

      if (selectedTeam !== 'all') {
        filters.push(['in', selectedTeam, ['coalesce', ['get', 'assignedTeams'], ['literal', []]]]);
      }

      return filters.length > 1 ? filters : null;
    };

    const filter = buildFilter();

    // Apply to affected layers
    ['heatmap', 'households-local-layer'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filter as any);
      }
    });
  }, [map, selectedPhases, selectedTeam]);
};
