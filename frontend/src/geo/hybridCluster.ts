/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import simplify from '@turf/simplify';
import convex from '@turf/convex';
import buffer from '@turf/buffer';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import logger from '../utils/logger';
import { featureCollection, point as turfPoint } from '@turf/helpers';
import { dbscan, isochroneDbscan } from './dbscan';
import { kmeans } from './kmeans';
import { buildSpatialIndex, type SpatialPoint } from './spatialIndex';
import { haversine } from './haversine';
import { getTravelTimeMatrix } from './osrm';

export interface ClusterResult {
  id: string;
  type: 'dense' | 'kmeans' | 'isolated';
  households: SpatialPoint[];
  centroid: { lat: number; lon: number };
}

// Configuration Centralisée PROQUELEC
const CLUSTER_CONFIG = {
  // 3 Tiers de densité (Points par km²)
  tiers: {
    deepRural: { densityMax: 20, eps: 0.6, minPts: 2 },
    semiUrban: { densityMax: 100, eps: 0.4, minPts: 4 },
    urban: { densityMax: Infinity, eps: 0.25, minPts: 5 },
  },
  defaultBuffer: 0.03, // 30 mètres
  smallClusterBuffer: 0.05, // 50 mètres pour visibilité
  maxInCluster: 80,
};

export async function hybridCluster(
  households: SpatialPoint[],
  maxHouseholdsPerCluster = CLUSTER_CONFIG.maxInCluster
): Promise<ClusterResult[]> {
  if (!households.length) return [];

  const tree = buildSpatialIndex(households);

  // 1. Détection de la densité locale dynamique
  const lats = households.map((h) => h.lat);
  const lons = households.map((h) => h.lon);

  // Estimation grossière de la surface (box)
  const latDiff = Math.max(...lats) - Math.min(...lats);
  const lonDiff = Math.max(...lons) - Math.min(...lons);
  const areaKm2 = latDiff * 111 * (lonDiff * 111 * Math.cos((lats[0] * Math.PI) / 180)) || 0.1;

  const globalDensity = households.length / areaKm2;

  // Sélection des paramètres DBSCAN basés sur la densité globale
  let config = CLUSTER_CONFIG.tiers.urban;
  if (globalDensity < CLUSTER_CONFIG.tiers.deepRural.densityMax) {
    config = CLUSTER_CONFIG.tiers.deepRural;
  } else if (globalDensity < CLUSTER_CONFIG.tiers.semiUrban.densityMax) {
    config = CLUSTER_CONFIG.tiers.semiUrban;
  }

  logger.log(
    `🔍 [CLUSTERING] Densité: ${globalDensity.toFixed(2)} pts/km². Tier: ${globalDensity < 20 ? 'RURAL' : globalDensity < 100 ? 'SEMI' : 'URBAIN'}`
  );

  // 2. DBSCAN Adaptatif
  const macroClusters = dbscan(households, tree, config.eps, config.minPts);

  const result: ClusterResult[] = [];

  const processFinalGroup = (pts: SpatialPoint[], isIsochrone: boolean) => {
    if (pts.length > maxHouseholdsPerCluster) {
      const k = Math.ceil(pts.length / maxHouseholdsPerCluster);
      const centroids = kmeans(pts, k);
      const groups: SpatialPoint[][] = Array.from({ length: k }, () => []);

      pts.forEach((p) => {
        let bestIdx = 0,
          bestDist = Infinity;
        centroids.forEach((c, idx) => {
          const d = haversine(p.lat, p.lon, c.lat, c.lon);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        groups[bestIdx].push(p);
      });

      groups.forEach((g, idx) => {
        if (g.length > 0)
          result.push({ id: '', type: 'kmeans', households: g, centroid: centroids[idx] });
      });
    } else if (pts.length > 0) {
      const centroidLat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
      const centroidLon = pts.reduce((sum, p) => sum + p.lon, 0) / pts.length;
      result.push({
        id: '',
        type: isIsochrone ? 'dense' : 'isolated',
        households: pts,
        centroid: { lat: centroidLat, lon: centroidLon },
      });
    }
  };

  for (const macroCluster of macroClusters) {
    if (macroCluster.length > 500) {
      processFinalGroup(macroCluster, false);
      continue;
    }

    // Pour les groupes moyens, on peut tenter l'isochrone (OSRM)
    const timeMatrix = await getTravelTimeMatrix(macroCluster);
    if (timeMatrix) {
      const microClusters = isochroneDbscan(macroCluster, timeMatrix, 300, 3);
      for (const micro of microClusters) {
        processFinalGroup(micro, true);
      }
    } else {
      processFinalGroup(macroCluster, false);
    }
  }

  // Déterminer la région majoritaire de chaque cluster pour le tri
  result.forEach((c) => {
    let region = '';
    for (const h of c.households) {
      if (h.region) {
        region = h.region;
        break; // On prend la première région valide trouvée (les ménages d'un même cluster sont proches et généralement de la même région)
      }
    }
    (c as any)._region = region;
  });

  // Trier les clusters par ordre alphabétique de la région
  result.sort((a, b) => {
    const rA = (a as any)._region || 'ZZZ';
    const rB = (b as any)._region || 'ZZZ';
    return rA.localeCompare(rB);
  });

  // Attribuer les ID de manière séquentielle, de Kaffrine à Tamba
  let counter = 1;
  result.forEach((c) => {
    c.id = `G-${counter++}`;
  });

  return result;
}

export const getClusterName = (c: ClusterResult) => {
  const villageCounts: Record<string, number> = {};
  let dominantVillage = '';
  let maxCount = 0;
  let region = '';
  for (const h of c.households) {
    if (h.region) region = region || h.region;
    if (h.village) {
      const vlName =
        h.village.trim().charAt(0).toUpperCase() + h.village.trim().slice(1).toLowerCase();
      villageCounts[vlName] = (villageCounts[vlName] || 0) + 1;
      if (villageCounts[vlName] > maxCount) {
        maxCount = villageCounts[vlName];
        dominantVillage = vlName;
      }
    }
  }
  const baseName = `G${c.id.replace('G-', '')}`;
  if (dominantVillage)
    return region ? `${region} – ${dominantVillage} ${baseName}` : `${dominantVillage} ${baseName}`;
  if (region) return `${region} – ${baseName}`;
  return `Grappe ${c.id.replace('G-', '')}`;
};

export function clustersToGeoJSON(clusters: ClusterResult[]): any {
  const collection = featureCollection([]);

  clusters.forEach((c, i) => {
    if (!c.households || c.households.length === 0) return;

    try {
      const points = featureCollection(c.households.map((h) => turfPoint([h.lon, h.lat])));

      // 1. Enveloppe Convexe avec Turf
      let poly = convex(points);

      // 2. Sécurité : Fallback si convex retourne null (ex: points alignés ou < 3 points)
      if (!poly) {
        // Créer un petit buffer autour des points pour simuler une zone
        poly = buffer(points, 0.015, { units: 'kilometers' }) as any;
      }

      if (!poly) return;

      // 3. Buffer de sécurité adaptatif
      const bufferSize =
        c.households.length < 5 ? CLUSTER_CONFIG.smallClusterBuffer : CLUSTER_CONFIG.defaultBuffer;
      let buffered = buffer(poly, bufferSize, { units: 'kilometers' });
      if (!buffered) return;

      // 4. Garantie Inclusion 100%
      let needsInflation = false;
      for (const h of c.households) {
        if (
          !booleanPointInPolygon(turfPoint([h.lon, h.lat]), buffered as any)
        ) {
          needsInflation = true;
          break;
        }
      }
      if (needsInflation && buffered) {
        buffered = buffer(buffered as any, 0.01, {
          units: 'kilometers',
        }) as any;
      }

      if (!buffered) return;

      // 5. Propriétés
      const intId = parseInt(c.id.replace(/\D/g, '')) || 1000 + i;
      buffered.properties = {
        id: c.id,
        name: getClusterName(c),
        count: c.households.length,
        type: c.type,
        centroidX: c.centroid.lon,
        centroidY: c.centroid.lat,
      };

      // 6. Simplification pour fluidité (Tolerance 10m env.)
      const optimized = simplify(buffered as any, {
        tolerance: 0.0001,
        highQuality: false,
      });
      (optimized as any).id = intId;

      collection.features.push(optimized as any);
    } catch (e) {
      logger.error('❌ [GEO ERROR] Polygone non généré:', e);
    }
  });

  return collection as any;
}

// GeoJSON "Centroids" pour les labels HTML / MapLibre (symbol layer)
export function centroidsToGeoJSON(clusters: ClusterResult[]): any {
  return {
    type: 'FeatureCollection',
    features: clusters.map((c, i) => {
      const intId = parseInt(c.id.replace(/\D/g, '')) || i;
      return {
        type: 'Feature',
        id: intId,
        properties: {
          id: c.id,
          name: getClusterName(c),
          count: c.households.length,
        },
        geometry: {
          type: 'Point',
          coordinates: [c.centroid.lon, c.centroid.lat],
        },
      };
    }),
  };
}
