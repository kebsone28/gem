/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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
import logger from '../../utils/logger';
import convex from '@turf/convex';
import { featureCollection, point } from '@turf/helpers';

const ZONE_COLORS = {
  critical: { fill: '#7F1D1D', stroke: '#FCA5A5', halo: '#EF4444' },
  blocked: { fill: '#7C2D12', stroke: '#FCD34D', halo: '#F59E0B' },
  pending: { fill: '#78350F', stroke: '#FDE68A', halo: '#EAB308' },
  compliant: { fill: '#064E3B', stroke: '#A7F3D0', halo: '#10B981' },
  progress: { fill: '#134E4A', stroke: '#99F6E4', halo: '#14B8A6' },
} as const;

const getClusterTone = (properties: Record<string, any>) => {
  if ((properties.critical_count || 0) > 0) return ZONE_COLORS.critical;
  if ((properties.blocked_count || 0) > 0) return ZONE_COLORS.blocked;
  if ((properties.pending_count || 0) > 0) return ZONE_COLORS.pending;
  if ((properties.compliant_count || 0) === (properties.point_count || 0)) return ZONE_COLORS.compliant;
  return ZONE_COLORS.progress;
};

const computeBBox = (coordinates: number[][]) => {
  if (!coordinates.length) return null;
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

const roundCoord = (value: number) => Math.round(value * 100000) / 100000;

const simplifyClosedRing = (ring: number[][]) => {
  if (ring.length <= 6) {
    return ring.map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]);
  }

  const core = ring.slice(0, -1);
  const stride = core.length > 14 ? 3 : 2;
  const simplified = core.filter((_, index) => index === 0 || index === core.length - 1 || index % stride === 0);
  const closed = [...simplified, simplified[0]];
  return closed.map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]);
};

const truncateLabel = (value: string, max = 20) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const getDominantVillage = (leaves: any[]) => {
  const counts = new Map<string, number>();
  for (const leaf of leaves) {
    const village = String(leaf?.properties?.village || leaf?.properties?.departement || '').trim();
    if (!village) continue;
    counts.set(village, (counts.get(village) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Zone terrain';
};

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
        const hullLabelSource = map.getSource('cluster-hull-labels') as maplibregl.GeoJSONSource;
        if (hullLabelSource?.setData)
          hullLabelSource.setData({ type: 'FeatureCollection', features: [] });
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
          const hullLabelFeatures: any[] = [];
          
          // On garde une limite haute pour préserver les performances sans tronquer excessivement la lecture métier.
          const clustersWithHulls = clusters
            .filter(c => c.properties?.cluster)
            .sort((a, b) => (b.properties.point_count || 0) - (a.properties.point_count || 0))
            .slice(0, 36);

          for (const c of clustersWithHulls) {
            try {
              const leaves = await worker.getLeaves(c.properties.cluster_id, 100);
              if (leaves && leaves.length >= 3) {
                const coordinates = leaves.map((l) => l.geometry.coordinates as [number, number]);
                const points = featureCollection(coordinates.map((coords) => point(coords)));
                const hull = convex(points);
                if (hull) {
                  const properties = c.properties || {};
                  const dominantVillage = getDominantVillage(leaves);
                  const bbox = computeBBox(coordinates);
                  const pointCount = Number(properties.point_count || 0);
                  const criticalCount = Number(properties.critical_count || 0);
                  const blockedCount = Number(properties.blocked_count || 0);
                  const pendingCount = Number(properties.pending_count || 0);
                  const labelTiny =
                    criticalCount > 0 ? `${pointCount} • ${criticalCount}u` : `${pointCount}`;
                  const labelShort =
                    criticalCount > 0 ? `${pointCount}\n+ ${criticalCount} urg.` : `${pointCount} ménages`;
                  const labelDetail =
                    criticalCount > 0
                      ? `${truncateLabel(dominantVillage)}\n${pointCount} ménages\n${criticalCount} urgents`
                      : `${truncateLabel(dominantVillage)}\n${pointCount} ménages`;
                  const labelFull =
                    criticalCount > 0
                      ? `${dominantVillage}\n${pointCount} ménages\n${criticalCount} urgents`
                      : `${dominantVillage}\n${pointCount} ménages`;
                  const showLabel = criticalCount > 0 || blockedCount > 0 || pointCount >= 36;
                  const tone = getClusterTone(properties);
                  const hullGeometry = hull.geometry?.type === 'Polygon'
                    ? {
                        ...hull.geometry,
                        coordinates: [simplifyClosedRing((hull.geometry.coordinates?.[0] || []) as number[][])],
                      }
                    : hull.geometry;

                  hullFeatures.push({
                    ...hull,
                    geometry: hullGeometry,
                    properties: {
                      ...properties,
                      dominantVillage,
                      bbox,
                      zoneColor: tone.fill,
                      zoneStroke: tone.stroke,
                      zoneHalo: tone.halo,
                      labelTiny,
                      labelShort,
                      labelDetail,
                      labelFull,
                    },
                  });

                  if (showLabel) {
                    hullLabelFeatures.push({
                      type: 'Feature',
                      geometry: {
                        type: 'Point',
                        coordinates: c.geometry.coordinates,
                      },
                      properties: {
                        ...properties,
                        dominantVillage,
                        bbox,
                        labelTiny,
                        labelShort,
                        labelDetail,
                        labelFull,
                        showLabel,
                        critical_count: criticalCount,
                        blocked_count: blockedCount,
                        pending_count: pendingCount,
                      },
                    });
                  }
                }
              }
            } catch (hullErr) {
              // Ignore single hull errors
            }
          }

          const hullsGeoJSON = {
            type: 'FeatureCollection',
            features: hullFeatures,
          };
          const hullLabelsGeoJSON = {
            type: 'FeatureCollection',
            features: hullLabelFeatures,
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

            let hullLabelSource = map.getSource('cluster-hull-labels') as maplibregl.GeoJSONSource;
            if (!hullLabelSource && map.isStyleLoaded()) {
              try {
                map.addSource('cluster-hull-labels', {
                  type: 'geojson',
                  data: hullLabelsGeoJSON as any,
                });
                hullLabelSource = map.getSource('cluster-hull-labels') as maplibregl.GeoJSONSource;
              } catch (e) { /* ignore */ }
            }

            if (hullLabelSource?.setData) {
              hullLabelSource.setData(hullLabelsGeoJSON as any);
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
