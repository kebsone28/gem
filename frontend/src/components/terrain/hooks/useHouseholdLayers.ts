import { useCallback, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

const SAFE_TEXT_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];

/**
 * Hook: Household Layers Creation (Gold Standard Architecture)
 *
 * Implements a high-performance, field-ready layer hierarchy:
 * 1. Cluster Halo (Circle)
 * 2. Cluster Circle (Gradient)
 * 3. Cluster Count (Symbol)
 * 4. Point Halo (Circle - GPU accelerated)
 * 5. Point Icons (Symbol - Smart overlap + Fluid scaling)
 * 6. Selected Household (Priority Circle)
 * 7. Household Labels (Numeric)
 */
export const useHouseholdLayers = (
  map: maplibregl.Map | null,
  styleIsReady: boolean,
  sourcesReady: boolean,
  showZones: boolean = false
): void => {

  const buildLayers = useCallback(() => {
    if (!map || !styleIsReady || !sourcesReady || !map.isStyleLoaded()) return;

    logger.debug('📎 [useHouseholdLayers] Building Gold Standard layers...');

    try {
      if (!map.getSource('households') || !map.getSource('supercluster-generated')) {
        logger.debug('⚠️ [useHouseholdLayers] Core sources unavailable. Retrying later...');
        return;
      }

      const safeInsertLayer = (target: string) => (map.getLayer(target) ? target : undefined);
      const initialVisibility = 'visible';

      if (!map.getLayer('cluster-halo')) {
        map.addLayer({
          id: 'cluster-halo',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: { visibility: initialVisibility },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 10, 24, 100, 48],
            'circle-color': '#ffffff',
            'circle-opacity': 0.15,
            'circle-blur': 1,
          },
        });
      }

      if (!map.getLayer('cluster-circles')) {
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: { visibility: initialVisibility },
          paint: {
            'circle-color': [
              'step',
              ['to-number', ['coalesce', ['get', 'point_count'], 0]],
              '#00D084',
              20,
              '#FFD60A',
              50,
              '#FF9500',
              80,
              '#FF3B30',
            ],
            'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 10, 20, 100, 40],
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              10,
              0.75,
              100,
              0.95,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      if (!map.getLayer('cluster-counts')) {
        map.addLayer({
          id: 'cluster-counts',
          type: 'symbol',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: {
            'text-field': ['to-string', ['get', 'point_count']],
            'text-font': SAFE_TEXT_FONT,
            'text-size': 14,
            'text-allow-overlap': true,
            visibility: initialVisibility,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.5)',
            'text-halo-width': 1,
          },
        });
      }

      if (map.getSource('cluster-hulls')) {
        if (!map.getLayer('supercluster-hulls-fill')) {
          map.addLayer(
            {
              id: 'supercluster-hulls-fill',
              type: 'fill',
              source: 'cluster-hulls',
              layout: { visibility: 'none' },
              paint: {
                'fill-color': '#ffffff',
                'fill-opacity': 0.15,
              },
            },
            safeInsertLayer('cluster-halo')
          );
        }

        if (!map.getLayer('supercluster-hulls-outline')) {
          map.addLayer(
            {
              id: 'supercluster-hulls-outline',
              type: 'line',
              source: 'cluster-hulls',
              layout: { visibility: 'none' },
              paint: {
                'line-color': '#ffffff',
                'line-width': 2,
                'line-dasharray': [2, 2],
                'line-opacity': 0.6,
              },
            },
            safeInsertLayer('cluster-halo')
          );
        }
      }

      if (!map.getLayer('households-glow-layer')) {
        map.addLayer({
          id: 'households-glow-layer',
          type: 'circle',
          source: 'households',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 8, 3, 14, 5, 18, 8],
            'circle-color': [
              'match',
              ['coalesce', ['get', 'status'], 'default'],
              'Contrôle conforme',
              '#00FF9D',
              'Non conforme',
              '#FF0055',
              'Intérieur terminé',
              '#6366F1',
              'Réseau terminé',
              '#00D2FF',
              'Murs terminés',
              '#FFD60A',
              'Livraison effectuée',
              '#059669',
              'Non éligible',
              '#64748B',
              'Désistement',
              '#64748B',
              'Refusé',
              '#F43F5E',
              'Eligible',
              '#3B82F6',
              'En attente',
              '#64748B',
              '#6366F1',
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.4)',
          },
        });
      }

      if (!map.getLayer('households-local-layer')) {
        map.addLayer({
          id: 'households-local-layer',
          type: 'symbol',
          source: 'households',
          layout: {
            'icon-image': [
              'step',
              ['zoom'],
              ['concat', 'icon-', ['coalesce', ['get', 'status'], 'default'], '-small'],
              14.5,
              [
                'case',
                ['==', ['get', 'status'], 'Non conforme'],
                'pulsing-Non conforme',
                ['concat', 'icon-', ['coalesce', ['get', 'status'], 'default'], '-large'],
              ],
            ],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 13, 0.65, 15, 0.9, 18, 1.1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-optional': true,
            'symbol-sort-key': [
              'case',
              ['==', ['get', 'status'], 'Non conforme'],
              100,
              ['==', ['get', 'status'], 'Contrôle conforme'],
              80,
              10,
            ],
            'symbol-z-order': 'viewport-y',
          },
          paint: {
            'icon-opacity': 1,
          },
        });
      }

      if (!map.getLayer('households-photo-badge')) {
        map.addLayer({
          id: 'households-photo-badge',
          type: 'symbol',
          source: 'households',
          filter: ['==', ['get', 'hasPhotos'], true],
          layout: {
            'icon-image': 'photo-indicator',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.25, 15, 0.35, 18, 0.5],
            'icon-offset': [14, -14],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility: 'visible',
          },
          paint: {
            'icon-opacity': ['step', ['zoom'], 0, 14, 1],
          },
        });
      }

      if (map.getSource('selected-household') && !map.getLayer('selected-household-layer')) {
        map.addLayer({
          id: 'selected-household-layer',
          type: 'circle',
          source: 'selected-household',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 15, 24, 18, 32],
            'circle-color': 'transparent',
            'circle-stroke-color': '#3b82f6',
            'circle-stroke-width': 3,
            'circle-opacity': 1,
          },
        });
      }

      if (!map.getLayer('heatmap')) {
        map.addLayer(
          {
            id: 'heatmap',
            type: 'heatmap',
            source: 'households',
            maxzoom: 17,
            paint: {
              'heatmap-weight': 1,
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 8],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(67,56,202,0)',
                0.2,
                'rgba(79,70,229,0.3)',
                0.4,
                'rgba(59,130,246,0.6)',
                0.6,
                'rgba(16,185,129,0.8)',
                0.8,
                'rgba(245,158,11,0.9)',
                1,
                'rgba(239,68,68,1)',
              ],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 45],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 20, 0.4],
            },
          },
          safeInsertLayer('cluster-halo')
        );
      }

      if (!map.getLayer('households-labels-simple')) {
        map.addLayer({
          id: 'households-labels-simple',
          type: 'symbol',
          source: 'households',
          layout: {
            'text-field': ['coalesce', ['get', 'numeroordre'], ''],
            'text-font': SAFE_TEXT_FONT,
            'text-size': 11,
            'text-variable-anchor': ['top'],
            'text-radial-offset': 1.8,
            visibility: 'visible',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1.5,
            'text-opacity': ['step', ['zoom'], 0, 15, 1],
          },
        });
      }

      logger.debug('✅ [useHouseholdLayers] Gold Standard hierarchy complete');
    } catch (err) {
      logger.error('🔴 [useHouseholdLayers] Layer construction failed:', err);
    }
  }, [map, sourcesReady, styleIsReady]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!sourcesReady) return;

    buildLayers();

    // Re-build layers after any style reload (style switch wipes all custom layers)
    const handleStyleData = () => {
      if (!map.isStyleLoaded()) return;
      // If our primary layer is gone, rebuild all layers
      if (!map.getLayer('households-glow-layer')) {
        logger.debug('[useHouseholdLayers] Layers wiped — rebuilding after style reload...');
        buildLayers();
      }
    };

    map.on('styledata', handleStyleData);
    return () => {
      if (!(map as any)._removed) map.off('styledata', handleStyleData);
    };
  }, [buildLayers, map, showZones, sourcesReady, styleIsReady]);
};
