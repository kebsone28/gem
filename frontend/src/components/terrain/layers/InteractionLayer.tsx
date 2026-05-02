/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

interface InteractionLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
}

const EMPTY_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as any[],
};

const InteractionLayer: React.FC<InteractionLayerProps> = ({
  map,
  styleIsReady,
}) => {
  // 🏷️ SOURCES
  useEffect(() => {
    if (!map || !styleIsReady || (map as any)._removed || !map.getStyle() || !map.isStyleLoaded()) return;

    const ensureSources = () => {
      if ((map as any)._removed || !map.getStyle() || !map.isStyleLoaded()) return;

      try {
        if (!map.getSource('route-source')) {
          map.addSource('route-source', {
            type: 'geojson',
            data: EMPTY_COLLECTION,
          });
        }
        if (!map.getSource('route-source')) {
          map.addSource('route-source', {
            type: 'geojson',
            data: EMPTY_COLLECTION,
          });
        }
      } catch (err) {
        logger.debug('⚠️ Failed to add sources - style may not be ready:', err);
      }
    };

    if (map.loaded()) {
      ensureSources();
    } else {
      map.once('idle', ensureSources);
    }

    return () => {
      map.off('idle', ensureSources);
    };
  }, [map, styleIsReady]);


  // 🏷️ LAYERS
  useEffect(() => {
    if (!map || !styleIsReady || (map as any)._removed || !map.getStyle() || !map.isStyleLoaded()) return;

    const setupLayers = () => {
      if (
        (map as any)._removed ||
        !map.getStyle() ||
        !map.isStyleLoaded() ||
        !map.getSource('route-source')
      ) {
        return;
      }

      try {
        // Routing line
        if (!map.getLayer('route-layer')) {
          map.addLayer({
            id: 'route-layer',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#10b981', 'line-width': 5, 'line-opacity': 0.8 },
          });
        }

      } catch (err) {
        logger.debug('⚠️ Failed to add layers - style may not be ready:', err);
      }
    };

    if (map.loaded()) {
      setupLayers();
    } else {
      map.once('idle', setupLayers);
    }

    return () => {
      map.off('idle', setupLayers);
    };
  }, [map, styleIsReady]);

  return null;
};

export default React.memo(InteractionLayer);
