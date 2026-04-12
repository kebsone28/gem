import type RBush from 'rbush';
import { haversine } from './haversine';
import { type SpatialPoint, type RBushItem, findNeighborsInBox } from './spatialIndex';

// eps: distance in km, minPts: minimum number of points to form a dense region
// epsDeg: approximate conversion of eps to degrees for fast RBush bounding box queries (1 deg ~ 111 km)
export function dbscan(
  points: SpatialPoint[],
  tree: RBush<RBushItem>,
  epsKm: number = 0.15,
  minPts: number = 5
): SpatialPoint[][] {
  const clusters: SpatialPoint[][] = [];
  const visited = new Set<string>();
  const epsDeg = epsKm / 111; // Conversion approximative km -> degrés pour le R-Tree bbox

  function regionQuery(p: SpatialPoint): SpatialPoint[] {
    // Fast search with bounding box
    const roughNeighbors = findNeighborsInBox(tree, p, epsDeg);
    // Precise filter with Haversine distance
    return roughNeighbors.filter((q) => haversine(p.lat, p.lon, q.lat, q.lon) <= epsKm);
  }

  for (const p of points) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const neighbors = regionQuery(p);

    if (neighbors.length < minPts) continue;

    const cluster: SpatialPoint[] = [];
    const queue = [...neighbors];

    while (queue.length) {
      const q = queue.pop()!;

      if (!visited.has(q.id)) {
        visited.add(q.id);

        const n2 = regionQuery(q);
        if (n2.length >= minPts) {
          queue.push(...n2);
        }
      }

      // Eviter les duplicatas
      if (!cluster.find((c) => c.id === q.id)) {
        cluster.push(q);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// Isochrone DBSCAN: Uses a precomputed travel time matrix (seconds) instead of Haversine
// epsTime: maximum travel time in seconds to be considered a neighbor (e.g., 300s = 5 mins)
export function isochroneDbscan(
  points: SpatialPoint[],
  timeMatrix: number[][],
  epsTime: number = 300,
  minPts: number = 3
): SpatialPoint[][] {
  const clusters: SpatialPoint[][] = [];
  const visited = new Set<number>();

  function regionQuery(pIdx: number): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (i === pIdx) continue;
      // timeMatrix[pIdx][i] -> travel time from pIdx to i
      const time = timeMatrix[pIdx][i];
      if (time !== undefined && time <= epsTime) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const neighbors = regionQuery(i);

    if (neighbors.length < minPts) continue;

    const clusterPts: SpatialPoint[] = [];
    // Map indices to SpatialPoints
    const clusterIndices = new Set<number>([i]);
    const queue = [...neighbors];

    while (queue.length > 0) {
      const qIdx = queue.pop()!;

      if (!visited.has(qIdx)) {
        visited.add(qIdx);
        const n2 = regionQuery(qIdx);
        if (n2.length >= minPts) {
          for (const n of n2) {
            if (!clusterIndices.has(n)) {
              queue.push(n);
              clusterIndices.add(n);
            }
          }
        }
      }
      clusterIndices.add(qIdx);
    }

    clusterIndices.forEach((idx) => clusterPts.push(points[idx]));
    clusters.push(clusterPts);
  }

  return clusters;
}
