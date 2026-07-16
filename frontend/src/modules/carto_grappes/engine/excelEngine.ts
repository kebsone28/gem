/**
 * excelEngine.ts
 * Module contenant les algorithmes de calcul géographique et de clustering.
 */

import { haversine as haversineDistance } from '../../../geo/haversine';
import type { Village, Menage } from '../types';

/**
 * Algorithme k-means pour répartir les villages ou ménages dans un nombre défini de grappes.
 * @param points Liste d'objets contenant des coordonnées lat/lon
 * @param k Nombre de grappes (K)
 * @returns Tableau d'affectations (index correspondant à l'index du point, valeur = numéro de grappe de 1 à K)
 */
export function kmeansCluster(points: { lat: number; lon: number }[], k: number): number[] {
  if (points.length === 0) return [];
  if (k <= 0) return points.map(() => 1);
  if (k >= points.length) return points.map((_, i) => (i % k) + 1);

  // 1. Initialisation des centroïdes (méthode simple : K points répartis uniformément)
  const centroids: { lat: number; lon: number }[] = [];
  const step = Math.floor(points.length / k);
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * step, points.length - 1);
    centroids.push({ lat: points[idx].lat, lon: points[idx].lon });
  }

  const assignments = new Array<number>(points.length).fill(0);
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // A. Affectation de chaque point au centroïde le plus proche
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let minDist = Infinity;
      let closestCentroid = 0;

      for (let c = 0; c < k; c++) {
        const d = haversineDistance(p.lat, p.lon, centroids[c].lat, centroids[c].lon);
        if (d < minDist) {
          minDist = d;
          closestCentroid = c;
        }
      }

      const clusterNum = closestCentroid + 1;
      if (assignments[i] !== clusterNum) {
        assignments[i] = clusterNum;
        changed = true;
      }
    }

    // B. Recalcul des centroïdes
    const sumLat = new Array<number>(k).fill(0);
    const sumLon = new Array<number>(k).fill(0);
    const counts = new Array<number>(k).fill(0);

    for (let i = 0; i < points.length; i++) {
      const cIdx = assignments[i] - 1;
      sumLat[cIdx] += points[i].lat;
      sumLon[cIdx] += points[i].lon;
      counts[cIdx]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = {
          lat: sumLat[c] / counts[c],
          lon: sumLon[c] / counts[c],
        };
      }
    }
  }

  return assignments;
}

/**
 * Algorithme du Plus Proche Voisin (Nearest Neighbor) pour trier géographiquement une liste de points.
 * Permet d'ordonner les visites terrain de façon optimale.
 */
export function sortByNearestNeighbor<T extends { lat?: number; lon?: number; x?: number; y?: number }>(
  items: T[],
  startIdx = 0,
): T[] {
  if (items.length <= 1) return items;

  const result: T[] = [];
  const unvisited = [...items];
  
  // Extraire le point de départ
  let current = unvisited.splice(startIdx, 1)[0];
  result.push(current);

  const getDistance = (a: T, b: T): number => {
    if (a.lat !== undefined && a.lon !== undefined && b.lat !== undefined && b.lon !== undefined) {
      return haversineDistance(a.lat, a.lon, b.lat, b.lon);
    }
    if (a.x !== undefined && a.y !== undefined && b.x !== undefined && b.y !== undefined) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    return 0;
  };

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = getDistance(current, unvisited[i]);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0];
    result.push(current);
  }

  return result;
}

/**
 * Projette des coordonnées géographiques (latitude, longitude) sur une grille SVG 2D plane (x, y).
 * Calcule dynamiquement le cadrage optimal (Bounding Box) pour s'adapter à VIEW_W et VIEW_H.
 */
export function projectCoordinatesToSVG(
  points: { lat: number; lon: number }[],
  viewW: number,
  viewH: number,
  padding = 40,
): { x: number; y: number }[] {
  if (points.length === 0) return [];

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  points.forEach((p) => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  });

  const latSpan = maxLat - minLat || 1;
  const lonSpan = maxLon - minLon || 1;

  // Calcul du ratio d'aspect pour conserver les proportions
  const scaleX = (viewW - padding * 2) / lonSpan;
  const scaleY = (viewH - padding * 2) / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (viewW - lonSpan * scale) / 2;
  const offsetY = (viewH - latSpan * scale) / 2;

  return points.map((p) => {
    // En SVG, l'axe Y va vers le bas, donc maxLat correspond au haut (offsetY)
    return {
      x: offsetX + (p.lon - minLon) * scale,
      y: viewH - (offsetY + (p.lat - minLat) * scale),
    };
  });
}
