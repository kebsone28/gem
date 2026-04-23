 
/**
 * useMapVisibility.ts
 *
 * Hook pour gérer la visibilité des calques
 * - Heatmap on/off
 * - Anciennes grappes toujours masquées
 * - Auto-grappes toujours visibles
 */

import maplibregl from 'maplibre-gl';

import { useTerrainUIStore } from '../../store/terrainUIStore';

export const useMapVisibility = (styleIsReady: boolean) => {
  const showHeatmap = useTerrainUIStore((s) => s.showHeatmap);
  const showZones = useTerrainUIStore((s) => s.showZones);
  const showWarehouses = useTerrainUIStore((s) => s.showWarehouses);

  const setupVisibility = (map: maplibregl.Map) => {
    if (!map || !styleIsReady) return;

    const setLayerVisibility = (layerIds: string[], visibility: 'visible' | 'none') => {
      layerIds.forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visibility);
        } else {
          // console.warn(`Layer ${id} not found`); // Optionnel, utile en debug
        }
      });
    };

    // Household and Heatmap visibility
    setLayerVisibility(
      ['households-server-layer', 'households-local-layer', 'households-sync-indicator'],
      showHeatmap ? 'none' : 'visible'
    );
    setLayerVisibility(['heatmap'], showHeatmap ? 'visible' : 'none');

    // Toujours masquer les anciennes grappes
    setLayerVisibility(['grappes-layer', 'grappes-labels', 'sous-grappes-layer'], 'none');

    // Afficher/masquer les Auto-Grappes (polygones/trapèzes) et les clusters selon le bouton Zones
    const zonesVisibility = showZones ? 'visible' : 'none';
    setLayerVisibility(
      [
        'auto-grappes-fill',
        'auto-grappes-outline',
        'auto-grappes-labels',
        'cluster-circles',
        'cluster-counts',
      ],
      zonesVisibility
    );

    // Warehouses visibility
    setLayerVisibility(
      ['warehouses-layer', 'warehouses-labels'],
      showWarehouses ? 'visible' : 'none'
    );
  };

  return { setupVisibility };
};
