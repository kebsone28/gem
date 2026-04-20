/**
 * clusterWorker.ts — Village Region Mode
 *
 * Groups households by their `village` field and computes a
 * convex hull around each village's points to draw region outlines.
 * Replaces the previous k-means / DBSCAN hybrid clustering.
 */

// ── Monotone Chain Convex Hull (O(n log n)) ──────────────────────────
interface Point {
  lat: number;
  lon: number;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
}

function convexHull(pts: Point[]): Point[] {
  if (pts.length === 0) return [];
  if (pts.length <= 3) return [...pts, pts[0]]; // Close the ring

  const sorted = [...pts].sort((a, b) => (a.lon !== b.lon ? a.lon - b.lon : a.lat - b.lat));

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length > 0) hull.push(hull[0]); // Close the GeoJSON ring
  return hull;
}

// ── Buffer: add a small padding around each hull point (in degrees) ──
const BUFFER_DEG = 0.005; // ~500 metres

function bufferHull(hull: Point[]): Point[] {
  if (hull.length < 3) return hull;

  // Find centroid
  const cx = hull.reduce((s, p) => s + p.lon, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.lat, 0) / hull.length;

  return hull.map((p) => {
    const dx = p.lon - cx;
    const dy = p.lat - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    return {
      lon: p.lon + (dx / dist) * BUFFER_DEG,
      lat: p.lat + (dy / dist) * BUFFER_DEG,
    };
  });
}

// ── BBox helper ────────────────────────────────────────────────────────
function computeBBox(points: Point[]) {
  if (!points || points.length === 0) return null;
  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return [
    [minLon - 0.005, minLat - 0.005],
    [maxLon + 0.005, maxLat + 0.005],
  ];
}

// ── Palette: one color per village (cycles through) ───────────────────
const VILLAGE_COLORS = [
  '#6366F1',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#84CC16',
  '#06B6D4',
  '#A855F7',
];

// ── Main Worker ────────────────────────────────────────────────────────
self.onmessage = (event) => {
  try {
    const { households } = event.data;

    const valid = (households || []).filter((h: Record<string, unknown>) => {
      const lat = Number(h.lat);
      const lng = Number(h.lon);
      return (
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat !== 0 &&
        lng !== 0 &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      );
    });

    // ── Group by village ─────────────────────────────────────────────
    const byVillage = new Map<string, { points: Point[]; ids: string[] }>();
    const inconnuPoints: { h: Record<string, unknown>; p: Point }[] = [];

    for (const h of valid) {
      const vName = (h.village || h.departement || '').trim();
      if (vName) {
        if (!byVillage.has(vName)) byVillage.set(vName, { points: [], ids: [] });
        byVillage.get(vName)!.points.push({ lat: Number(h.lat), lon: Number(h.lon) });
        byVillage.get(vName)!.ids.push(h.id);
      } else {
        inconnuPoints.push({ h, p: { lat: Number(h.lat), lon: Number(h.lon) } });
      }
    }

    // ── Simple DBSCAN fallback for Points without village ─────────────
    // This creates "proximity zones" for households without village names
    const MAX_DIST = 0.015; // ~1.5km
    const clusters: Point[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < inconnuPoints.length; i++) {
      if (used.has(i)) continue;
      const currentCluster: Point[] = [inconnuPoints[i].p];
      used.add(i);

      for (let j = i + 1; j < inconnuPoints.length; j++) {
        if (used.has(j)) continue;
        const dist = Math.sqrt(
          Math.pow(inconnuPoints[i].p.lat - inconnuPoints[j].p.lat, 2) +
            Math.pow(inconnuPoints[i].p.lon - inconnuPoints[j].p.lon, 2)
        );
        if (dist < MAX_DIST) {
          currentCluster.push(inconnuPoints[j].p);
          used.add(j);
        }
      }
      clusters.push(currentCluster);
    }

    // Add proximity clusters to byVillage with unique names
    clusters.forEach((pts, idx) => {
      byVillage.set(`Zone Proximité ${idx + 1}`, { points: pts, ids: [] });
    });

    const zonesFeatures: {
      type: string;
      geometry: { type: string; coordinates: number[][][] };
      properties: Record<string, unknown>;
    }[] = [];
    const centroidFeatures: {
      type: string;
      geometry: { type: string; coordinates: number[] };
      properties: Record<string, unknown>;
    }[] = [];
    const panelData: { village: string; count: number; color: string }[] = [];

    let colorIdx = 0;
    for (const [village, { points, ids }] of byVillage) {
      if (points.length === 0) continue;
      const color = VILLAGE_COLORS[colorIdx % VILLAGE_COLORS.length];
      colorIdx++;

      // Centroid
      const cx = points.reduce((s, p) => s + p.lon, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.lat, 0) / points.length;

      let ring: [number, number][];

      if (points.length === 1) {
        // Single point → Trapeze/Diamond approximation
        const r = BUFFER_DEG * 3;
        ring = [
          [cx, cy + r], // North
          [cx + r, cy], // East
          [cx, cy - r], // South
          [cx - r, cy], // West
          [cx, cy + r], // Close
        ];
      } else if (points.length === 2) {
        // Two points → Rectangular-ish "trapeze"
        const r = BUFFER_DEG * 2.5;
        const p1 = points[0];
        const p2 = points[1];
        // Simple bounding box with buffer
        const minX = Math.min(p1.lon, p2.lon) - r;
        const maxX = Math.max(p1.lon, p2.lon) + r;
        const minY = Math.min(p1.lat, p2.lat) - r;
        const maxY = Math.max(p1.lat, p2.lat) + r;
        ring = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ];
      } else {
        const hull = convexHull(points);
        const buffered = bufferHull(hull);
        ring = buffered.map((p) => [p.lon, p.lat]);
      }

      zonesFeatures.push({
        type: 'Feature',
        properties: { village, count: points.length, color },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });

      centroidFeatures.push({
        type: 'Feature',
        properties: { village, count: points.length, color },
        geometry: { type: 'Point', coordinates: [cx, cy] },
      });

      panelData.push({
        id: village,
        name: village,
        count: points.length,
        type: 'village',
        bbox: computeBBox(points),
        color,
      });
    }

    self.postMessage({
      success: true,
      zones: { type: 'FeatureCollection', features: zonesFeatures },
      centroids: { type: 'FeatureCollection', features: centroidFeatures },
      panelData,
    });
  } catch (e: unknown) {
    self.postMessage({ success: false, error: e.message });
  }
};
