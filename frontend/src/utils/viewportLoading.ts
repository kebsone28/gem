/**
 * Viewport Loading - Load only visible points on map
 * Based on bounding box (lng1, lat1, lng2, lat2)
 *
 * This is CRITICAL for 50,000+ points performance
 * Instead of loading all points, we only load what's visible on screen
 */

export interface BoundingBox {
  lng1: number;
  lat1: number;
  lng2: number;
  lat2: number;
}

/**
 * Get bounding box from map bounds
 * Used to load only visible points
 */
export function getBoundingBoxFromMapBounds(
  center: [number, number],
  zoom: number,
  windowSize: { width: number; height: number }
): BoundingBox {
  // Rough calculation of degrees per pixel at zoom level
  const metersPerPixel =
    (40075016.686 * Math.cos((center[1] * Math.PI) / 180)) / Math.pow(2, zoom + 8);

  // Convert window size to degrees
  const latDelta = (windowSize.height * metersPerPixel) / 111320; // meters per degree latitude
  const lngDelta =
    (windowSize.width * metersPerPixel) / (111320 * Math.cos((center[1] * Math.PI) / 180));

  // Add 20% padding to preload slightly outside visible area
  const padding = 1.2;

  return {
    lng1: center[0] - (lngDelta / 2) * padding,
    lat1: center[1] - (latDelta / 2) * padding,
    lng2: center[0] + (lngDelta / 2) * padding,
    lat2: center[1] + (latDelta / 2) * padding,
  };
}

/**
 * Format bounding box for API request
 * Example: "2.3,48.8,2.4,48.9"
 */
export function formatBboxForAPI(bbox: BoundingBox): string {
  return `${bbox.lng1.toFixed(6)},${bbox.lat1.toFixed(6)},${bbox.lng2.toFixed(6)},${bbox.lat2.toFixed(6)}`;
}

/**
 * Check if point is within bounding box
 */
export function isPointInBbox(point: [number, number], bbox: BoundingBox): boolean {
  return (
    point[0] >= bbox.lng1 && point[0] <= bbox.lng2 && point[1] >= bbox.lat1 && point[1] <= bbox.lat2
  );
}

/**
 * Debounced viewport update
 * Prevent excessive API calls when map is moving
 */
export function createViewportDebounce(callback: (bbox: BoundingBox) => void, delay = 300) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (bbox: BoundingBox) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(bbox);
      timeoutId = null;
    }, delay);
  };
}
