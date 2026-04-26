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

import { useCallback, useMemo, useRef } from 'react';
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

const intersectsBBox = (
  a: [number, number, number, number] | number[] | null | undefined,
  b: [number, number, number, number] | number[]
) => {
  if (!a || a.length !== 4 || b.length !== 4) return false;
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
};

const computeCentroid = (coordinates: number[][]): [number, number] | null => {
  if (!coordinates.length) return null;
  const [sumLon, sumLat] = coordinates.reduce(
    ([accLon, accLat], [lon, lat]) => [accLon + lon, accLat + lat],
    [0, 0]
  );
  return [sumLon / coordinates.length, sumLat / coordinates.length];
};

const roundCoord = (value: number) => Math.round(value * 100000) / 100000;

const simplifyClosedRing = (ring: number[][]) => {
  // Ne jamais retirer des sommets du hull métier: sinon certains ménages
  // affichés aux extrémités peuvent sortir visuellement de la grappe.
  const core = ring.slice(0, -1).map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]);
  if (core.length === 0) return [];

  const first = core[0];
  const last = core[core.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  return isClosed ? core : [...core, first];
};

const truncateLabel = (value: string, max = 20) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const getStatusBucket = (properties: Record<string, any>) => {
  if ((properties.critical_count || 0) > 0) return 'critical';
  if ((properties.blocked_count || 0) > 0) return 'blocked';
  if ((properties.pending_count || 0) > 0) return 'pending';

  const rawStatus = String(
    properties.statusKey ||
      properties.status_key ||
      properties.status ||
      properties.installationStatus ||
      properties.currentStep ||
      ''
  )
    .trim()
    .toLowerCase();

  if (
    rawStatus.includes('non conforme') ||
    rawStatus.includes('non_conforme') ||
    rawStatus.includes('non-conforme') ||
    rawStatus.includes('non eligible') ||
    rawStatus.includes('non-eligible') ||
    rawStatus.includes('critical')
  ) {
    return 'critical';
  }

  if (
    rawStatus.includes('livraison') ||
    rawStatus.includes('murs') ||
    rawStatus.includes('bloque') ||
    rawStatus.includes('incident') ||
    rawStatus.includes('blocked')
  ) {
    return 'blocked';
  }

  if (
    rawStatus.includes('non encore installee') ||
    rawStatus.includes('non encore installée') ||
    rawStatus.includes('pending') ||
    rawStatus.includes('en attente') ||
    rawStatus.includes('a_planifier')
  ) {
    return 'pending';
  }

  if (
    rawStatus.includes('controle conforme') ||
    rawStatus.includes('contrôle conforme') ||
    rawStatus.includes('conforme') ||
    rawStatus.includes('validated') ||
    rawStatus.includes('compliant')
  ) {
    return 'compliant';
  }

  return 'progress';
};

const accumulateZoneMetrics = (acc: Record<string, any>, properties: Record<string, any>) => {
  const pointCount = Number(properties.point_count || 1);
  acc.point_count = Number(acc.point_count || 0) + pointCount;

  if ('critical_count' in properties || 'blocked_count' in properties || 'pending_count' in properties || 'compliant_count' in properties) {
    acc.critical_count = Number(acc.critical_count || 0) + Number(properties.critical_count || 0);
    acc.blocked_count = Number(acc.blocked_count || 0) + Number(properties.blocked_count || 0);
    acc.pending_count = Number(acc.pending_count || 0) + Number(properties.pending_count || 0);
    acc.compliant_count = Number(acc.compliant_count || 0) + Number(properties.compliant_count || 0);
  } else {
    const bucket = getStatusBucket(properties);
    if (bucket === 'critical') acc.critical_count = Number(acc.critical_count || 0) + pointCount;
    else if (bucket === 'blocked') acc.blocked_count = Number(acc.blocked_count || 0) + pointCount;
    else if (bucket === 'pending') acc.pending_count = Number(acc.pending_count || 0) + pointCount;
    else if (bucket === 'compliant') acc.compliant_count = Number(acc.compliant_count || 0) + pointCount;
  }

  const critical = Number(acc.critical_count || 0);
  const blocked = Number(acc.blocked_count || 0);
  const pending = Number(acc.pending_count || 0);
  const compliant = Number(acc.compliant_count || 0);
  acc.severity_score = critical * 5 + blocked * 3 + pending * 2 + compliant;
  return acc;
};

const buildHullGeometry = (coordinates: [number, number][]) => {
  if (coordinates.length >= 3) {
    const points = featureCollection(coordinates.map((coords) => point(coords)));
    const hull = convex(points);
    if (hull?.geometry?.type === 'Polygon') {
      return {
        type: 'Polygon' as const,
        coordinates: [simplifyClosedRing((hull.geometry.coordinates?.[0] || []) as number[][])],
      };
    }
  }

  const bbox = computeBBox(coordinates);
  if (!bbox) return null;

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const latPadding = Math.max((maxLat - minLat) / 2, 0.0016);
  const lonPadding = Math.max((maxLon - minLon) / 2, 0.0016 / Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));

  return {
    type: 'Polygon' as const,
    coordinates: [[
      [roundCoord(minLon - lonPadding), roundCoord(minLat - latPadding)],
      [roundCoord(maxLon + lonPadding), roundCoord(minLat - latPadding)],
      [roundCoord(maxLon + lonPadding), roundCoord(maxLat + latPadding)],
      [roundCoord(minLon - lonPadding), roundCoord(maxLat + latPadding)],
      [roundCoord(minLon - lonPadding), roundCoord(minLat - latPadding)],
    ]],
  };
};

export const useMapClustering = (
  worker: { 
    getClusters: (bbox: [number, number, number, number], zoom: number, callback: (clusters: any[]) => void) => void;
    getLeaves: (clusterId: number, limit?: number) => Promise<any[]>;
    isLoaded: boolean;
  },
  households: any[] = [],
  displayedFeatures: any[] = []
) => {
  const clusterUpdateTimeoutRef = useRef<number | null>(null);
  
  // Cache zoom + bbox pour éviter recalcul inutile
  const lastZoomRef = useRef<number | null>(null);
  const lastBBoxRef = useRef<[number, number, number, number] | null>(null);

  // ✅ THROTTLE: Minimum time between cluster updates (in ms)
  const THROTTLE_MS = 120;
  const lastUpdateTimeRef = useRef<number>(0);

  const stableVillageZones = useMemo(() => {
    const groups = new Map<string, { village: string; coordinates: [number, number][]; metrics: Record<string, any> }>();
    const displayCoordsById = new Map<string, [number, number]>();

    for (const feature of displayedFeatures || []) {
      const featureId = String(
        feature?.properties?.household_id ?? feature?.properties?.id ?? feature?.id ?? ''
      ).trim();
      const coords = feature?.geometry?.coordinates as [number, number] | undefined;
      if (!featureId || !Array.isArray(coords) || coords.length < 2) continue;
      displayCoordsById.set(featureId, coords);
    }

    for (const household of households || []) {
      const householdId = String(household?.id ?? '').trim();
      const displayedCoords = householdId ? displayCoordsById.get(householdId) : undefined;
      const lon = Number(displayedCoords?.[0] ?? household?.location?.coordinates?.[0] ?? household?.longitude);
      const lat = Number(displayedCoords?.[1] ?? household?.location?.coordinates?.[1] ?? household?.latitude);
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || (lon === 0 && lat === 0)) continue;

      const village = String(
        household?.village ||
          household?.grappe ||
          household?.sousGrappe ||
          household?.sous_grappe ||
          household?.departement ||
          household?.region ||
          'Zone terrain'
      ).trim();

      const key = village.toLowerCase() || 'zone-terrain';
      const group = groups.get(key) || {
        village: village || 'Zone terrain',
        coordinates: [],
        metrics: {},
      };

      group.coordinates.push([lon, lat]);
      accumulateZoneMetrics(group.metrics, {
        status: household?.status,
        point_count: 1,
        critical_count: household?.critical_count,
        blocked_count: household?.blocked_count,
        pending_count: household?.pending_count,
        compliant_count: household?.compliant_count,
      });
      groups.set(key, group);
    }

    const features: any[] = [];
    const labels: any[] = [];

    [...groups.values()]
      .filter((group) => group.coordinates.length > 0)
      .forEach((group) => {
        const bbox = computeBBox(group.coordinates);
        const centroid = computeCentroid(group.coordinates);
        const geometry = buildHullGeometry(group.coordinates);
        if (!bbox || !centroid || !geometry) return;

        const properties: Record<string, any> = {
          ...group.metrics,
          dominantVillage: group.village,
          village: group.village,
          bbox,
        };
        const pointCount = Number(properties.point_count || group.coordinates.length || 0);
        const criticalCount = Number(properties.critical_count || 0);
        const blockedCount = Number(properties.blocked_count || 0);
        const pendingCount = Number(properties.pending_count || 0);
        const tone = getClusterTone(properties);
        const labelTiny = criticalCount > 0 ? `${pointCount} • ${criticalCount}u` : `${pointCount}`;
        const labelHero =
          criticalCount > 0
            ? `${truncateLabel(group.village, 20)}\n${pointCount} MENAGES\n${criticalCount} URGENTS`
            : `${truncateLabel(group.village, 20)}\n${pointCount} MENAGES`;
        const labelName = truncateLabel(group.village, 22);
        const labelMetric = criticalCount > 0 ? `${pointCount} • ${criticalCount} urg.` : `${pointCount} menages`;
        const labelMetricCompact = `${pointCount}`;
        const labelShort =
          criticalCount > 0 ? `${pointCount}\n+ ${criticalCount} urg.` : `${pointCount} ménages`;
        const labelDetail =
          criticalCount > 0
            ? `${truncateLabel(group.village)}\n${pointCount} ménages\n${criticalCount} urgents`
            : `${truncateLabel(group.village)}\n${pointCount} ménages`;
        const labelFull =
          criticalCount > 0
            ? `${group.village}\n${pointCount} ménages\n${criticalCount} urgents`
            : `${group.village}\n${pointCount} ménages`;

        features.push({
          type: 'Feature',
          geometry,
          properties: {
            ...properties,
            zoneColor: tone.fill,
            zoneStroke: tone.stroke,
            zoneHalo: tone.halo,
            labelTiny,
            labelHero,
            labelName,
            labelMetric,
            labelMetricCompact,
            labelShort,
            labelDetail,
            labelFull,
          },
        });

        labels.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: centroid },
          properties: {
            ...properties,
            labelTiny,
            labelHero,
            labelName,
            labelMetric,
            labelMetricCompact,
            labelShort,
            labelDetail,
            labelFull,
            showLabel: criticalCount > 0 || blockedCount > 0 || pointCount >= 12,
            critical_count: criticalCount,
            blocked_count: blockedCount,
            pending_count: pendingCount,
          },
        });
      });

    return { features, labels };
  }, [displayedFeatures, households]);

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

          const hullFeatures = stableVillageZones.features.filter((feature) =>
            intersectsBBox(feature?.properties?.bbox, bbox)
          );
          const hullLabelFeatures = stableVillageZones.labels.filter(
            (feature) =>
              feature?.properties?.showLabel && intersectsBBox(feature?.properties?.bbox, bbox)
          );

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
    [stableVillageZones, worker]
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
