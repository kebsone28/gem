import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { senegalRegions } from '../../../data/senegal-regions';

interface BackgroundLayerProps {
  map: maplibregl.Map | null;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ map }) => {
  useEffect(() => {
    if (!map) return;

    const setupBackground = () => {
      if (!map.getSource('senegal-regions')) {
        map.addSource('senegal-regions', {
          type: 'geojson',
          data: senegalRegions as any,
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
            'text-font': ['Open Sans Bold', 'Inter Bold'],
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
    };

    if (map.isStyleLoaded()) {
      setupBackground();
    } else {
      map.once('styledata', setupBackground);
    }

    return () => {
      // Cleanup on switch or unmount if necessary
      // We usually don't remove background sources/layers on every render
    };
  }, [map]);

  return null;
};

export default React.memo(BackgroundLayer);
