/**
 * useMapClustering.ts
 *
 * Hook ultra-performant pour gérer les clusters sur MapLibre
 * - Mise à jour sur zoom + pan (moveend + zoomend)
 * - Débounce via requestAnimationFrame
 * - Cache pour éviter recalculs inutiles
 * - Anti-flicker et sécurité sur sources
 */

import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { getClustersForZoom } from '../../utils/clusteringUtils';
import logger from '../../utils/logger';
import convex from '@turf/convex';
import { featureCollection, point } from '@turf/helpers';

export const useMapClustering = (clustererRef: React.MutableRefObject<Supercluster | null>) => {
  const clusterUpdateTimeoutRef = useRef<number | null>(null);
  const lastHoveredClusterId = useRef<number | string | null>(null);

  // Cache zoom + bbox pour éviter recalcul inutile
  const lastZoomRef = useRef<number | null>(null);
  const lastBBoxRef = useRef<[number, number, number, number] | null>(null);

  // ✅ THROTTLE: Minimum time between cluster updates (in ms)
  const THROTTLE_MS = 100;
  const lastUpdateTimeRef = useRef<number>(0);

  /**
   * Met à jour les clusters pour la vue actuelle
   */
  const updateClusterDisplay = useCallback(
    (map: maplibregl.Map, force = false) => {
      // DEFENSIVE: Verify map is still initialized and has a style object
      if (!map || !(map as any).style || !map.isStyleLoaded() || !clustererRef.current) return;

      // ✅ THROTTLE: Enforce minimum time between updates (unless forced)
      const now = Date.now();
      if (!force && now - lastUpdateTimeRef.current < THROTTLE_MS) {
        return; // Skip this update, still in throttle window
      }

      const zoom = Math.round(map.getZoom());
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      // Skip si zoom + bbox inchangés (sauf si force)
      const lastBBox = lastBBoxRef.current;
      if (
        !force &&
        lastZoomRef.current === zoom &&
        lastBBox?.[0] === bbox[0] &&
        lastBBox?.[1] === bbox[1] &&
        lastBBox?.[2] === bbox[2] &&
        lastBBox?.[3] === bbox[3]
      ) {
        return;
      }

      try {
        const clusters = getClustersForZoom(clustererRef.current, bbox, zoom);
        const clustersGeoJSON = {
          type: 'FeatureCollection',
          features: clusters,
        };

        // Calcule les limites territoriales (Convexe) de TOUTES les grappes
        const hullFeatures: any[] = [];
        clusters.forEach((c) => {
          if (c.properties?.cluster) {
            const leaves = clustererRef.current?.getLeaves(c.properties.cluster_id, Infinity);
            if (leaves && leaves.length >= 3) {
              const points = featureCollection(leaves.map((l) => point(l.geometry.coordinates)));
              const hull = convex(points);
              if (hull) hullFeatures.push(hull);
            }
          }
        });
        const hullsGeoJSON = {
          type: 'FeatureCollection',
          features: hullFeatures,
        };

        let source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;

        // ✅ Create source if it doesn't exist yet (race condition protection)
        if (!source) {
          try {
            map.addSource('supercluster-generated', {
              type: 'geojson',
              data: clustersGeoJSON as any,
            });
            logger.debug('🔶 Created supercluster-generated source dynamically');
            source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;
          } catch (addError) {
            logger.warn('Failed to create supercluster-generated source:', addError);
            return;
          }
        }

        if (source?.setData) {
          source.setData(clustersGeoJSON as any);

          // Update ALL cluster territories at once dynamically!
          const hullSource = map.getSource('cluster-hulls') as maplibregl.GeoJSONSource;
          if (hullSource && hullSource.setData) {
            hullSource.setData(hullsGeoJSON as any);
          }

          logger.debug(`🔶 Supercluster applied ${clusters.length} features (throttled)`);

          lastUpdateTimeRef.current = now; // Update throttle timestamp

          if (force) {
            lastZoomRef.current = zoom;
            lastBBoxRef.current = bbox;
          }
        }

        if (!force) {
          lastZoomRef.current = zoom;
          lastBBoxRef.current = bbox;
        }
      } catch (error) {
        logger.error('Failed to update Supercluster clusters:', error);
      }
    },
    [clustererRef]
  );

  /**
   * Setup des listeners pour zoom + pan avec debounce ultra-performant
   */
  const setupClusteringEvents = useCallback(
    (map: maplibregl.Map) => {
      const handleViewportChange = () => {
        if (clusterUpdateTimeoutRef.current) cancelAnimationFrame(clusterUpdateTimeoutRef.current);
        clusterUpdateTimeoutRef.current = requestAnimationFrame(() => updateClusterDisplay(map));
      };

      // ✅ CRITICAL: Initial update (with tiny delay to let HouseholdLayer add sources)
      const initialTimer = setTimeout(() => {
        if (map.isStyleLoaded()) updateClusterDisplay(map, true);
      }, 50);

      const handleClusterHover = (e: maplibregl.MapMouseEvent) => {
        // Obsolete: Global territories now drawn permanently during display update
      };

      map.on('zoomend', handleViewportChange);
      map.on('moveend', handleViewportChange);

      return () => {
        clearTimeout(initialTimer);
        map.off('zoomend', handleViewportChange);
        map.off('moveend', handleViewportChange);

        if (clusterUpdateTimeoutRef.current) {
          cancelAnimationFrame(clusterUpdateTimeoutRef.current);
          clusterUpdateTimeoutRef.current = null;
        }
      };
    },
    [updateClusterDisplay, clustererRef]
  );

  return { setupClusteringEvents, updateClusterDisplay };
};
