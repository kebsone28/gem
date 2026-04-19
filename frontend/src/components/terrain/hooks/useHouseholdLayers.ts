import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { STATUS_CONFIG } from '../mapConfig';

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
  setupCompleteRef: MutableRefObject<boolean>,
  showZones: boolean = false
): void => {
  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!setupCompleteRef.current) return;

    console.log('💎 [useHouseholdLayers] Building Gold Standard layers...');

    try {
      const initialVisibility = showZones ? 'none' : 'visible';

      // ── 1. CLUSTER HALO (Thin subtle aura)
      if (!map.getLayer('cluster-halo')) {
        map.addLayer({
          id: 'cluster-halo',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: { visibility: initialVisibility },
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              10, 24,
              100, 48
            ],
            'circle-color': '#ffffff',
            'circle-opacity': 0.15,
            'circle-blur': 1,
          },
        });
      }

      // ── 2. CLUSTER CIRCLES (Vibrant Gradients style)
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
              '#00D084', // 0-20 points: Emerald
              20, '#FFD60A', // 20-50: Gold
              50, '#FF9500', // 50-80: Orange
              80, '#FF3B30'  // 80+: Red Pop
            ],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              10, 20,
              100, 40
            ],
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              10, 0.75,
              100, 0.95
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      // ── 3. CLUSTER COUNTS (Sharp Typography)
      if (!map.getLayer('cluster-counts')) {
        map.addLayer({
          id: 'cluster-counts',
          type: 'symbol',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: {
            'text-field': ['to-string', ['get', 'point_count']],
            'text-font': ['Open Sans Bold', 'Inter Bold'],
            'text-size': 14,
            'text-allow-overlap': true,
            'visibility': initialVisibility
          },
          paint: { 
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.5)',
            'text-halo-width': 1,
          },
        });
      }

      // ── 3b. PROXIMITY HULLS (The "Trapezoidal" encirclement for GPS proximity)
      if (!map.getLayer('supercluster-hulls-fill')) {
        map.addLayer({
          id: 'supercluster-hulls-fill',
          type: 'fill',
          source: 'cluster-hulls', // Needs to be populated by useMapClustering
          layout: { visibility: 'none' }, // Visible only in Zone mode
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.15,
          },
        }, 'cluster-halo');
      }

      if (!map.getLayer('supercluster-hulls-outline')) {
        map.addLayer({
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
        }, 'cluster-halo');
      }

      // ── 4. POINT FALLBACK CIRCLES (Always visible, always interactive)
      // This layer renders for ALL households regardless of icon registration state
      if (!map.getLayer('households-glow-layer')) {
        map.addLayer({
          id: 'households-glow-layer',
          type: 'circle',
          source: 'households',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              4, 2,
              8, 3,
              14, 5,
              18, 8
            ],
            'circle-color': [
              'match',
              ['coalesce', ['get', 'status'], 'default'],
              'Contrôle conforme', '#00FF9D',
              'Non conforme', '#FF0055',
              'Intérieur terminé', '#6366F1',
              'Réseau terminé', '#00D2FF',
              'Murs terminés', '#FFD60A',
              'Livraison effectuée', '#059669',
              'Non éligible', '#64748B',
              'Désistement', '#64748B',
              'Refusé', '#F43F5E',
              'Eligible', '#3B82F6',
              'En attente', '#64748B',
              '#6366F1' // default: indigo
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.4)',
          },
        });
      }


      // ── 5. POINT ICONS (The Heart of the system)
      if (!map.getLayer('households-local-layer')) {
        map.addLayer({
          id: 'households-local-layer',
          type: 'symbol',
          source: 'households',
          layout: {
            'icon-image': [
              'step',
              ['zoom'],
              ['concat', 'icon-', ['get', 'status'], '-small'], 
              14.5,
              [
                'case',
                ['==', ['get', 'status'], 'Non conforme'], 'pulsing-Non conforme',
                ['concat', 'icon-', ['get', 'status'], '-large']
              ]
            ],
            'icon-size': [
              'interpolate',
              ['linear'], ['zoom'],
              0, 0.35,
              13, 0.65,
              15, 0.9,
              18, 1.1
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-optional': true,
            'symbol-sort-key': [
              'case',
              ['==', ['get', 'status'], 'Non conforme'], 100,
              ['==', ['get', 'status'], 'Contrôle conforme'], 80,
              10
            ],
            'symbol-z-order': 'viewport-y'
          },
          paint: {
            'icon-opacity': 1
          }
        });
      }

      // ── 5b. PHOTO MONITORING BADGES (Subtle overlay for documented sites)
      if (!map.getLayer('households-photo-badge')) {
        map.addLayer({
          id: 'households-photo-badge',
          type: 'symbol',
          source: 'households',
          filter: ['==', ['get', 'hasPhotos'], true],
          layout: {
            'icon-image': 'photo-indicator',
            'icon-size': [
              'interpolate',
              ['linear'], ['zoom'],
              13, 0.25,
              15, 0.35,
              18, 0.5
            ],
            'icon-offset': [14, -14],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'visibility': 'visible'
          },
          paint: {
            'icon-opacity': ['step', ['zoom'], 0, 14, 1]
          }
        });
      }

      // ── 6. SELECTED HOUSEHOLD (GPS Focus state)
      if (!map.getLayer('selected-household-layer')) {
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
            // Infinite slight pulse logic would go here if we used a direct animation, 
            // but for now a static high-contrast blue focus is baseline.
          },
        });
      }

      // ── 7. HEATMAP LAYER (Density visualization)
      if (!map.getLayer('heatmap')) {
        map.addLayer({
          id: 'heatmap',
          type: 'heatmap',
          source: 'households',
          maxzoom: 17,
          paint: {
            // Increase the heatmap weight based on frequency and property magnitude
            'heatmap-weight': 1,
            // Increase the heatmap color weight by zoom level
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 8], // Boost intensity
            // Color ramp for heatmap.
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(67,56,202,0)',    // Transparent Indigo
              0.2, 'rgba(79,70,229,0.3)', // Indigo
              0.4, 'rgba(59,130,246,0.6)', // Blue
              0.6, 'rgba(16,185,129,0.8)', // Emerald
              0.8, 'rgba(245,158,11,0.9)', // Amber
              1, 'rgba(239,68,68,1)'       // Red
            ],
            // Adjust the heatmap radius by zoom level
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 45], // Larger radius
            // Visibility transition
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 20, 0.4], // More persistent
          },
        }, 'cluster-halo'); // Place below clusters
      }

      // ── 8. HOUSEHOLD LABELS (Numeric)
      if (!map.getLayer('households-labels-simple')) {
        map.addLayer({
          id: 'households-labels-simple',
          type: 'symbol',
          source: 'households',
          layout: {
            'text-field': ['coalesce', ['get', 'numeroordre'], ''],
            'text-font': ['Open Sans Bold', 'Inter Bold'],
            'text-size': 11,
            'text-variable-anchor': ['top'],
            'text-radial-offset': 1.8,
            'visibility': 'visible',
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1.5,
            'text-opacity': ['step', ['zoom'], 0, 15, 1], // Only at deep zoom
          },
        });
      }

      console.log('✅ [useHouseholdLayers] Gold Standard hierarchy complete');
    } catch (err) {
      console.error('🔴 [useHouseholdLayers] Layer construction failed:', err);
    }
  }, [map, styleIsReady, setupCompleteRef]);
};
