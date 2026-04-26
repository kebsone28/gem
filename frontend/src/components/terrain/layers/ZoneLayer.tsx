/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ZoneLayer.tsx — Village Region Renderer
 *
 * Displays each village as a convex hull polygon (region) with:
 * - A semi-transparent fill colored per-village
 * - A dashed outline
 * - A label showing village name + household count
 */

import React, { useCallback, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

interface ZoneLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  grappeZonesData: any;
  grappeCentroidsData: any;
  showZones?: boolean;
}

const ZONE_LAYERS = ['village-fill', 'village-outline', 'village-outline-color', 'village-labels'];
const SAFE_TEXT_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];
const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as GeoJSON.Feature[],
};

const ZoneLayer: React.FC<ZoneLayerProps> = ({
  map,
  styleIsReady,
  grappeZonesData,
  grappeCentroidsData,
  showZones = true,
}) => {
  const setupLayers = useCallback(
    (m: maplibregl.Map) => {
      if ((m as any)._removed || !m.isStyleLoaded()) return;

      try {
        const zonesSrc = m.getSource('village-zones') as maplibregl.GeoJSONSource | undefined;
        if (zonesSrc) {
          zonesSrc.setData((grappeZonesData || EMPTY_FEATURE_COLLECTION) as any);
        } else {
          m.addSource('village-zones', {
            type: 'geojson',
            data: (grappeZonesData || EMPTY_FEATURE_COLLECTION) as any,
            generateId: true,
          });
        }

        const centroidsSrc = m.getSource('village-centroids') as
          | maplibregl.GeoJSONSource
          | undefined;
        if (centroidsSrc) {
          centroidsSrc.setData((grappeCentroidsData || EMPTY_FEATURE_COLLECTION) as any);
        } else {
          m.addSource('village-centroids', {
            type: 'geojson',
            data: (grappeCentroidsData || EMPTY_FEATURE_COLLECTION) as any,
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-fill')) {
          m.addLayer({
            id: 'village-fill',
            type: 'fill',
            source: 'village-zones',
            layout: { visibility: showZones ? 'visible' : 'none' },
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#6366F1'],
              'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 12, 0.3, 16, 0.15],
            },
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-outline')) {
          m.addLayer({
            id: 'village-outline',
            type: 'line',
            source: 'village-zones',
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 6],
              'line-opacity': 0.8,
              'line-dasharray': [3, 2],
            },
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-outline-color')) {
          m.addLayer({
            id: 'village-outline-color',
            type: 'line',
            source: 'village-zones',
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#6366F1'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2, 18, 3],
              'line-opacity': 1,
            },
          });
        }

        if (m.getSource('village-centroids') && !m.getLayer('village-labels')) {
          m.addLayer({
            id: 'village-labels',
            type: 'symbol',
            source: 'village-centroids',
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'text-field': [
                'concat',
                ['upcase', ['coalesce', ['get', 'village'], 'Village']],
                '\n',
                ['to-string', ['to-number', ['get', 'count'], 0]],
                ' ménages',
              ],
              'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 16, 18, 20],
              'text-font': SAFE_TEXT_FONT,
              'text-anchor': 'center',
              'text-max-width': 12,
              'text-line-height': 1.1,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2,
              'text-opacity': 1,
            },
          });
        }

        logger.debug(
          `✅ [ZoneLayer] ${grappeZonesData?.features?.length ?? 0} village regions rendered`
        );
      } catch (err) {
        logger.warn('⚠️ [ZoneLayer] Layer setup error:', err);
      }
    },
    [grappeZonesData, grappeCentroidsData, showZones]
  );

  useEffect(() => {
    if (!map || !styleIsReady) return;

    const queueSetup = () => {
      if ((map as any)._removed || !map.isStyleLoaded()) return;
      setTimeout(() => setupLayers(map), 0);
    };

    if (map.isStyleLoaded()) {
      queueSetup();
    }

    map.on('style.load', queueSetup);
    return () => {
      map.off('style.load', queueSetup);
    };
  }, [map, styleIsReady, grappeZonesData, grappeCentroidsData, setupLayers]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    ZONE_LAYERS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
      }
    });
  }, [map, showZones, styleIsReady]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    let hoveredId: number | string | null = null;

    const onMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: false });
      }
      hoveredId = e.features[0].id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: true });
      }
      map.getCanvas().style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      map.getCanvas().style.cursor = '';
    };

    if (map.getLayer('village-fill')) {
      map.on('mousemove', 'village-fill', onMouseMove);
      map.on('mouseleave', 'village-fill', onMouseLeave);
    }

    return () => {
      map.off('mousemove', 'village-fill', onMouseMove);
      map.off('mouseleave', 'village-fill', onMouseLeave);
    };
  }, [map, styleIsReady]);

  return null;
};

export default React.memo(ZoneLayer);
