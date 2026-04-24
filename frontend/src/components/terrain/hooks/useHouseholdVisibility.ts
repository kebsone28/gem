/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { ALL_STATUSES } from '../../../store/terrainUIStore';

/**
 * Hook: Household Layer Visibility
 *
 * Manages layer visibility based on zoom level via event-driven updates.
 * Clusters visible at zoom < 14, markers visible at zoom >= 14.
 *
 * @param map - MapLibre GL map instance
 */
export const useHouseholdVisibility = (
  map: maplibregl.Map | null,
  showZones: boolean = false
): void => {
  useEffect(() => {
    if (!map) return;

    const updateVisibility = () => {
      if (!map.isStyleLoaded()) return;

      const zoom = map.getZoom();

      // Supercluster circles + counts (Visibles uniquement si zoom < 15 ET zones désactivées)
      const clusterVisible = zoom < 15 && !showZones;
      
      if (map.getLayer('cluster-circles')) {
        map.setLayoutProperty('cluster-circles', 'visibility', clusterVisible ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-counts')) {
        map.setLayoutProperty('cluster-counts', 'visibility', clusterVisible ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-halo')) {
        map.setLayoutProperty('cluster-halo', 'visibility', clusterVisible ? 'visible' : 'none');
      }

      // Glow / Scintillement visibility - Toujours visible (Glow/Halo)
      if (map.getLayer('households-glow-layer')) {
        map.setLayoutProperty('households-glow-layer', 'visibility', 'visible');
      }

      // Points simples - DÉSACTIVÉS car on affiche directement les icônes
      if (map.getLayer('households-circles-simple')) {
        map.setLayoutProperty('households-circles-simple', 'visibility', 'none');
      }

      // Full icon markers - TOUJOURS VISIBLES (Google Earth Mode)
      if (map.getLayer('households-local-layer')) {
        map.setLayoutProperty('households-local-layer', 'visibility', 'visible');
      }

      // Labels - Uniquement à partir du zoom 15 pour performance
      if (map.getLayer('households-labels-simple')) {
        map.setLayoutProperty(
          'households-labels-simple',
          'visibility',
          zoom >= 15 ? 'visible' : 'none'
        );
      }
    };

    // Initial render
    updateVisibility();

    // ✅ Correction immédiate : forcer icon-opacity = 1 si le layer existe déjà
    // (corrige le cas où le layer a été créé avec icon-opacity:0 au zoom < 14)
    if (map.getLayer('households-local-layer')) {
      try {
        map.setPaintProperty('households-local-layer', 'icon-opacity', 1);
      } catch (_) { /* ignore */ }
    }

    map.on('zoomend', updateVisibility);
    map.on('zoom', updateVisibility); // smooth transition during pinch/scroll
    map.on('styledata', updateVisibility);
    map.on('idle', updateVisibility);

    return () => {
      map.off('zoomend', updateVisibility);
      map.off('zoom', updateVisibility);
      map.off('styledata', updateVisibility);
      map.off('idle', updateVisibility);
    };
  }, [map, showZones]);
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

    const syncHeatmapVisibility = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer('heatmap')) {
        map.setLayoutProperty('heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
      }
    };

    syncHeatmapVisibility();
    map.on('styledata', syncHeatmapVisibility);

    return () => {
      map.off('styledata', syncHeatmapVisibility);
    };
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

      // Only apply status filter if we have a non-empty, partial selection
      // When ALL statuses are selected (or more), don't apply any filter (show everything)
      if (selectedPhases.length > 0 && selectedPhases.length < ALL_STATUSES.length) {
        filters.push(['in', ['coalesce', ['get', 'status'], ''], ['literal', selectedPhases]]);
      }

      if (selectedTeam !== 'all') {
        filters.push(['in', selectedTeam, ['coalesce', ['get', 'assignedTeams'], ['literal', []]]]);
      }

      // Return null filter if no restrictions (show all features)
      return filters.length > 1 ? filters : null;
    };

    const applyFilter = () => {
      if (!map.isStyleLoaded()) return;

      const filter = buildFilter();

      ['heatmap', 'households-local-layer', 'households-glow-layer', 'households-photo-badge'].forEach(
        (layerId) => {
          if (map.getLayer(layerId)) {
            map.setFilter(layerId, filter as any);
          }
        }
      );
    };

    applyFilter();
    map.on('styledata', applyFilter);
    map.on('idle', applyFilter);

    return () => {
      map.off('styledata', applyFilter);
      map.off('idle', applyFilter);
    };
  }, [map, selectedPhases, selectedTeam]);
};
