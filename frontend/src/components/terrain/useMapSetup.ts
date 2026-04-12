/**
 * useMapSetup.ts
 *
 * Hook pour initialiser la map et setup des layers
 * - Crée les sources GeoJSON
 * - Ajoute tous les layers
 * - Charge les images d'icônes
 */

import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { loadMapImages } from './mapUtils';
import { senegalRegions } from '../../data/senegal-regions';

export const useMapSetup = () => {
  const setupLayersLock = useRef(false);

  const setupLayers = useCallback(
    async (
      map: maplibregl.Map,
      householdGeoJSON: any,
      grappesGeoJSON: any,
      sousGrappesGeoJSON: any,
      favoritesGeoJSON: any,
      grappeZonesData: any,
      grappeCentroidsData: any,
      onSetStyleReady: () => void
    ) => {
      if (!map || setupLayersLock.current) return;

      try {
        setupLayersLock.current = true;
        await loadMapImages(map);

        if (map.getSource('households')) {
          onSetStyleReady();
          return;
        }

        // ── SOURCES ──
        map.addSource('households', {
          type: 'geojson',
          data: householdGeoJSON as any,
          cluster: false,
        });

        if (!map.getSource('grappes')) {
          map.addSource('grappes', { type: 'geojson', data: grappesGeoJSON as any });
        }
        if (!map.getSource('sous-grappes')) {
          map.addSource('sous-grappes', { type: 'geojson', data: sousGrappesGeoJSON as any });
        }

        if (!map.getSource('auto-grappes')) {
          map.addSource('auto-grappes', {
            type: 'geojson',
            data: grappeZonesData || { type: 'FeatureCollection', features: [] },
          });
        }

        if (!map.getSource('auto-grappes-centroids')) {
          map.addSource('auto-grappes-centroids', {
            type: 'geojson',
            data: grappeCentroidsData || { type: 'FeatureCollection', features: [] },
          });
        }

        if (!map.getSource('favorites-source')) {
          map.addSource('favorites-source', {
            type: 'geojson',
            data: favoritesGeoJSON as any,
          });
        }

        if (!map.getSource('supercluster-generated')) {
          map.addSource('supercluster-generated', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        if (!map.getSource('route-source')) {
          map.addSource('route-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        if (!map.getSource('senegal-regions')) {
          map.addSource('senegal-regions', {
            type: 'geojson',
            data: senegalRegions as any,
          });
        }

        // ── LAYERS ──
        // Favorites
        map.addLayer({
          id: 'favorites-layer',
          type: 'circle',
          source: 'favorites-source',
          paint: {
            'circle-radius': 8,
            'circle-color': '#fbbf24',
            'circle-opacity': 0.4,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fbbf24',
          },
        });

        map.addLayer({
          id: 'favorites-outline',
          type: 'circle',
          source: 'favorites-source',
          paint: {
            'circle-radius': 12,
            'circle-color': 'transparent',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fbbf24',
            'circle-stroke-opacity': 0.5,
          },
        });

        // Routes
        map.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });

        if (!map.getLayer('route-highlight-layer')) {
          map.addLayer(
            {
              id: 'route-highlight-layer',
              type: 'line',
              source: 'route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#fbbf24',
                'line-width': 7,
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 0.9],
              },
            },
            'route-layer'
          );
        }

        // Régions Sénégal
        map.addLayer({
          id: 'senegal-regions-fill',
          type: 'fill',
          source: 'senegal-regions',
          paint: {
            'fill-color': '#cbd5e1',
            'fill-opacity': 0.05,
          },
        });

        map.addLayer({
          id: 'senegal-regions-outline',
          type: 'line',
          source: 'senegal-regions',
          paint: {
            'line-color': '#64748b',
            'line-width': 1.5,
            'line-opacity': 0.4,
            'line-dasharray': [2, 2],
          },
        });

        map.addLayer({
          id: 'senegal-regions-label',
          type: 'symbol',
          source: 'senegal-regions',
          layout: {
            'text-field': ['coalesce', ['get', 'REGION'], ''],
            'text-size': 12,
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#475569',
            'text-opacity': 0.6,
          },
        });

        // Auto-Grappes
        map.addLayer({
          id: 'auto-grappes-fill',
          type: 'fill',
          source: 'auto-grappes',
          layout: { visibility: 'visible' },
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'type'], 'dense'],
              '#10b981',
              ['==', ['get', 'type'], 'kmeans'],
              '#f59e0b',
              '#3b82f6',
            ],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.5, 0.15],
          },
        });

        map.addLayer({
          id: 'auto-grappes-outline',
          type: 'line',
          source: 'auto-grappes',
          layout: { visibility: 'visible' },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'type'], 'dense'],
              '#059669',
              ['==', ['get', 'type'], 'kmeans'],
              '#d97706',
              '#2563eb',
            ],
            'line-width': 2.5,
            'line-opacity': 0.8,
          },
        });

        if (map.getSource('auto-grappes-centroids')) {
          map.addLayer({
            id: 'auto-grappes-labels',
            type: 'symbol',
            source: 'auto-grappes-centroids',
            layout: {
              visibility: 'visible',
              'text-field': [
                'concat',
                ['coalesce', ['get', 'name'], ''],
                '\n',
                ['to-string', ['to-number', ['get', 'count'], 0]],
                ' pts',
              ],
              'text-size': 12,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#1e293b',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });
        }

        // Grappes anciennes (masquées)
        map.addLayer({
          id: 'grappes-layer',
          type: 'circle',
          source: 'grappes',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 25,
            'circle-color': '#4f46e5',
            'circle-opacity': 0.2,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#4f46e5',
          },
        });

        map.addLayer({
          id: 'grappes-labels',
          type: 'symbol',
          source: 'grappes',
          layout: {
            visibility: 'none',
            'text-field': ['get', 'nom'],
            'text-size': 10,
            'text-offset': [0, 3],
            'text-anchor': 'top',
          },
          paint: { 'text-color': '#4f46e5', 'text-halo-color': '#fff', 'text-halo-width': 1 },
        });

        // Sous-Grappes (masquées)
        map.addLayer({
          id: 'sous-grappes-layer',
          type: 'circle',
          source: 'sous-grappes',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 12,
            'circle-color': '#10b981',
            'circle-opacity': 0.3,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#10b981',
          },
        });

        // Heatmap
        map.addLayer({
          id: 'heatmap',
          type: 'heatmap',
          source: 'households',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 15, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 15, 3],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 15, 30],
            'heatmap-opacity': 0.7,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(0,0,0,0)',
              0.1,
              '#4f46e5',
              0.3,
              '#7c3aed',
              0.5,
              '#ef4444',
              0.8,
              '#f97316',
              1,
              '#fbbf24',
            ],
          },
        });

        // Points
        map.addLayer({
          id: 'unclustered-points',
          type: 'symbol',
          source: 'households',
          minzoom: 0,
          maxzoom: 12,
          layout: {
            'icon-image': ['get', 'iconId'],
            'icon-size': 0.6,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // Clusters
        if (!map.getLayer('cluster-circles')) {
          map.addLayer({
            id: 'cluster-circles',
            type: 'circle',
            source: 'supercluster-generated',
            minzoom: 0,
            maxzoom: 12,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#3b82f6',
              'circle-radius': ['step', ['get', 'point_count'], 15, 5, 20, 10, 25, 50, 30],
              'circle-stroke-width': 3,
              'circle-stroke-color': '#1e40af',
              'circle-opacity': 0.8,
            },
          });
        }

        if (!map.getLayer('cluster-counts')) {
          map.addLayer({
            id: 'cluster-counts',
            type: 'symbol',
            source: 'supercluster-generated',
            minzoom: 0,
            maxzoom: 12,
            filter: ['has', 'point_count'],
            layout: {
              'text-field': '{point_count_abbreviated}',
              'text-size': 12,
            },
            paint: { 'text-color': '#ffffff' },
          });
        }

        // Drag point temp
        if (!map.getSource('drag-point')) {
          map.addSource('drag-point', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        map.addLayer({
          id: 'drag-point-layer',
          type: 'circle',
          source: 'drag-point',
          paint: {
            'circle-radius': 7,
            'circle-color': '#f59e0b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        onSetStyleReady();
      } finally {
        setupLayersLock.current = false;
      }
    },
    []
  );

  return { setupLayers };
};
