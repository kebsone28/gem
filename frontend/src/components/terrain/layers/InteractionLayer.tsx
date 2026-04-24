/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

interface InteractionLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  drawnZones: any[];
  pendingPoints: any[];
}

const InteractionLayer: React.FC<InteractionLayerProps> = ({
  map,
  styleIsReady,
  drawnZones = [],
  pendingPoints = [],
}) => {
  // 🏷️ SOURCES
  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded()) return;

    try {
      if (!map.getSource('route-source')) {
        map.addSource('route-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getSource('pending-zone')) {
        map.addSource('pending-zone', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getSource('drawn-zones')) {
        map.addSource('drawn-zones', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
    } catch (err) {
      logger.debug('⚠️ Failed to add sources - style may not be ready:', err);
    }
  }, [map, styleIsReady]);

  // 🏷️ DATA SYNC (Pending Drawing)
  useEffect(() => {
    if (!map || !styleIsReady) return;
    const source = map.getSource('pending-zone') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features:
          pendingPoints.length > 0
            ? [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [[...pendingPoints, pendingPoints[0]]],
                  },
                  properties: {},
                } as any,
              ]
            : [],
      });
    }
  }, [map, styleIsReady, pendingPoints]);

  // 🏷️ DATA SYNC (Drawn Zones)
  useEffect(() => {
    if (!map || !styleIsReady) return;
    const source = map.getSource('drawn-zones') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: (drawnZones || []).map((z) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [z.coordinates] },
          properties: { name: z.name, color: z.color || '#3b82f6' },
        })),
      });
    }
  }, [map, styleIsReady, drawnZones]);

  // 🏷️ LAYERS
  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded()) return;

    const setupLayers = () => {
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

        // Pending Zone fill
        if (!map.getLayer('pending-zone-fill')) {
          map.addLayer({
            id: 'pending-zone-fill',
            type: 'fill',
            source: 'pending-zone',
            paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 },
          });
        }

        // Drawn Zones fill
        if (!map.getLayer('drawn-zones-fill')) {
          map.addLayer({
            id: 'drawn-zones-fill',
            type: 'fill',
            source: 'drawn-zones',
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 },
          });
        }

        if (!map.getLayer('drawn-zones-outline')) {
          map.addLayer({
            id: 'drawn-zones-outline',
            type: 'line',
            source: 'drawn-zones',
            paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
          });
        }
      } catch (err) {
        logger.debug('⚠️ Failed to add layers - style may not be ready:', err);
      }
    };

    setupLayers();
  }, [map, styleIsReady]);

  return null;
};

export default React.memo(InteractionLayer);
