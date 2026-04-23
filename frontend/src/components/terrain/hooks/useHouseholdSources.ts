 
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Hook: Household Sources Creation
 *
 * Creates all GeoJSON/vector sources needed for household visualization.
 * One-time creation per style with idempotent guards.
 *
 * @param map - MapLibre GL map instance
 * @param styleIsReady - Whether Zustand styleIsReady flag is true
 * @param projectId - Project ID for MVT tile URL (optional)
 * @returns setupCompleteRef - Ref indicating sources are ready
 */
export const useHouseholdSources = (
  map: maplibregl.Map | null,
  styleIsReady: boolean,
  projectId?: string
): React.MutableRefObject<boolean> => {
  const setupCompleteRef = useRef<boolean>(false);

  useEffect(() => {
    if (!map) return;

    // Only create sources once per style - verify sources don't already exist
    if (setupCompleteRef.current && map.getSource('households')) {
      console.log('✅ [useHouseholdSources] Sources already created, skipping');
      return;
    }

    const createSourcesNow = () => {
      // Double-check sources don't exist before creating
      if (setupCompleteRef.current && map.getSource('households')) {
        console.log('✅ [useHouseholdSources] Sources already exist, skipping');
        return;
      }

      console.log('🔵 [useHouseholdSources] Creating all sources...');

      try {
        // ── MVT Source
        if (!map.getSource('households-mvt')) {
          const apiUrl = import.meta.env.VITE_API_URL || '/api';
          const mvtBaseUrl = apiUrl.startsWith('http')
            ? apiUrl
            : `${window.location.origin}${apiUrl}`;
          const tilesUrl =
            projectId && projectId !== 'undefined'
              ? `${mvtBaseUrl}/geo/mvt/households/{z}/{x}/{y}?projectId=${projectId}&t=${Date.now()}`
              : `${mvtBaseUrl}/geo/mvt/households/{z}/{x}/{y}?projectId=none`;

          map.addSource('households-mvt', {
            type: 'vector',
            tiles: [tilesUrl],
            minzoom: 0,
            maxzoom: 14,
          });
          console.log('✅ Created source: households-mvt');
        }

        // ── GeoJSON Local Source
        if (!map.getSource('households')) {
          map.addSource('households', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          console.log('✅ Created source: households');
        }

        // ── Cluster Source
        if (!map.getSource('supercluster-generated')) {
          map.addSource('supercluster-generated', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          console.log('✅ Created source: supercluster-generated');
        }

        // ── Cluster Hull Source
        if (!map.getSource('cluster-hulls')) {
          map.addSource('cluster-hulls', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          console.log('✅ Created source: cluster-hulls');
        }

        // ── Selected Household Source
        if (!map.getSource('selected-household')) {
          map.addSource('selected-household', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          console.log('✅ Created source: selected-household');
        }

        console.log('✅ [useHouseholdSources] All sources created successfully');
        setupCompleteRef.current = true;
      } catch (err) {
        console.error('🔴 [useHouseholdSources] Failed to create sources:', err);
      }
    };

    // If style is already loaded, create immediately
    if (map.isStyleLoaded()) {
      console.log('✅ [useHouseholdSources] Style already loaded, creating sources now');
      createSourcesNow();
    } else {
      console.log('⏳ [useHouseholdSources] Waiting for style.load event...');

      // Otherwise, listen for style.load to create when ready
      map.on('style.load', createSourcesNow);

      return () => {
        map.off('style.load', createSourcesNow);
      };
    }
  }, [map, projectId]);

  return setupCompleteRef;
};
