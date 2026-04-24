/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ZoneLayer.tsx — Village Region Renderer
 *
 * Displays each village as a convex hull polygon (region) with:
 * - A semi-transparent fill colored per-village
 * - A dashed outline
 * - A label showing village name + household count
 */

import React, { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

interface ZoneLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  grappeZonesData: any;      // Village convex hulls GeoJSON
  grappeCentroidsData: any;  // Village centroids GeoJSON
  showZones?: boolean;
}

const ZONE_LAYERS = ['village-fill', 'village-outline', 'village-outline-color', 'village-labels'];

const ZoneLayer: React.FC<ZoneLayerProps> = ({
  map,
  styleIsReady,
  grappeZonesData,
  grappeCentroidsData,
  showZones = true,
}) => {

  // ── SETUP FUNCTION (idempotent) ──────────────────────────────────────
  const setupLayers = useCallback((m: maplibregl.Map) => {
    if (!m.isStyleLoaded()) return;
    if (!grappeZonesData && !grappeCentroidsData) return;

    try {
      // Upsert zone source
      const zonesSrc = m.getSource('village-zones') as maplibregl.GeoJSONSource | undefined;
      if (zonesSrc) {
        if (grappeZonesData) zonesSrc.setData(grappeZonesData);
      } else if (grappeZonesData) {
        m.addSource('village-zones', {
          type: 'geojson',
          data: grappeZonesData,
          generateId: true,
        });
      }

      // Upsert centroids source
      const centroidsSrc = m.getSource('village-centroids') as maplibregl.GeoJSONSource | undefined;
      if (centroidsSrc) {
        if (grappeCentroidsData) centroidsSrc.setData(grappeCentroidsData);
      } else if (grappeCentroidsData) {
        m.addSource('village-centroids', {
          type: 'geojson',
          data: grappeCentroidsData,
        });
      }

      // Fill layer
      if (m.getSource('village-zones') && !m.getLayer('village-fill')) {
        m.addLayer({
          id: 'village-fill',
          type: 'fill',
          source: 'village-zones',
          layout: { visibility: showZones ? 'visible' : 'none' },
          paint: {
            'fill-color': ['coalesce', ['get', 'color'], '#6366F1'],
            'fill-opacity': [
              'interpolate', ['linear'], ['zoom'],
              4, 0.4,
              12, 0.3,
              16, 0.15
            ],
          },
        });
      }

      // Outline layer (Thick, dashed, high-contrast)
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
            'line-color': '#ffffff', // White outline for high contrast on black
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 6],
            'line-opacity': 0.8,
            'line-dasharray': [3, 2],
          },
        });
      }

      // Inner stroke for color
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

      // Label layer (Village name + Count)
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
            'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
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

      logger.debug(`✅ [ZoneLayer] ${grappeZonesData?.features?.length ?? 0} village regions rendered`);
    } catch (err) {
      logger.warn('⚠️ [ZoneLayer] Layer setup error:', err);
    }
  }, [grappeZonesData, grappeCentroidsData, showZones]);

  // ── MAIN EFFECT ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!grappeZonesData && !grappeCentroidsData) return;

    // Run immediately
    setupLayers(map);

    // Also re-run after style reload (theme switch)
    const onStyleLoad = () => setupLayers(map);
    map.on('style.load', onStyleLoad);
    return () => { map.off('style.load', onStyleLoad); };
  }, [map, styleIsReady, grappeZonesData, grappeCentroidsData, setupLayers]);

  // ── VISIBILITY TOGGLE ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !styleIsReady) return;
    ZONE_LAYERS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
      }
    });
  }, [map, showZones, styleIsReady]);

  // ── HOVER STATE ───────────────────────────────────────────────────────
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
