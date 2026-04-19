import Supercluster from 'supercluster';
import type { Feature, Point } from 'geojson';
import { getHouseholdDerivedStatus } from './statusUtils';

/**
 * Enhanced types for better developer experience and production stability
 */
export interface ClusterProperties {
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  [key: string]: any;
}

export interface ClusteredPoint {
  type: 'cluster' | 'point';
  id: string;
  geometry: {
    coordinates: [number, number];
  };
  properties: ClusterProperties;
}

/**
 * Initialize Supercluster with map points
 */
export function initializeSupercluster(
  points: Feature<Point, any>[], 
  options?: Supercluster.Options<any, any>
) {
  const cluster = new Supercluster({
    radius: 70, // Visual stability
    maxZoom: 16, // Max level of clustering
    minZoom: 0,
    minPoints: 3, // Only cluster groupings
    ...options,
  });

  // ✅ Use proper typing instead of 'any'
  cluster.load(points);

  return cluster;
}

/**
 * Get clusters and individual points for current map view
 */
export function getClustersForZoom(
  supercluster: Supercluster,
  bbox: [number, number, number, number],
  zoom: number
): ClusteredPoint[] {
  // Use Math.round for smoother transition at high scale
  const integerZoom = zoom > 14 ? 16 : Math.round(zoom);
  return supercluster.getClusters(bbox, integerZoom) as any;
}

/**
 * Expand a cluster to get child points
 */
export function expandCluster(supercluster: Supercluster, clusterId: number): Feature<Point>[] {
  return supercluster.getChildren(clusterId) as any;
}

/**
 * Get all points in a cluster recursively
 */
export function getClusterExpansionZoom(supercluster: Supercluster, clusterId: number): number {
  return supercluster.getClusterExpansionZoom(clusterId);
}

/**
 * New dynamic intensity color strategy for clusters
 * Scales with the number of points for better field visualization
 */
export function getClusterColor(pointCount: number): string {
  const intensity = Math.min(pointCount / 100, 1);

  if (intensity > 0.8) return '#f43f5e'; // High density: Rose
  if (intensity > 0.5) return '#f59e0b'; // Medium-High: Ambre
  if (intensity > 0.2) return '#fbbf24'; // Medium: Jaune
  return '#10b981'; // Low density: Emeraude
}

/**
 * Transform and sanitize household data for MapLibre (PRO SCALE)
 * @param household Raw household object
 * @returns Cleaned object or null if geolocation is missing (avoids 0,0 Atlantic Ocean artifacts)
 */
function sanitizeHouseholdForMap(h: any): any | null {
  // ✅ SUPPORT MULTI-SOURCE COORDINATES (Nested GeoJSON OR Top-level Lat/Lon)
  // CRITICAL: use ?? instead of || to ensure 0 values are preserved
  let lng = Number(h.location?.coordinates?.[0] ?? h.longitude);
  let lat = Number(h.location?.coordinates?.[1] ?? h.latitude);

  // 🇸🇳 SMART AUTO-CORRECTION FOR SENEGAL (West Africa)
  if (lng > 0 && lat < 0) {
    [lng, lat] = [lat, lng];
  }
  if (Math.abs(lng) > 11 && Math.abs(lng) < 18) {
    lng = -Math.abs(lng);
  }
  if (Math.abs(lat) > 11 && Math.abs(lat) < 17) {
    lat = Math.abs(lat);
  }

  // Drop household if coordinates are still invalid or exactly 0,0
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
    return null;
  }

  return {
    id: String(h.id || ''),
    household_id: String(h.id || ''),
    status: getHouseholdDerivedStatus(h),
    syncStatus: String(h.syncStatus || 'synced'),
    name: String(h.owner?.name || h.name || 'N/A'),
    longitude: lng,
    latitude: lat,
    region: String(h.region || 'Unknown'),
    departement: String(h.departement || ''),
    village: String(h.village || ''),
    phone: String(h.phone || ''),
    source: String(h.source || 'manual'),
    version: Number(h.version || 1),
    numeroordre: String(h.numeroordre || ''),
  };
}

/**
 * Convert household data to GeoJSON features for high-performance clustering
 */
export function householdsToGeoJSON(households: any[]): Feature<Point>[] {
  const result: Feature<Point>[] = [];

  (households || []).forEach((h) => {
    const cleaned = sanitizeHouseholdForMap(h);
    if (!cleaned) return;

    result.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cleaned.longitude, cleaned.latitude],
      },
      properties: cleaned,
    });
  });

  return result;
}

/**
 * Format cluster display (compact text)
 */
export function formatClusterLabel(pointCount: number): string {
  if (pointCount >= 1000) {
    return `${(pointCount / 1000).toFixed(1)}k`;
  }
  return String(pointCount);
}
