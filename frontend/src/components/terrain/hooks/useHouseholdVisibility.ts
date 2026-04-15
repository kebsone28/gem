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

      // Tier 1: zoom < 8    → Points microscopiques (Vue nationale)
      // Tier 2: zoom 8-15   → Clusters / Grappes (Vue village)
      // Tier 3: zoom >= 15  → Icônes détaillées (Vue précise)

      const isNationalView = zoom < 8;
      const isVillageView = zoom >= 8 && zoom < 15;
      const isPreciseView = zoom >= 15;

      // Supercluster circles + counts (Visibles de Tier 1 à Tier 2)
      const clusterVisible = zoom < 15;
      if (map.getLayer('cluster-circles')) {
        map.setLayoutProperty('cluster-circles', 'visibility', clusterVisible ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-counts')) {
        map.setLayoutProperty('cluster-counts', 'visibility', clusterVisible ? 'visible' : 'none');
      }

      // Glow / Scintillement visibility
      if (map.getLayer('households-glow-layer')) {
        map.setLayoutProperty(
          'households-glow-layer',
          'visibility',
          zoom < 15 ? 'visible' : 'none'
        );
      }

      // Points simples (Vue distribution) - Toujours visibles mais très petits en dézoom
      if (map.getLayer('households-circles-simple')) {
        map.setLayoutProperty(
          'households-circles-simple',
          'visibility',
          zoom < 15 ? 'visible' : 'none'
        );
      }

      // Full icon markers + labels (Tier 3 only)
      if (map.getLayer('households-local-layer')) {
        map.setLayoutProperty(
          'households-local-layer',
          'visibility',
          isPreciseView ? 'visible' : 'none'
        );
      }
      if (map.getLayer('households-labels-simple')) {
        map.setLayoutProperty(
          'households-labels-simple',
          'visibility',
          isPreciseView ? 'visible' : 'none'
        );
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
