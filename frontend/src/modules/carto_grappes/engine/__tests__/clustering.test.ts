import { describe, expect, it } from 'vitest';
import {
  haversineDistance,
  kMeansClustering,
  hierarchicalClustering,
  densityBasedClustering,
  createGrappeClusters,
  suggestMenagesForNewGrappe,
  calculateClusterDistances,
  findNearestClusters,
  scoreClustering,
  optimizeClustering,
  suggestBestConfiguration,
} from '../clustering';
import type { Village, Menage, GpsEntry, GrappeCluster, ClusteringConfig } from '../../types';

/* ── Helper data ── */

const KAFFRINE_VILLAGES: Village[] = [
  { region: 'Kaffrine', village: 'Nguelou', n: 30, lat: 14.0300, lon: -16.0200, defaultGrappe: 1, x: 0, y: 0, r: 0 },
  { region: 'Kaffrine', village: 'Kaffrine', n: 50, lat: 14.0433, lon: -15.9650, defaultGrappe: 2, x: 0, y: 0, r: 0 },
  { region: 'Kaffrine', village: 'Mouit', n: 20, lat: 14.1000, lon: -15.9000, defaultGrappe: 3, x: 0, y: 0, r: 0 },
  { region: 'Tambacounda', village: 'Tamba', n: 40, lat: 13.7700, lon: -13.6700, defaultGrappe: 4, x: 0, y: 0, r: 0 },
];

function makeMenages(count: number, region: string, villageBase = 'Nguelou'): Menage[] {
  return Array.from({ length: count }, (_, i) => ({
    ordre: i + 1,
    nom: `M${i + 1}`,
    tel: `77${String(i).padStart(6, '0')}`,
    village: i % 2 === 0 ? villageBase : 'Kaffrine',
    commune: 'Kaffrine',
    region,
  }));
}

function makeGps(menages: Menage[], offset = 0): GpsEntry {
  const gps: GpsEntry = {};
  menages.forEach((m, i) => {
    gps[m.ordre.toString()] = [14.03 + i * 0.001 + offset, -16.02 + i * 0.001 + offset, 5];
  });
  return gps;
}

const DEFAULT_CONFIG: ClusteringConfig = {
  enabled: true,
  maxDistance: 5,
  minMenagesPerGrappe: 2,
  maxMenagesPerGrappe: 500,
  preferredGrappeCount: 3,
  algorithm: 'kmeans',
};

/* ── Tests ── */

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(14.03, -16.02, 14.03, -16.02)).toBeCloseTo(0, 2);
  });

  it('calculates distance between Dakar and Kaffrine (~170 km)', () => {
    const d = haversineDistance(14.7167, -17.4677, 14.0433, -15.9650);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(220);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(14.03, -16.02, 14.10, -15.90);
    const d2 = haversineDistance(14.10, -15.90, 14.03, -16.02);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('returns distance in km between ~1km apart points', () => {
    const d = haversineDistance(14.030, -16.020, 14.039, -16.020);
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.5);
  });
});

describe('kMeansClustering', () => {
  it('returns empty for empty points', () => {
    expect(kMeansClustering([], 3)).toEqual([]);
  });

  it('returns empty for k <= 0', () => {
    expect(kMeansClustering([{ ordre: 1, lat: 14, lon: -16 }], 0)).toEqual([]);
  });

  it('returns k clusters when k >= points.length', () => {
    const pts = [
      { ordre: 1, lat: 14, lon: -16 },
      { ordre: 2, lat: 14.1, lon: -15.9 },
    ];
    const result = kMeansClustering(pts, 5);
    expect(result).toHaveLength(2);
  });

  it('returns exactly k clusters for well-separated points', () => {
    const pts = [
      { ordre: 1, lat: 14.00, lon: -16.00 },
      { ordre: 2, lat: 14.01, lon: -16.00 },
      { ordre: 3, lat: 14.50, lon: -15.50 },
      { ordre: 4, lat: 14.51, lon: -15.50 },
      { ordre: 5, lat: 13.50, lon: -16.50 },
      { ordre: 6, lat: 13.51, lon: -16.50 },
    ];
    const result = kMeansClustering(pts, 3);
    expect(result).toHaveLength(3);
  });

  it('every point is assigned to exactly one cluster', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({
      ordre: i + 1,
      lat: 14 + Math.random() * 0.1,
      lon: -16 + Math.random() * 0.1,
    }));
    const result = kMeansClustering(pts, 4);
    const allOrdres = result.flatMap(c => c.points);
    expect(new Set(allOrdres).size).toBe(20);
  });

  it('respects maxIterations', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({
      ordre: i + 1,
      lat: 14 + Math.random() * 0.1,
      lon: -16 + Math.random() * 0.1,
    }));
    const result = kMeansClustering(pts, 5, 2);
    expect(result).toHaveLength(5);
    const allOrdres = result.flatMap(c => c.points);
    expect(new Set(allOrdres).size).toBe(50);
  });
});

describe('hierarchicalClustering', () => {
  it('returns empty for empty points', () => {
    expect(hierarchicalClustering([], 5)).toEqual([]);
  });

  it('merges nearby points within maxDistance', () => {
    const pts = [
      { ordre: 1, lat: 14.000, lon: -16.000 },
      { ordre: 2, lat: 14.001, lon: -16.001 },
      { ordre: 3, lat: 14.100, lon: -15.900 },
    ];
    const result = hierarchicalClustering(pts, 10);
    expect(result.length).toBeLessThanOrEqual(2);
    const allOrdres = result.flatMap(c => c.points);
    expect(new Set(allOrdres).size).toBe(3);
  });

  it('never merges when maxDistance is very small', () => {
    const pts = [
      { ordre: 1, lat: 14.00, lon: -16.00 },
      { ordre: 2, lat: 14.05, lon: -15.95 },
      { ordre: 3, lat: 14.10, lon: -15.90 },
    ];
    const result = hierarchicalClustering(pts, 0.001);
    expect(result).toHaveLength(3);
  });

  it('merges all into one when maxDistance is huge', () => {
    const pts = [
      { ordre: 1, lat: 14.00, lon: -16.00 },
      { ordre: 2, lat: 14.05, lon: -15.95 },
      { ordre: 3, lat: 14.10, lon: -15.90 },
    ];
    const result = hierarchicalClustering(pts, 10000);
    expect(result).toHaveLength(1);
    expect(result[0].points).toHaveLength(3);
  });
});

describe('densityBasedClustering', () => {
  it('returns empty for empty points', () => {
    expect(densityBasedClustering([], 1, 3)).toEqual([]);
  });

  it('creates clusters for dense regions', () => {
    const pts = [
      { ordre: 1, lat: 14.000, lon: -16.000 },
      { ordre: 2, lat: 14.001, lon: -16.001 },
      { ordre: 3, lat: 14.002, lon: -16.002 },
      { ordre: 4, lat: 14.003, lon: -16.003 },
      { ordre: 5, lat: 14.100, lon: -15.900 },
    ];
    const result = densityBasedClustering(pts, 1, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const allOrdres = result.flatMap(c => c.points);
    expect(new Set(allOrdres).size).toBe(5);
  });

  it('isolated points become individual clusters', () => {
    const pts = [
      { ordre: 1, lat: 14.00, lon: -16.00 },
      { ordre: 2, lat: 14.50, lon: -15.50 },
      { ordre: 3, lat: 13.50, lon: -16.50 },
    ];
    const result = densityBasedClustering(pts, 0.5, 3);
    expect(result).toHaveLength(3);
  });
});

describe('createGrappeClusters', () => {
  it('returns empty when clustering is disabled', () => {
    const config = { ...DEFAULT_CONFIG, enabled: false };
    const result = createGrappeClusters(KAFFRINE_VILLAGES, makeMenages(20, 'Kaffrine'), makeGps(makeMenages(20, 'Kaffrine')), config, 'Kaffrine');
    expect(result).toEqual([]);
  });

  it('returns empty for non-existent region', () => {
    const result = createGrappeClusters(KAFFRINE_VILLAGES, makeMenages(20, 'Kaffrine'), makeGps(makeMenages(20, 'Kaffrine')), DEFAULT_CONFIG, 'NonExistent');
    expect(result).toEqual([]);
  });

  it('filters clusters below minMenagesPerGrappe', () => {
    const config: ClusteringConfig = { ...DEFAULT_CONFIG, minMenagesPerGrappe: 50, preferredGrappeCount: 3 };
    const menages = makeMenages(10, 'Kaffrine');
    const result = createGrappeClusters(KAFFRINE_VILLAGES, menages, makeGps(menages), config, 'Kaffrine');
    expect(result).toEqual([]);
  });

  it('creates valid GrappeCluster objects', () => {
    const menages = makeMenages(30, 'Kaffrine');
    const gps = makeGps(menages);
    const result = createGrappeClusters(KAFFRINE_VILLAGES, menages, gps, DEFAULT_CONFIG, 'Kaffrine');
    expect(result.length).toBeGreaterThan(0);
    result.forEach(c => {
      expect(c.id).toContain('Kaffrine');
      expect(c.region).toBe('Kaffrine');
      expect(c.center.lat).toBeTypeOf('number');
      expect(c.center.lon).toBeTypeOf('number');
      expect(c.menageCount).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minMenagesPerGrappe);
      expect(c.averageDistance).toBeGreaterThanOrEqual(0);
    });
  });

  it('uses village coords as fallback when no GPS data', () => {
    const menages = makeMenages(20, 'Kaffrine');
    const emptyGps: GpsEntry = {};
    const config: ClusteringConfig = { ...DEFAULT_CONFIG, minMenagesPerGrappe: 5 };
    const result = createGrappeClusters(KAFFRINE_VILLAGES, menages, emptyGps, config, 'Kaffrine');
    expect(result.length).toBeGreaterThan(0);
  });

  it('supports hierarchical algorithm', () => {
    const config: ClusteringConfig = { ...DEFAULT_CONFIG, algorithm: 'hierarchical', maxDistance: 5, minMenagesPerGrappe: 2 };
    const menages = makeMenages(20, 'Kaffrine');
    const result = createGrappeClusters(KAFFRINE_VILLAGES, menages, makeGps(menages), config, 'Kaffrine');
    expect(result.length).toBeGreaterThan(0);
  });

  it('supports density algorithm', () => {
    const config: ClusteringConfig = { ...DEFAULT_CONFIG, algorithm: 'density', maxDistance: 5, minMenagesPerGrappe: 2 };
    const menages = makeMenages(20, 'Kaffrine');
    const result = createGrappeClusters(KAFFRINE_VILLAGES, menages, makeGps(menages), config, 'Kaffrine');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('suggestMenagesForNewGrappe', () => {
  it('returns empty when no unassigned menages', () => {
    const menages = makeMenages(5, 'Kaffrine');
    const gps = makeGps(menages);
    const existingCluster: GrappeCluster = {
      id: 'Kaffrine_1', region: 'Kaffrine', grappeNumber: 1,
      center: { lat: 14.03, lon: -16.02 },
      menages: menages.map(m => m.ordre),
      villageCount: 1, menageCount: 5, averageDistance: 0.5,
    };
    const result = suggestMenagesForNewGrappe(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', [existingCluster]);
    expect(result).toEqual([]);
  });

  it('suggests nearby menages within maxDistance', () => {
    const menages = makeMenages(10, 'Kaffrine');
    const gps = makeGps(menages);
    const result = suggestMenagesForNewGrappe(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', [], 10);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('returns empty for non-existent region', () => {
    const result = suggestMenagesForNewGrappe(KAFFRINE_VILLAGES, makeMenages(10, 'X'), makeGps(makeMenages(10, 'X')), 'NoWhere', []);
    expect(result).toEqual([]);
  });
});

describe('calculateClusterDistances', () => {
  it('returns empty for 0 or 1 clusters', () => {
    expect(calculateClusterDistances([])).toEqual([]);
    const one: GrappeCluster[] = [{ id: 'A_1', region: 'A', grappeNumber: 1, center: { lat: 14, lon: -16 }, menages: [1], villageCount: 1, menageCount: 1, averageDistance: 0 }];
    expect(calculateClusterDistances(one)).toEqual([]);
  });

  it('returns n*(n-1)/2 distances for n clusters', () => {
    const clusters: GrappeCluster[] = [
      { id: 'A_1', region: 'A', grappeNumber: 1, center: { lat: 14.0, lon: -16.0 }, menages: [1], villageCount: 1, menageCount: 1, averageDistance: 0 },
      { id: 'A_2', region: 'A', grappeNumber: 2, center: { lat: 14.1, lon: -15.9 }, menages: [2], villageCount: 1, menageCount: 1, averageDistance: 0 },
      { id: 'A_3', region: 'A', grappeNumber: 3, center: { lat: 13.9, lon: -16.1 }, menages: [3], villageCount: 1, menageCount: 1, averageDistance: 0 },
    ];
    const distances = calculateClusterDistances(clusters);
    expect(distances).toHaveLength(3);
    expect(distances[0].distance).toBeLessThanOrEqual(distances[1].distance);
    expect(distances[1].distance).toBeLessThanOrEqual(distances[2].distance);
  });
});

describe('findNearestClusters', () => {
  it('returns nearest clusters excluding self', () => {
    const target: GrappeCluster = { id: 'A_1', region: 'A', grappeNumber: 1, center: { lat: 14.0, lon: -16.0 }, menages: [1], villageCount: 1, menageCount: 1, averageDistance: 0 };
    const all: GrappeCluster[] = [
      target,
      { id: 'A_2', region: 'A', grappeNumber: 2, center: { lat: 14.01, lon: -16.01 }, menages: [2], villageCount: 1, menageCount: 1, averageDistance: 0 },
      { id: 'A_3', region: 'A', grappeNumber: 3, center: { lat: 14.5, lon: -15.5 }, menages: [3], villageCount: 1, menageCount: 1, averageDistance: 0 },
    ];
    const result = findNearestClusters(target, all, 2);
    expect(result).toHaveLength(2);
    expect(result[0].cluster.id).toBe('A_2');
    expect(result[0].distance).toBeLessThan(result[1].distance);
  });
});

describe('scoreClustering', () => {
  it('returns Infinity for empty clusters', () => {
    expect(scoreClustering([])).toBe(Infinity);
  });

  it('returns lower score for balanced compact clusters', () => {
    const balanced: GrappeCluster[] = [
      { id: 'A_1', region: 'A', grappeNumber: 1, center: { lat: 14.0, lon: -16.0 }, menages: [1, 2, 3], villageCount: 1, menageCount: 3, averageDistance: 0.2 },
      { id: 'A_2', region: 'A', grappeNumber: 2, center: { lat: 14.1, lon: -15.9 }, menages: [4, 5, 6], villageCount: 1, menageCount: 3, averageDistance: 0.2 },
    ];
    const unbalanced: GrappeCluster[] = [
      { id: 'A_1', region: 'A', grappeNumber: 1, center: { lat: 14.0, lon: -16.0 }, menages: [1, 2], villageCount: 1, menageCount: 2, averageDistance: 0.2 },
      { id: 'A_2', region: 'A', grappeNumber: 2, center: { lat: 14.1, lon: -15.9 }, menages: [3, 4, 5, 6, 7, 8, 9, 10], villageCount: 2, menageCount: 8, averageDistance: 3.0 },
    ];
    expect(scoreClustering(balanced)).toBeLessThan(scoreClustering(unbalanced));
  });
});

describe('optimizeClustering', () => {
  it('returns empty for no data', () => {
    const result = optimizeClustering(KAFFRINE_VILLAGES, [], {}, 'Kaffrine', 3);
    expect(result).toEqual([]);
  });

  it('returns results sorted by score ascending', () => {
    const menages = makeMenages(50, 'Kaffrine');
    const gps = makeGps(menages);
    const result = optimizeClustering(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', 3, ['kmeans']);
    if (result.length > 1) {
      for (let i = 1; i < result.length; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i - 1].score);
      }
    }
  });

  it('returns at most 10 results', () => {
    const menages = makeMenages(50, 'Kaffrine');
    const gps = makeGps(menages);
    const result = optimizeClustering(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', 3);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('each result has config, clusters, score, metrics', () => {
    const menages = makeMenages(30, 'Kaffrine');
    const gps = makeGps(menages);
    const result = optimizeClustering(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', 3, ['kmeans']);
    if (result.length > 0) {
      const r = result[0];
      expect(r.config).toBeDefined();
      expect(r.clusters).toBeDefined();
      expect(r.score).toBeTypeOf('number');
      expect(r.metrics).toBeDefined();
      expect(r.metrics.avgMenages).toBeTypeOf('number');
      expect(r.metrics.stdDevMenages).toBeTypeOf('number');
      expect(r.metrics.avgIntraDistance).toBeTypeOf('number');
      expect(r.metrics.avgInterDistance).toBeTypeOf('number');
      expect(r.metrics.avgVillageRatio).toBeTypeOf('number');
    }
  });
});

describe('suggestBestConfiguration', () => {
  it('returns null for no data', () => {
    expect(suggestBestConfiguration(KAFFRINE_VILLAGES, [], {}, 'Kaffrine', 3)).toBeNull();
  });

  it('returns best config for valid data', () => {
    const menages = makeMenages(50, 'Kaffrine');
    const gps = makeGps(menages);
    const result = suggestBestConfiguration(KAFFRINE_VILLAGES, menages, gps, 'Kaffrine', 3);
    if (result) {
      expect(result.config).toBeDefined();
      expect(result.clusters.length).toBeGreaterThan(0);
      expect(result.score).toBeTypeOf('number');
    }
  });
});
