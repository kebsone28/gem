 
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

/**
 * Hook: Household Sources Creation
 *
 * Creates all GeoJSON/vector sources needed for household visualization.
 * One-time creation per style with idempotent guards.
 *
 * @param map - MapLibre GL map instance
 * @param styleIsReady - Whether Zustand styleIsReady flag is true
 * @param projectId - Project ID for MVT tile URL (optional)
 * @returns sourcesReady - Whether household sources are ready for layer setup
 */
export const useHouseholdSources = (
  map: maplibregl.Map | null,
  styleIsReady: boolean,
  projectId?: string
): boolean => {
  const setupCompleteRef = useRef<boolean>(false);
  const [sourcesReady, setSourcesReady] = useState(false);
  const publishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishSourcesReady = (ready: boolean) => {
    if (publishTimeoutRef.current) {
      clearTimeout(publishTimeoutRef.current);
    }

    publishTimeoutRef.current = setTimeout(() => {
      setSourcesReady(ready);
      publishTimeoutRef.current = null;
    }, 0);
  };

  useEffect(() => {
    if (!map || !styleIsReady || !map.isStyleLoaded()) {
      setupCompleteRef.current = false;
      publishSourcesReady(false);
      return;
    }

    // Only create sources once per style - verify sources don't already exist
    if (setupCompleteRef.current && map.getSource('households')) {
      logger.debug('✅ [useHouseholdSources] Sources already created, skipping');
      publishSourcesReady(true);
      return;
    }

    const createSourcesNow = () => {
      // Double-check sources don't exist before creating
      if (setupCompleteRef.current && map.getSource('households')) {
        logger.debug('✅ [useHouseholdSources] Sources already exist, skipping');
        publishSourcesReady(true);
        return;
      }

      logger.debug('🔵 [useHouseholdSources] Creating all sources...');

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
          logger.debug('✅ Created source: households-mvt');
        }

        // ── GeoJSON Local Source
        if (!map.getSource('households')) {
          map.addSource('households', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          logger.debug('✅ Created source: households');
        }

        // ── Cluster Source
        if (!map.getSource('supercluster-generated')) {
          map.addSource('supercluster-generated', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          logger.debug('✅ Created source: supercluster-generated');
        }

        // ── Cluster Hull Source
        if (!map.getSource('cluster-hulls')) {
          map.addSource('cluster-hulls', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          logger.debug('✅ Created source: cluster-hulls');
        }

        // ── Selected Household Source
        if (!map.getSource('selected-household')) {
          map.addSource('selected-household', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          logger.debug('✅ Created source: selected-household');
        }

        logger.debug('✅ [useHouseholdSources] All sources created successfully');
        setupCompleteRef.current = true;
        publishSourcesReady(true);
      } catch (err) {
        setupCompleteRef.current = false;
        publishSourcesReady(false);
        logger.error('🔴 [useHouseholdSources] Failed to create sources:', err);
      }
    };

    logger.debug('✅ [useHouseholdSources] Style already loaded, creating sources now');
    createSourcesNow();
  }, [map, styleIsReady, projectId]);

  useEffect(() => {
    return () => {
      if (publishTimeoutRef.current) {
        clearTimeout(publishTimeoutRef.current);
      }
    };
  }, []);

  return sourcesReady;
};
