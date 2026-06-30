/**
 * Geo Utilities for Ged Collect
 * Calculates polygon areas (geoshape) and path lengths (geotrace) natively
 */

const EARTH_RADIUS = 6378137; // in meters

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the spherical area of a polygon in square meters.
 * Based on the Chamberlin-Traget algorithm used by Turf.js / OpenLayers.
 */
export function calculatePolygonArea(coords: Coordinate[]): number {
  if (coords.length < 3) return 0;

  let area = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];

    const lat1 = (p1.latitude * Math.PI) / 180;
    const lat2 = (p2.latitude * Math.PI) / 180;
    const lon1 = (p1.longitude * Math.PI) / 180;
    const lon2 = (p2.longitude * Math.PI) / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = (area * EARTH_RADIUS * EARTH_RADIUS) / 2.0;
  return Math.abs(area);
}

/**
 * Calculates the great-circle distance between two GPS coordinates in meters.
 * Uses the Haversine formula.
 */
export function getDistance(p1: Coordinate, p2: Coordinate): number {
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculates the total length of a path in meters.
 */
export function calculatePathLength(coords: Coordinate[]): number {
  if (coords.length < 2) return 0;

  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += getDistance(coords[i], coords[i + 1]);
  }
  return length;
}

/**
 * Formats area into a human-readable string (m² or ha).
 */
export function formatArea(squareMeters: number): string {
  if (squareMeters >= 10000) {
    const hectares = squareMeters / 10000;
    return `${hectares.toFixed(2)} ha (${squareMeters.toFixed(0)} m²)`;
  }
  return `${squareMeters.toFixed(1)} m²`;
}

/**
 * Formats length into a human-readable string (m or km).
 */
export function formatLength(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(2)} km (${meters.toFixed(0)} m)`;
  }
  return `${meters.toFixed(1)} m`;
}

/**
 * Parses XForm geoshape/geotrace string format into an array of Coordinate.
 * XForm format: "lat lon alt acc; lat lon alt acc; ..." or spaces: "lat lon alt acc lat lon alt acc ..."
 */
export function parseXFormGeoString(geoString: string | null | undefined): Coordinate[] {
  if (!geoString) return [];

  // Try parsing by semicolon first, then by space
  let points: string[] = [];
  if (geoString.includes(';')) {
    points = geoString.split(';').map((p) => p.trim());
  } else {
    // If it's space-separated, check if it's pairs or quadruplets (lat lon alt acc)
    const tokens = geoString.split(/\s+/).filter(Boolean);
    // Usually XLSForm geoshape is a space-separated list of coords: "lat lon alt acc lat lon alt acc..."
    // We group them by 4 (or 2 if only lat/lon)
    const grouped: string[] = [];
    let current: string[] = [];

    // Auto-detect group size (if 2 tokens, it's lat/lon, if 4 it's lat/lon/alt/acc)
    // We can assume if the total length is a multiple of 4, they are quadruplets
    const step = tokens.length % 4 === 0 ? 4 : tokens.length % 3 === 0 ? 3 : 2;

    for (let i = 0; i < tokens.length; i += step) {
      grouped.push(tokens.slice(i, i + step).join(' '));
    }
    points = grouped;
  }

  const coords: Coordinate[] = [];
  for (const point of points) {
    const parts = point.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        coords.push({ latitude: lat, longitude: lon });
      }
    }
  }

  return coords;
}

/**
 * Serializes Coordinates to XForm geoshape/geotrace space-separated string format.
 */
export function serializeXFormGeo(coords: Coordinate[]): string {
  return coords.map((c) => `${c.latitude} ${c.longitude} 0 0`).join(' ');
}
