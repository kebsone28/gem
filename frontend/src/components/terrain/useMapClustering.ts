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

export const useMapClustering = (
  worker: { 
    getClusters: (bbox: [number, number, number, number], zoom: number, callback: (clusters: any[]) => void) => void;
    getLeaves: (clusterId: number, limit?: number) => Promise<any[]>;
    isLoaded: boolean;
  }
) => {
  const clusterUpdateTimeoutRef = useRef<number | null>(null);
  
  // Cache zoom + bbox pour éviter recalcul inutile
  const lastZoomRef = useRef<number | null>(null);
  const lastBBoxRef = useRef<[number, number, number, number] | null>(null);

  // ✅ THROTTLE: Minimum time between cluster updates (in ms)
  const THROTTLE_MS = 120;
  const lastUpdateTimeRef = useRef<number>(0);

  /**
   * Met à jour les clusters pour la vue actuelle via le Worker
   */
  const updateClusterDisplay = useCallback(
    (map: maplibregl.Map, force = false, showZones = false) => {
      // DEFENSIVE: Verify map is still initialized and worker is ready
      if (!map || !(map as any).style || !map.isStyleLoaded() || !worker.isLoaded) return;

      // SI MODE ZONE ACTIVÉ : On vide les clusters et on arrête là
      if (showZones) {
        const source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;
        if (source?.setData) source.setData({ type: 'FeatureCollection', features: [] });
        const hullSource = map.getSource('cluster-hulls') as maplibregl.GeoJSONSource;
        if (hullSource?.setData) hullSource.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const now = Date.now();
      if (!force && now - lastUpdateTimeRef.current < THROTTLE_MS) {
        return; 
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
        // ✅ DEMANDE ASYNCHRONE AU WORKER
        worker.getClusters(bbox, zoom, async (clusters) => {
          if (!map.isStyleLoaded()) return;

          const clustersGeoJSON = {
            type: 'FeatureCollection',
            features: clusters,
          };

          // Calcule les limites territoriales (Hulls) de manière asynchrone si besoin
          const hullFeatures: any[] = [];
          
          // Note: On limite le calcul des hulls aux 15 plus gros clusters visibles pour la perf UI
          const clustersWithHulls = clusters
            .filter(c => c.properties?.cluster)
            .sort((a, b) => (b.properties.point_count || 0) - (a.properties.point_count || 0))
            .slice(0, 15);

          for (const c of clustersWithHulls) {
            try {
              const leaves = await worker.getLeaves(c.properties.cluster_id, 100);
              if (leaves && leaves.length >= 3) {
                const points = featureCollection(leaves.map((l) => point(l.geometry.coordinates)));
                const hull = convex(points);
                if (hull) hullFeatures.push(hull);
              }
            } catch (hullErr) {
              // Ignore single hull errors
            }
          }

          const hullsGeoJSON = {
            type: 'FeatureCollection',
            features: hullFeatures,
          };

          let source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;

          if (!source && map.isStyleLoaded()) {
            try {
              map.addSource('supercluster-generated', {
                type: 'geojson',
                data: clustersGeoJSON as any,
              });
              source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;
            } catch (e) { return; }
          }

          if (source?.setData) {
            source.setData(clustersGeoJSON as any);
            
            let hullSource = map.getSource('cluster-hulls') as maplibregl.GeoJSONSource;
            if (!hullSource && map.isStyleLoaded()) {
              try {
                map.addSource('cluster-hulls', {
                  type: 'geojson',
                  data: hullsGeoJSON as any,
                });
                hullSource = map.getSource('cluster-hulls') as maplibregl.GeoJSONSource;
              } catch (e) { /* ignore */ }
            }

            if (hullSource && hullSource.setData) {
              hullSource.setData(hullsGeoJSON as any);
            }
            lastUpdateTimeRef.current = Date.now();
          }
        });

        lastZoomRef.current = zoom;
        lastBBoxRef.current = bbox;
      } catch (error) {
        logger.error('Failed to update Supercluster clusters:', error);
      }
    },
    [worker]
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
    [updateClusterDisplay]
  );

  return { setupClusteringEvents, updateClusterDisplay };
};
