/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

interface LogisticsLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  warehouses: any[];
}

const EMPTY_WAREHOUSES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [] as GeoJSON.Feature[],
};
const SAFE_TEXT_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];

const LogisticsLayer: React.FC<LogisticsLayerProps> = ({ map, styleIsReady, warehouses = [] }) => {
  // 🏷️ DATA GEOJSON
  const warehousesGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: (warehouses || [])
        .filter((w: any) => {
          const latitude = Number(w.latitude);
          const longitude = Number(w.longitude);
          return Number.isFinite(latitude) && Number.isFinite(longitude);
        })
        .map((w: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(w.longitude), Number(w.latitude)],
          },
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

  // 🏷️ BOOTSTRAP SOURCE + LAYERS
  useEffect(() => {
    if (!map || !styleIsReady) return;

    let isCancelled = false;

    const isMapUsable = () =>
      !isCancelled && !!map && !(map as any)._removed && map.isStyleLoaded();

    const ensureSource = () => {
      if (!isMapUsable()) return false;

      try {
        if (!map.getSource('warehouses-source')) {
          map.addSource('warehouses-source', {
            type: 'geojson',
            data: EMPTY_WAREHOUSES_GEOJSON as any,
          });
        }

        return true;
      } catch (err) {
        logger.debug('⚠️ Failed to add warehouse source - style may not be ready:', err);
        return false;
      }
    };

    const ensureLayers = () => {
      if (!ensureSource()) return;

      try {
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

        if (!map.getLayer('warehouses-labels')) {
          map.addLayer({
            id: 'warehouses-labels',
            type: 'symbol',
            source: 'warehouses-source',
            minzoom: 8,
            layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-font': SAFE_TEXT_FONT,
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
        logger.debug('⚠️ Failed to add warehouse layers - style may not be ready:', err);
      }
    };

    const bootstrap = () => {
      if (!isMapUsable()) return;
      ensureLayers();
    };

    const queueBootstrap = () => {
      if (!isMapUsable()) return;
      setTimeout(bootstrap, 0);
    };

    if (map.isStyleLoaded()) {
      queueBootstrap();
    }

    map.on('style.load', queueBootstrap);

    return () => {
      isCancelled = true;
      map.off('style.load', queueBootstrap);
    };
  }, [map, styleIsReady]);

  // 🏷️ DATA SYNC
  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded() || (map as any)._removed) return;

    try {
      const source = map.getSource('warehouses-source') as maplibregl.GeoJSONSource | undefined;
      source?.setData(warehousesGeoJSON as any);
    } catch (err) {
      logger.debug('⚠️ Failed to sync warehouse source data:', err);
    }
  }, [map, styleIsReady, warehousesGeoJSON]);

  return null;
};

export default React.memo(LogisticsLayer);
