/**
 * useMapVisibility.ts
 * 
 * Hook pour gérer la visibilité des calques
 * - Heatmap on/off
 * - Anciennes grappes toujours masquées
 * - Auto-grappes toujours visibles
 */

import maplibregl from 'maplibre-gl';

export const useMapVisibility = (
    showHeatmap: boolean,
    _showZones: boolean,
    styleIsReady: boolean
) => {
    const setupVisibility = (map: maplibregl.Map) => {
        if (!map || !styleIsReady) return;

        // Household and Heatmap visibility
        const householdVisibility = showHeatmap ? 'none' : 'visible';
        
        ['households-server-layer', 'households-local-layer'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', householdVisibility);
            }
        });

        if (map.getLayer('heatmap')) {
            map.setLayoutProperty('heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
        }

        // Always hide old grappes - use auto-grappes instead
        if (map.getLayer('grappes-layer')) {
            map.setLayoutProperty('grappes-layer', 'visibility', 'none');
            map.setLayoutProperty('grappes-labels', 'visibility', 'none');
            map.setLayoutProperty('sous-grappes-layer', 'visibility', 'none');
        }

        // Always show auto-grappes
        if (map.getLayer('auto-grappes-fill')) {
            map.setLayoutProperty('auto-grappes-fill', 'visibility', 'visible');
            map.setLayoutProperty('auto-grappes-outline', 'visibility', 'visible');
            map.setLayoutProperty('auto-grappes-labels', 'visibility', 'visible');
        }
    };

    return { setupVisibility };
};
