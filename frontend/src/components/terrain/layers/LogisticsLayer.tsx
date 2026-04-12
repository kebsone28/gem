import React, { useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';

interface LogisticsLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  warehouses: any[];
}

const LogisticsLayer: React.FC<LogisticsLayerProps> = ({ map, styleIsReady, warehouses = [] }) => {
  // 🏷️ DATA GEOJSON
  const warehousesGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: (warehouses || [])
        .filter((w: any) => w.latitude != null && w.longitude != null)
        .map((w: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(w.longitude), Number(w.latitude)] },
          properties: {
            id: w.id,
            name: w.name,
            stockStatus: w.hasAlert ? 'alert' : 'ok',
            geofencingRadius: Number(w.geofencingRadius) || 500,
          },
        })),
    }),
    [warehouses]
  );

  // 🏷️ SOURCES
  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded()) return;

    try {
      if (!map.getSource('warehouses-source')) {
        map.addSource('warehouses-source', { type: 'geojson', data: warehousesGeoJSON as any });
      }
    } catch (err) {
      console.warn('⚠️ Failed to add warehouse source - style may not be ready:', err);
    }
  }, [map, styleIsReady, warehousesGeoJSON]);

  // 🏷️ DATA SYNC
  useEffect(() => {
    if (!map || !styleIsReady) return;
    const source = map.getSource('warehouses-source') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(warehousesGeoJSON as any);
  }, [map, styleIsReady, warehousesGeoJSON]);

  // 🏷️ LAYERS
  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded()) return;

    const setupLayers = () => {
      try {
        // Geofence circles
        if (!map.getLayer('warehouses-geofence')) {
          map.addLayer({
            id: 'warehouses-geofence',
            type: 'circle',
            source: 'warehouses-source',
            paint: {
              'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                10,
                ['/', ['to-number', ['get', 'geofencingRadius'], 500], 100],
                20,
                ['/', ['to-number', ['get', 'geofencingRadius'], 500], 0.1],
              ],
              'circle-color': '#10b981',
              'circle-opacity': 0.1,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#059669',
            },
          });
        }

        // Warehouse point
        if (!map.getLayer('warehouses-layer')) {
          map.addLayer({
            id: 'warehouses-layer',
            type: 'circle',
            source: 'warehouses-source',
            paint: {
              'circle-radius': 10,
              'circle-color': [
                'match',
                ['coalesce', ['get', 'stockStatus'], 'ok'],
                'alert',
                '#ef4444',
                '#3b82f6',
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
        }

        // Labels
        if (!map.getLayer('warehouses-labels')) {
          map.addLayer({
            id: 'warehouses-labels',
            type: 'symbol',
            source: 'warehouses-source',
            minzoom: 8,
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 12,
              'text-font': ['Open Sans Bold', 'Inter Bold'],
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#0f172a',
              'text-halo-width': 1.5,
            },
          });
        }
      } catch (err) {
        console.warn('⚠️ Failed to add warehouse layers - style may not be ready:', err);
      }
    };

    setupLayers();
  }, [map, styleIsReady]);

  return null;
};

export default React.memo(LogisticsLayer);
