/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * useMapLasso.ts
 *
 * Hook to handle freehand Lasso Selection on MapLibre.
 * Allows selecting multiple households by drawing a polygon.
 */
import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../utils/logger';

// Point in Polygon algorithm (Jordan curve theorem / Ray casting)
const isPointInPolygon = (point: [number, number], polygon: [number, number][]) => {
  const x = point[0],
    y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const useMapLasso = (
  isSelecting: boolean,
  householdsRef: React.MutableRefObject<any[]>,
  onSelectionComplete?: (selectedIds: string[]) => void
) => {
  const lassoPointsRef = useRef<[number, number][]>([]);
  const isDrawingRef = useRef(false);

  const setupLasso = useCallback(
    (map: maplibregl.Map) => {
      if (!map.getSource('lasso-source')) {
        map.addSource('lasso-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'lasso-fill',
          type: 'fill',
          source: 'lasso-source',
          paint: {
            'fill-color': '#4f46e5',
            'fill-opacity': 0.15,
          },
        });

        map.addLayer({
          id: 'lasso-stroke',
          type: 'line',
          source: 'lasso-source',
          paint: {
            'line-color': '#4f46e5',
            'line-width': 2.5,
            'line-dasharray': [2, 1],
          },
        });
      }

      const updateLassoSource = () => {
        const source = map.getSource('lasso-source') as maplibregl.GeoJSONSource;
        if (!source) return;

        if (lassoPointsRef.current.length < 2) {
          source.setData({ type: 'FeatureCollection', features: [] } as any);
          return;
        }

        const points = [...lassoPointsRef.current];
        const isPolygon = points.length > 2;

        if (isPolygon) {
          points.push(points[0]); // Close the shape
        }

        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: isPolygon ? 'Polygon' : 'LineString',
                coordinates: isPolygon ? [points] : points,
              },
              properties: {},
            },
          ],
        } as any);
      };

      const onMouseDown = (e: maplibregl.MapMouseEvent) => {
        if (!isSelecting) return;

        // Double check it's a left click
        if (e.originalEvent.button !== 0) return;

        isDrawingRef.current = true;
        lassoPointsRef.current = [[e.lngLat.lng, e.lngLat.lat]];
        map.dragPan.disable();
        updateLassoSource();
      };

      const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        if (!isDrawingRef.current) return;

        // Optimize: calculate distance from last point to avoid too many points
        const lastPoint = lassoPointsRef.current[lassoPointsRef.current.length - 1];
        const dist = Math.sqrt(
          Math.pow(e.lngLat.lng - lastPoint[0], 2) + Math.pow(e.lngLat.lat - lastPoint[1], 2)
        );

        if (dist > 0.0001) {
          // Threshold for adding points
          lassoPointsRef.current.push([e.lngLat.lng, e.lngLat.lat]);
          updateLassoSource();
        }
      };

      const onMouseUp = () => {
        if (!isDrawingRef.current) return;

        isDrawingRef.current = false;
        map.dragPan.enable();

        const polygon = lassoPointsRef.current;
        if (polygon.length > 2) {
          // Filter households within polygon
          const selectedIds: string[] = [];
          (householdsRef.current || []).forEach((h) => {
            if (h.location?.coordinates) {
              const point: [number, number] = [
                h.location.coordinates[0],
                h.location.coordinates[1],
              ];
              if (isPointInPolygon(point, polygon)) {
                selectedIds.push(h.id);
              }
            }
          });

          logger.log(`🎯 Lasso Selected ${selectedIds.length} households`);
          if (onSelectionComplete) {
            onSelectionComplete(selectedIds);
          }
        }

        // Reset visual
        lassoPointsRef.current = [];
        updateLassoSource();
      };

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);

      return () => {
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
      };
    },
    [isSelecting, householdsRef, onSelectionComplete]
  );

  return { setupLasso };
};
