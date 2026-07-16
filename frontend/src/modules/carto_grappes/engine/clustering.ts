import type { Village, Menage, GpsEntry, ClusteringConfig, GrappeCluster, ClusterConfiguration } from '../types';

/**
 * Calcule la distance entre deux points GPS en utilisant la formule de Haversine
 * @returns Distance en kilomètres
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Algorithme K-Means pour le clustering géographique
 */
export function kMeansClustering(
  points: Array<{ ordre: number; lat: number; lon: number }>,
  k: number,
  maxIterations: number = 100
): Array<{ center: { lat: number; lon: number }; points: number[] }> {
  if (points.length === 0 || k <= 0) return [];
  if (k >= points.length) return points.map(p => ({ center: { lat: p.lat, lon: p.lon }, points: [p.ordre] }));

  // Initialisation aléatoire des centres
  let centers = points
    .sort(() => Math.random() - 0.5)
    .slice(0, k)
    .map(p => ({ lat: p.lat, lon: p.lon }));

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assigner chaque point au centre le plus proche
    const clusters: Array<{ center: { lat: number; lon: number }; points: number[] }> = 
      centers.map(c => ({ center: c, points: [] }));

    points.forEach(point => {
      let minDist = Infinity;
      let closestCenter = 0;

      centers.forEach((center, idx) => {
        const dist = haversineDistance(point.lat, point.lon, center.lat, center.lon);
        if (dist < minDist) {
          minDist = dist;
          closestCenter = idx;
        }
      });

      clusters[closestCenter].points.push(point.ordre);
    });

    // Recalculer les centres
    const newCenters = clusters.map(cluster => {
      if (cluster.points.length === 0) {
        // Garder l'ancien centre si le cluster est vide
        const originalCenter = centers[clusters.indexOf(cluster)];
        return originalCenter;
      }

      const clusterPoints = points.filter(p => cluster.points.includes(p.ordre));
      const avgLat = clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length;
      const avgLon = clusterPoints.reduce((sum, p) => sum + p.lon, 0) / clusterPoints.length;

      return { lat: avgLat, lon: avgLon };
    });

    // Vérifier la convergence
    const converged = centers.every((center, idx) => 
      haversineDistance(center.lat, center.lon, newCenters[idx].lat, newCenters[idx].lon) < 0.001
    );

    centers = newCenters;
    if (converged) break;
  }

  // Assignement final
  const finalClusters: Array<{ center: { lat: number; lon: number }; points: number[] }> = 
    centers.map(c => ({ center: c, points: [] }));

  points.forEach(point => {
    let minDist = Infinity;
    let closestCenter = 0;

    centers.forEach((center, idx) => {
      const dist = haversineDistance(point.lat, point.lon, center.lat, center.lon);
      if (dist < minDist) {
        minDist = dist;
        closestCenter = idx;
      }
    });

    finalClusters[closestCenter].points.push(point.ordre);
  });

  return finalClusters;
}

/**
 * Algorithme de clustering hiérarchique
 */
export function hierarchicalClustering(
  points: Array<{ ordre: number; lat: number; lon: number }>,
  maxDistance: number
): Array<{ center: { lat: number; lon: number }; points: number[] }> {
  if (points.length === 0) return [];

  const clusters: Array<{ center: { lat: number; lon: number }; points: number[] }> = 
    points.map(p => ({ center: { lat: p.lat, lon: p.lon }, points: [p.ordre] }));

  let changed = true;
  while (changed && clusters.length > 1) {
    changed = false;
    let bestMerge = -1;
    let minMergeDist = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = haversineDistance(
          clusters[i].center.lat, clusters[i].center.lon,
          clusters[j].center.lat, clusters[j].center.lon
        );

        if (dist < minMergeDist) {
          minMergeDist = dist;
          bestMerge = j;
        }
      }
    }

    if (bestMerge !== -1 && minMergeDist <= maxDistance) {
      // Fusionner les clusters
      const mergedPoints = [...clusters[0].points, ...clusters[bestMerge].points];
      const mergedPointsData = points.filter(p => mergedPoints.includes(p.ordre));
      
      const avgLat = mergedPointsData.reduce((sum, p) => sum + p.lat, 0) / mergedPointsData.length;
      const avgLon = mergedPointsData.reduce((sum, p) => sum + p.lon, 0) / mergedPointsData.length;

      clusters[0] = {
        center: { lat: avgLat, lon: avgLon },
        points: mergedPoints
      };
      clusters.splice(bestMerge, 1);
      changed = true;
    }
  }

  return clusters;
}

/**
 * Algorithme de clustering par densité (DBSCAN simplifié)
 */
export function densityBasedClustering(
  points: Array<{ ordre: number; lat: number; lon: number }>,
  eps: number,
  minPts: number
): Array<{ center: { lat: number; lon: number }; points: number[] }> {
  if (points.length === 0) return [];

  const visited = new Set<number>();
  const clusters: Array<{ center: { lat: number; lon: number }; points: number[] }> = [];

  for (const point of points) {
    if (visited.has(point.ordre)) continue;
    visited.add(point.ordre);

    const neighbors = points.filter(p => 
      haversineDistance(point.lat, point.lon, p.lat, p.lon) <= eps
    );

    if (neighbors.length < minPts) {
      // Point de bruit - créer un cluster individuel
      clusters.push({
        center: { lat: point.lat, lon: point.lon },
        points: [point.ordre]
      });
    } else {
      // Nouveau cluster
      const clusterPoints = [point.ordre];
      const clusterData = [point];

      // Étendre le cluster
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i];
        if (!visited.has(neighbor.ordre)) {
          visited.add(neighbor.ordre);
          const neighborNeighbors = points.filter(p => 
            haversineDistance(neighbor.lat, neighbor.lon, p.lat, p.lon) <= eps
          );

          if (neighborNeighbors.length >= minPts) {
            neighbors.push(...neighborNeighbors.filter(n => !visited.has(n.ordre)));
          }
        }

        if (!clusterPoints.includes(neighbor.ordre)) {
          clusterPoints.push(neighbor.ordre);
          clusterData.push(neighbor);
        }
      }

      // Calculer le centre du cluster
      const avgLat = clusterData.reduce((sum, p) => sum + p.lat, 0) / clusterData.length;
      const avgLon = clusterData.reduce((sum, p) => sum + p.lon, 0) / clusterData.length;

      clusters.push({
        center: { lat: avgLat, lon: avgLon },
        points: clusterPoints
      });
    }
  }

  return clusters;
}

/**
 * Fonction principale de clustering avec configuration
 */
export function createGrappeClusters(
  villages: Village[],
  menages: Menage[],
  gps: GpsEntry,
  config: ClusteringConfig,
  region: string
): GrappeCluster[] {
  if (!config.enabled) return [];

  // Filtrer les ménages par région
  const regionMenages = menages.filter(m => m.region === region);
  if (regionMenages.length === 0) return [];

  // Récupérer les coordonnées GPS des ménages
  const points: Array<{ ordre: number; lat: number; lon: number }> = [];

  regionMenages.forEach(menage => {
    const gpsData = gps[menage.ordre.toString()];
    if (gpsData && gpsData.length >= 2) {
      points.push({
        ordre: menage.ordre,
        lat: gpsData[0],
        lon: gpsData[1]
      });
    } else {
      // Fallback: utiliser les coordonnées du village
      const village = villages.find(v => v.village === menage.village && v.region === menage.region);
      if (village) {
        points.push({
          ordre: menage.ordre,
          lat: village.lat,
          lon: village.lon
        });
      }
    }
  });

  if (points.length === 0) return [];

  let clusters: Array<{ center: { lat: number; lon: number }; points: number[] }>;

  // Appliquer l'algorithme sélectionné
  switch (config.algorithm) {
    case 'kmeans':
      clusters = kMeansClustering(points, config.preferredGrappeCount);
      break;
    case 'hierarchical':
      clusters = hierarchicalClustering(points, config.maxDistance);
      break;
    case 'density':
      clusters = densityBasedClustering(points, config.maxDistance, config.minMenagesPerGrappe);
      break;
    default:
      clusters = kMeansClustering(points, config.preferredGrappeCount);
  }

  // Post-traitement: respecter les limites de taille
  clusters = clusters.filter(cluster => 
    cluster.points.length >= config.minMenagesPerGrappe
  );

  // Convertir en GrappeCluster
  return clusters.map((cluster, index) => {
    const clusterMenages = menages.filter(m => cluster.points.includes(m.ordre));
    const villagesInCluster = new Set(clusterMenages.map(m => m.village));

    // Calculer la distance moyenne au centre
    const clusterPoints = points.filter(p => cluster.points.includes(p.ordre));
    const avgDistance = clusterPoints.reduce((sum, p) => 
      sum + haversineDistance(p.lat, p.lon, cluster.center.lat, cluster.center.lon), 0
    ) / clusterPoints.length;

    return {
      id: `${region}_${index + 1}`,
      region,
      grappeNumber: index + 1,
      center: cluster.center,
      menages: cluster.points,
      villageCount: villagesInCluster.size,
      menageCount: cluster.points.length,
      averageDistance: avgDistance
    };
  });
}

/**
 * Suggère des ménages pour une nouvelle grappe basée sur la proximité
 */
export function suggestMenagesForNewGrappe(
  villages: Village[],
  menages: Menage[],
  gps: GpsEntry,
  region: string,
  existingClusters: GrappeCluster[],
  maxDistance: number = 5
): Menage[] {
  // Récupérer les ménages non assignés de la région
  const regionMenages = menages.filter(m => m.region === region);
  const assignedMenages = new Set(
    existingClusters.flatMap(c => c.menages)
  );
  const unassignedMenages = regionMenages.filter(m => !assignedMenages.has(m.ordre));

  if (unassignedMenages.length === 0) return [];

  // Trouver le centre de la région (moyenne des positions)
  const points: Array<{ ordre: number; lat: number; lon: number }> = [];

  unassignedMenages.forEach(menage => {
    const gpsData = gps[menage.ordre.toString()];
    if (gpsData && gpsData.length >= 2) {
      points.push({
        ordre: menage.ordre,
        lat: gpsData[0],
        lon: gpsData[1]
      });
    } else {
      const village = villages.find(v => v.village === menage.village && v.region === menage.region);
      if (village) {
        points.push({
          ordre: menage.ordre,
          lat: village.lat,
          lon: village.lon
        });
      }
    }
  });

  if (points.length === 0) return [];

  // Trouver le point le plus central
  const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;

  // Sélectionner les points dans le rayon maxDistance
  const nearbyPoints = points.filter(p => 
    haversineDistance(p.lat, p.lon, centerLat, centerLon) <= maxDistance
  );

  return nearbyPoints
    .map(p => unassignedMenages.find(m => m.ordre === p.ordre)!)
    .slice(0, 50); // Limiter à 50 suggestions
}

/**
 * Calcule la matrice de distances entre les grappes
 */
export function calculateClusterDistances(clusters: GrappeCluster[]): Array<{
  from: string;
  to: string;
  distance: number;
}> {
  const distances: Array<{ from: string; to: string; distance: number }> = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cluster1 = clusters[i];
      const cluster2 = clusters[j];
      
      const distance = haversineDistance(
        cluster1.center.lat, cluster1.center.lon,
        cluster2.center.lat, cluster2.center.lon
      );

      distances.push({
        from: cluster1.id,
        to: cluster2.id,
        distance
      });
    }
  }

  return distances.sort((a, b) => a.distance - b.distance);
}

/**
 * Trouve les grappes les plus proches d'une grappe donnée
 */
export function findNearestClusters(
  targetCluster: GrappeCluster,
  allClusters: GrappeCluster[],
  limit: number = 3
): Array<{ cluster: GrappeCluster; distance: number }> {
  const distances = allClusters
    .filter(c => c.id !== targetCluster.id)
    .map(cluster => ({
      cluster,
      distance: haversineDistance(
        targetCluster.center.lat, targetCluster.center.lon,
        cluster.center.lat, cluster.center.lon
      )
    }))
    .sort((a, b) => a.distance - b.distance);

  return distances.slice(0, limit);
}

/**
 * Score d'un clustering (plus c'est bas, meilleur c'est)
 */
export function scoreClustering(clusters: GrappeCluster[]): number {
  if (clusters.length === 0) return Infinity;

  let score = 0;

  // Score basé sur l'équilibre des tailles (écart-type des ménages)
  const menageCounts = clusters.map(c => c.menageCount);
  const avgMenages = menageCounts.reduce((a, b) => a + b, 0) / menageCounts.length;
  const variance = menageCounts.reduce((sum, count) => sum + Math.pow(count - avgMenages, 2), 0) / menageCounts.length;
  const stdDev = Math.sqrt(variance);
  score += stdDev * 2; // Pénalité pour déséquilibre

  // Score basé sur les distances moyennes intra-cluster
  const avgDistances = clusters.map(c => c.averageDistance);
  const avgIntraDistance = avgDistances.reduce((a, b) => a + b, 0) / avgDistances.length;
  score += avgIntraDistance * 3; // Pénalité pour dispersion

  // Score basé sur l'isolation des clusters (distances inter-cluster)
  const distances = calculateClusterDistances(clusters);
  if (distances.length > 0) {
    const avgInterDistance = distances.reduce((sum, d) => sum + d.distance, 0) / distances.length;
    // Bonus pour bonne séparation, mais pénalité si trop isolé
    if (avgInterDistance > 20) {
      score += (avgInterDistance - 20) * 0.5; // Pénalité pour clusters trop isolés
    }
  }

  // Score basé sur le ratio villages/ménages
  const ratios = clusters.map(c => c.villageCount / Math.max(1, c.menageCount));
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  score += avgRatio * 50; // Pénalité pour trop de villages par ménage

  return score;
}

/**
 * Optimise automatiquement le clustering en testant plusieurs configurations
 */
export function optimizeClustering(
  villages: Village[],
  menages: Menage[],
  gps: GpsEntry,
  region: string,
  targetGrappeCount: number,
  algorithms: Array<'kmeans' | 'hierarchical' | 'density'> = ['kmeans', 'hierarchical', 'density']
): ClusterConfiguration[] {
  const results: ClusterConfiguration[] = [];

  // Tester différentes distances max
  const distanceOptions = [2, 3, 4, 5, 7, 10];

  // Tester différents min/max ménages
  const minMenagesOptions = [10, 20, 30, 50];
  const maxMenagesOptions = [200, 300, 400, 500];

  for (const algorithm of algorithms) {
    for (const maxDistance of distanceOptions) {
      for (const minMenages of minMenagesOptions) {
        for (const maxMenages of maxMenagesOptions) {
          if (minMenages >= maxMenages) continue;

          const config: ClusteringConfig = {
            enabled: true,
            maxDistance,
            minMenagesPerGrappe: minMenages,
            maxMenagesPerGrappe: maxMenages,
            preferredGrappeCount: targetGrappeCount,
            algorithm
          };

          try {
            const clusters = createGrappeClusters(villages, menages, gps, config, region);
            
            if (clusters.length > 0) {
              const score = scoreClustering(clusters);
              
              // Calculer les métriques
              const menageCounts = clusters.map(c => c.menageCount);
              const avgMenages = menageCounts.reduce((a, b) => a + b, 0) / menageCounts.length;
              const stdDevMenages = Math.sqrt(
                menageCounts.reduce((sum, count) => sum + Math.pow(count - avgMenages, 2), 0) / menageCounts.length
              );
              
              const avgIntraDistance = clusters.reduce((sum, c) => sum + c.averageDistance, 0) / clusters.length;
              
              const distances = calculateClusterDistances(clusters);
              const avgInterDistance = distances.length > 0 
                ? distances.reduce((sum, d) => sum + d.distance, 0) / distances.length 
                : 0;
              
              const avgVillageRatio = clusters.reduce((sum, c) => sum + (c.villageCount / Math.max(1, c.menageCount)), 0) / clusters.length;

              results.push({
                config,
                clusters,
                score,
                metrics: {
                  avgMenages,
                  stdDevMenages,
                  avgIntraDistance,
                  avgInterDistance,
                  avgVillageRatio
                }
              });
            }
          } catch (error) {
            // Ignorer les configurations qui échouent
            continue;
          }
        }
      }
    }
  }

  // Trier par score (du meilleur au pire)
  return results.sort((a, b) => a.score - b.score).slice(0, 10);
}

/**
 * Suggère la meilleure configuration pour un nombre de grappes donné
 */
export function suggestBestConfiguration(
  villages: Village[],
  menages: Menage[],
  gps: GpsEntry,
  region: string,
  targetGrappeCount: number
): ClusterConfiguration | null {
  const optimized = optimizeClustering(villages, menages, gps, region, targetGrappeCount);
  return optimized.length > 0 ? optimized[0] : null;
}