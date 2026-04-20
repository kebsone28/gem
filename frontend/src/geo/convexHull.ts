/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import type { SpatialPoint } from './spatialIndex';

// Algorithme Monotone Chain (Andrew's algorithm) pour l'enveloppe convexe. Complexité O(n log n).
export function convexHull(points: SpatialPoint[]): SpatialPoint[] {
  if (points.length <= 3) return points;

  // Trier les points lexicographiquement (d'abord par X, puis par Y)
  const sorted = [...points].sort((a, b) => {
    if (a.lon !== b.lon) return a.lon - b.lon;
    return a.lat - b.lat;
  });

  const cross = (o: SpatialPoint, a: SpatialPoint, b: SpatialPoint) => {
    return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
  };

  const lower: SpatialPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: SpatialPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Le dernier point de chaque moitié est le premier point de l'autre moitié
  upper.pop();
  lower.pop();

  return lower.concat(upper);
}
