/* eslint-disable @typescript-eslint/no-explicit-any */
import RBush from 'rbush';

export interface SpatialPoint {
  id: string;
  lat: number;
  lon: number;
  [key: string]: any;
}

export interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  data: SpatialPoint;
}

export function buildSpatialIndex(points: SpatialPoint[]): RBush<RBushItem> {
  const tree = new RBush<RBushItem>();

  const items = points.map((p) => ({
    minX: p.lon,
    minY: p.lat,
    maxX: p.lon,
    maxY: p.lat,
    data: p,
  }));

  tree.load(items);
  return tree;
}

// Recherche les voisins dans un rayon grossier "eps" (en degrés de latitude/longitude ~ approché).
// On filtre ensuite précisément par haversine si nécessaire, mais le R-Tree réduit O(n^2) à O(log n).
export function findNeighborsInBox(
  tree: RBush<RBushItem>,
  point: SpatialPoint,
  epsDeg: number
): SpatialPoint[] {
  const bbox = {
    minX: point.lon - epsDeg,
    minY: point.lat - epsDeg,
    maxX: point.lon + epsDeg,
    maxY: point.lat + epsDeg,
  };
  return tree.search(bbox).map((res) => res.data);
}
