 
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

/**
 * Hook: Household Sources Creation
 *
 * Creates all GeoJSON/vector sources needed for household visualization.
 * Re-creates them on every style reload.
 * Returns sourcesReady=true once all sources exist on the map.
 */
export const useHouseholdSources = (
  map: maplibregl.Map | null,
  styleIsReady: boolean,
  projectId?: string
): boolean => {
  const [sourcesReady, setSourcesReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!map || !styleIsReady) {
      setSourcesReady(false);
      return;
    }

    const createSources = () => {
      if (!map || (map as any)._removed || !map.isStyleLoaded()) return;

      try {
        // ── MVT Source (vector tiles for background rendering) ──
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
        }

        // ── GeoJSON Local Source (primary point rendering) ──
        if (!map.getSource('households')) {
          map.addSource('households', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // ── Supercluster GeoJSON Source ──
        if (!map.getSource('supercluster-generated')) {
          map.addSource('supercluster-generated', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // ── Cluster Hull Source ──
        if (!map.getSource('cluster-hulls')) {
          map.addSource('cluster-hulls', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // ── Selected Household Source ──
        if (!map.getSource('selected-household')) {
          map.addSource('selected-household', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        logger.debug('✅ [useHouseholdSources] All sources created');
        setSourcesReady(true);
      } catch (err) {
        logger.error('🔴 [useHouseholdSources] Failed to create sources:', err);
        setSourcesReady(false);
      }
    };

    // Create immediately if style is loaded
    if (map.isStyleLoaded()) {
      createSources();
    } else {
      // Wait for style.load then create
      map.once('style.load', createSources);
    }

    // Re-create on every subsequent style reload (style switch wipes all sources)
    const handleStyleData = () => {
      if (!map.isStyleLoaded()) return;
      // Check if our primary source was wiped
      if (!map.getSource('households')) {
        logger.debug('[useHouseholdSources] Sources wiped by style reload — recreating...');
        setSourcesReady(false);
        // Small delay to let MapLibre finish its internal style setup
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(createSources, 50);
      }
    };

    map.on('styledata', handleStyleData);

    return () => {
      if (!(map as any)._removed) {
        map.off('style.load', createSources);
        map.off('styledata', handleStyleData);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      setSourcesReady(false);
    };
  }, [map, styleIsReady, projectId]);

  return sourcesReady;
};
