/**
 * Supercluster Integration
 * High-performance clustering for 50,000+ points
 *
 * Used in MapLibre to replace native clustering for better performance
 */

import Supercluster from 'supercluster';
import type { Feature, Point } from 'geojson';

export interface ClusteredPoint {
  type: 'cluster' | 'point';
  id: string;
  geometry: {
    coordinates: [number, number];
  };
  properties: any;
}

/**
 * Initialize Supercluster with map points
 */
export function initializeSupercluster(points: Feature<Point>[], options?: any) {
  const cluster = new Supercluster({
    radius: 70, // ✅ Increased radius for better visual stability (Audit recommendation)
    maxZoom: 16, // ✅ Neighbourhood precision
    minZoom: 0,
    minPoints: 3, // ✅ Only cluster if 3+ points are grouped
    ...options,
  });

  // Add all points to cluster (cast to Supercluster expected type)
  cluster.load(points as any);

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
  return supercluster.getClusters(bbox, Math.floor(zoom)) as any;
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
 * Transform and sanitize household data for MapLibre (CRITICAL for null safety)
 * Ensures ALL numeric fields have valid numbers, never null
 * @param household Raw household object from database
 * @returns Cleaned object safe for MapLibre expressions
 */
function sanitizeHouseholdForMap(h: any): any {
  // Extract coordinates safely
  let lng = Number(h.location?.coordinates?.[0]) || 0;
  let lat = Number(h.location?.coordinates?.[1]) || 0;

  // Auto-correction: Au Sénégal, Lng est négatif (~-17) et Lat positif (~14).
  if (lng > 0 && lat < 0) {
    const temp = lng;
    lng = lat;
    lat = temp;
  }

  return {
    // Technical fields (strings)
    id: String(h.id || ''),
    household_id: String(h.id || ''),
    status: String(h.status || 'Non débuté'),
    syncStatus: String(h.syncStatus || 'synced'), // <-- CRITICAL: Always a string, never null
    name: String(h.owner?.name || h.name || 'N/A'),

    // Numeric fields (CRITICAL: Never null for MapLibre expressions)
    longitude: Number.isFinite(lng) ? lng : 0,
    latitude: Number.isFinite(lat) ? lat : 0,

    // Additional metadata (with defaults)
    region: String(h.region || 'Unknown'),
    departement: String(h.departement || ''),
    village: String(h.village || ''),
    phone: String(h.phone || ''),
    source: String(h.source || 'manual'),
    version: Number(h.version || 1),
  };
}

/**
 * Convert household data to GeoJSON points for clustering
 */
export function householdsToGeoJSON(households: any[]): Feature<Point>[] {
  return households
    .filter((h) => h.location?.coordinates && h.location.coordinates.length === 2)
    .map((h) => {
      const cleaned = sanitizeHouseholdForMap(h);
      const { longitude: lng, latitude: lat } = cleaned;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat] as [number, number],
        },
        properties: cleaned, // ✅ All properties are now cleaned and safe
      };
    });
}

/**
 * Get color for cluster based on point count
 */
export function getClusterColor(pointCount: number): string {
  if (pointCount >= 100) return '#f43f5e'; // Red
  if (pointCount >= 50) return '#f59e0b'; // Orange
  if (pointCount >= 20) return '#fbbf24'; // Yellow
  return '#34d399'; // Green
}

/**
 * Format cluster display
 */
export function formatClusterLabel(pointCount: number): string {
  if (pointCount >= 1000) {
    return `${(pointCount / 1000).toFixed(1)}k`;
  }
  return String(pointCount);
}
