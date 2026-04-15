import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Hook: Household Layers Creation
 *
 * Creates all map layers for households visualization (heatmap, clusters, markers, labels).
 * Waits for sources to be ready first (setupCompleteRef guard).
 *
 * @param map - MapLibre GL map instance
 * @param styleIsReady - Whether Zustand styleIsReady flag is true
 * @param setupCompleteRef - Ref to track when sources are ready
 */
export const useHouseholdLayers = (
  map: maplibregl.Map | null,
  styleIsReady: boolean,
  setupCompleteRef: MutableRefObject<boolean>
): void => {
  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!setupCompleteRef.current) return; // Wait for sources first

    console.log('🔵 [useHouseholdLayers] Creating all layers...');

    try {
      // ── HEATMAP LAYER
      if (!map.getLayer('heatmap')) {
        map.addLayer({
          id: 'heatmap',
          type: 'heatmap',
          source: 'households',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 15, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(33,102,172,0)',
              0.2,
              'rgb(103,169,207)',
              0.4,
              'rgb(209,229,240)',
              0.6,
              'rgb(253,219,199)',
              0.8,
              'rgb(239,138,98)',
              1,
              'rgb(178,24,43)',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 20],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 1, 16, 0],
          },
        });
        console.log('✅ Created layer: heatmap');
      }

      // ── CLUSTER HULLS
      if (!map.getLayer('cluster-hulls')) {
        map.addLayer({
          id: 'cluster-hulls',
          type: 'fill',
          source: 'cluster-hulls',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.15,
            'fill-outline-color': '#10b981',
          },
        });
        console.log('✅ Created layer: cluster-hulls');
      }

      // ── CLUSTER CIRCLES
      if (!map.getLayer('cluster-circles')) {
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: { visibility: 'none' },
          paint: {
            'circle-color': [
              'step',
              ['to-number', ['coalesce', ['get', 'point_count'], 0]],
              '#10b981', // 0-20 points: Vert (Low)
              20, '#fbbf24', // 20-50: Jaune (Medium)
              50, '#f59e0b', // 50-80: Orange (High)
              80, '#f43f5e'  // 80+: Rose (Very High)
            ],
            'circle-radius': [
              'step',
              ['to-number', ['coalesce', ['get', 'point_count'], 0]],
              15, 20, 20, 50, 25, 100, 30
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
        console.log('✅ Created layer: cluster-circles');
      }

      // ── RED CIRCLE FALLBACK (Distrubution View)
      if (!map.getLayer('households-circles-simple')) {
        map.addLayer({
          id: 'households-circles-simple',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 1.5,   // Point minuscule (pixel)
              8, 3,     // Point visible
              15, 6     // Point large avant passage aux icônes
            ],
            'circle-color': '#10b981', // Émeraude PROQUELEC
            'circle-opacity': 0.8,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 14, 1.5],
            'circle-blur': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 0],
          },
          layout: { visibility: 'visible' },
        });
        console.log('✅ Created layer: households-circles-simple');
      }

      // ── HOUSEHOLD LABELS
      if (!map.getLayer('households-labels-simple')) {
        map.addLayer({
          id: 'households-labels-simple',
          type: 'symbol',
          source: 'supercluster-generated',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['coalesce', ['get', 'numeroordre'], ['get', 'name'], 'HH'],
            'text-font': ['Open Sans Bold', 'Inter Bold'],
            'text-size': 12,
            'text-variable-anchor': ['bottom', 'top', 'right', 'left'],
            'text-radial-offset': 1.2,
            'text-justify': 'auto',
            'text-optional': true,
            'text-allow-overlap': false,
            visibility: 'visible',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
          },
        });
        console.log('✅ Created layer: households-labels-simple');
      }

      // ── CLUSTER COUNTS
      if (!map.getLayer('cluster-counts')) {
        map.addLayer({
          id: 'cluster-counts',
          type: 'symbol',
          source: 'supercluster-generated',
          filter: ['==', ['get', 'cluster'], true],
          layout: {
            'text-field': [
              'to-string',
              ['coalesce', ['get', 'point_count_abbreviated'], ['get', 'point_count'], 0],
            ],
            'text-font': ['Open Sans Bold', 'Inter Bold'],
            'text-size': 14,
            visibility: 'none',
          },
          paint: { 'text-color': '#ffffff' },
        });
        console.log('✅ Created layer: cluster-counts');
      }

      // ── GLOW LAYER (SCINTILLANTE)
      if (!map.getLayer('households-glow-layer')) {
        map.addLayer({
          id: 'households-glow-layer',
          type: 'circle',
          source: 'supercluster-generated',
          filter: ['!', ['has', 'point_count']], // Uniquement sur les points individuels pour l'instant
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 18, 25],
            'circle-color': [
              'match',
              ['coalesce', ['get', 'status'], 'default'],
              'Contrôle conforme', '#10b981',
              'Non conforme', '#f43f5e',
              'Intérieur terminé', '#6366f1',
              'Réseau terminé', '#3b82f6',
              'Murs terminés', '#f59e0b',
              'Livraison effectuée', '#06b6d4',
              'Non encore commencé', '#64748b',
              'Non éligible', '#f43f5e',
              'Désistement', '#64748b',
              '#ffffff'
            ],
            'circle-opacity': 0.3,
            'circle-blur': 0.8,
          },
        });
        console.log('✅ Created layer: households-glow-layer');
      }

      // ── LOCAL LAYER (Household markers)
      if (!map.getLayer('households-local-layer')) {
        map.addLayer({
          id: 'households-local-layer',
          type: 'symbol',
          source: 'supercluster-generated',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': [
              'match',
              ['coalesce', ['get', 'status'], 'default'],
              'Contrôle conforme', 'icon-Contrôle conforme',
              'Non conforme', 'icon-Non conforme',
              'Intérieur terminé', 'icon-Intérieur terminé',
              'Réseau terminé', 'icon-Réseau terminé',
              'Murs terminés', 'icon-Murs terminés',
              'Livraison effectuée', 'icon-Livraison effectuée',
              'Non encore commencé', 'icon-Non encore commencé',
              'Non éligible', 'icon-Non conforme',
              'Désistement', 'icon-Non conforme',
              'icon-default',
            ],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3,
              0.12,
              6,
              0.25,
              10,
              0.45,
              14,
              0.65,
              18,
              1,
            ],
            'icon-allow-overlap': true,
            'text-field': [
              'to-string',
              ['coalesce', ['get', 'numeroordre'], ['get', 'household_id'], ''],
            ],
            'text-font': ['Open Sans Bold', 'Inter Bold'],
            'text-size': 11,
            'text-variable-anchor': ['bottom', 'top', 'right', 'left'],
            'text-radial-offset': 1.5,
            'text-justify': 'auto',
            'text-optional': true,
            'text-allow-overlap': false,
            // 'icon-allow-overlap: true' allows circles to group, while text avoids them!
            visibility: 'none',
          },
          paint: {
            'icon-opacity': 1.0,
            'icon-halo-color': 'rgba(255,255,255,0.5)',
            'icon-halo-width': 1,
            'text-color': '#ffffff',
            'text-halo-color': '#0f172a',
            'text-halo-width': 2.5,
            'text-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 16, 1],
          },
        });
        console.log('✅ Created layer: households-local-layer');
      }

      // ── SELECTED HOUSEHOLD
      if (!map.getLayer('selected-household-layer')) {
        map.addLayer({
          id: 'selected-household-layer',
          type: 'circle',
          source: 'selected-household',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 18, 18, 26],
            'circle-color': '#f59e0b',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 4,
            'circle-opacity': 0.95,
          },
        });
        console.log('✅ Created layer: selected-household-layer');
      }

      console.log('✅ [useHouseholdLayers] All layers created successfully');
    } catch (err) {
      console.error('🔴 [useHouseholdLayers] Failed to create layers:', err);
    }
  }, [map, styleIsReady, setupCompleteRef]);
};
