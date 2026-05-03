/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { senegalRegions } from '../../../data/senegal-regions';
import logger from '../../../utils/logger';

const SAFE_TEXT_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];
const EMPTY_REGIONS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [] as GeoJSON.Feature[],
};

interface BackgroundLayerProps {
  map: maplibregl.Map | null;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ map }) => {
  useEffect(() => {
    if (!map) return;

    let isCancelled = false;

    const isMapUsable = () => {
      if (isCancelled || (map as any)._removed) return false;
      try {
        return !!map.getStyle() && map.isStyleLoaded();
      } catch {
        return false;
      }
    };

    const setupBackground = () => {
      if (!isMapUsable()) return;

      try {
        const source = map.getSource('senegal-regions') as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData((senegalRegions || EMPTY_REGIONS_GEOJSON) as any);
        } else {
          map.addSource('senegal-regions', {
            type: 'geojson',
            data: (senegalRegions || EMPTY_REGIONS_GEOJSON) as any,
          });
        }

        if (!map.getLayer('senegal-regions-fill')) {
          map.addLayer({
            id: 'senegal-regions-fill',
            type: 'fill',
            source: 'senegal-regions',
            paint: {
              'fill-color': '#cbd5e1',
              'fill-opacity': 0.05,
            },
          });
        }

        if (!map.getLayer('senegal-regions-outline')) {
          map.addLayer({
            id: 'senegal-regions-outline',
            type: 'line',
            source: 'senegal-regions',
            paint: {
              'line-color': '#64748b',
              'line-width': 1.5,
              'line-opacity': 0.3,
              'line-dasharray': [2, 2],
            },
          });
        }

        if (!map.getLayer('senegal-regions-label')) {
          map.addLayer({
            id: 'senegal-regions-label',
            type: 'symbol',
            source: 'senegal-regions',
            layout: {
              'text-field': ['to-string', ['coalesce', ['get', 'REGION'], 'Sénégal']],
              'text-size': 12,
              'text-font': SAFE_TEXT_FONT,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#64748b',
              'text-opacity': 0.5,
              'text-halo-color': '#ffffff',
              'text-halo-width': 1,
            },
          });
        }
      } catch (error) {
        logger.debug('[BackgroundLayer] Deferred setup skipped:', error);
      }
    };

    if (isMapUsable()) {
      setTimeout(setupBackground, 0);
    }

    map.on('style.load', setupBackground);

    return () => {
      isCancelled = true;
      map.off('style.load', setupBackground);
    };
  }, [map]);

  return null;
};

export default React.memo(BackgroundLayer);
