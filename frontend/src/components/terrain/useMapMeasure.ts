/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useMapMeasure.ts
 *
 * Hook pour gérer l'outil de mesure/ruler
 */

import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';

export const useMapMeasure = () => {
  const measureRef = useRef<[number, number][]>([]);

  const setupMeasureTool = useCallback((map: maplibregl.Map, isMeasuring: boolean) => {
    const handleMeasureClick = (e: maplibregl.MapMouseEvent) => {
      if (!isMeasuring) return;
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      measureRef.current = [...measureRef.current, pt];
      updateMeasureLayer(map);
    };

    const updateMeasureLayer = (map: maplibregl.Map) => {
      const geojson: any = {
        type: 'FeatureCollection',
        features: [],
      };

      if (measureRef.current.length > 0) {
        geojson.features.push({
          type: 'Feature',
          geometry: { type: 'MultiPoint', coordinates: measureRef.current },
          properties: {},
        });
      }
      if (measureRef.current.length > 1) {
        geojson.features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: measureRef.current },
          properties: {},
        });
      }

      (map.getSource('measure') as any)?.setData(geojson);
    };

    if (isMeasuring) {
      if (!map.getSource('measure')) {
        map.addSource('measure', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'measure-line',
          type: 'line',
          source: 'measure',
          paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 1] },
        });
        map.addLayer({
          id: 'measure-points',
          type: 'circle',
          source: 'measure',
          paint: {
            'circle-radius': 5,
            'circle-color': '#fff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#3b82f6',
          },
        });
      }
      map.on('click', handleMeasureClick);
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.off('click', handleMeasureClick);
      map.getCanvas().style.cursor = '';
      measureRef.current = [];
      (map.getSource('measure') as any)?.setData({ type: 'FeatureCollection', features: [] });
    }

    return () => {
      map.off('click', handleMeasureClick);
    };
  }, []);

  return { setupMeasureTool, measureRef };
};
