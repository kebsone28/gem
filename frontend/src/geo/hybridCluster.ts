import simplify from '@turf/simplify';
import { featureCollection, polygon } from '@turf/helpers';
import { dbscan, isochroneDbscan } from './dbscan';
import { kmeans } from './kmeans';
import { buildSpatialIndex, type SpatialPoint } from './spatialIndex';
import { convexHull } from './convexHull';
import { haversine } from './haversine';
import { getTravelTimeMatrix } from './osrm';

export interface ClusterResult {
    id: string;
    type: 'dense' | 'kmeans' | 'isolated';
    households: SpatialPoint[];
    centroid: { lat: number, lon: number };
}

// L'approche Smart-City Hybride ISOCHRONE:
// 1. Détection MACRO via DBSCAN (Haversine 200m)
// 2. Pour chaque macro-cluster, requête OSRM pour la matrice de temps de trajet
// 3. Détection MICRO via isochroneDbscan (300s = 5 minutes de temps réel)
// 4. Si un micro-cluster est encore trop gros (> seuil, ex: 60) -> on subdivise via K-Means
export async function hybridCluster(households: SpatialPoint[], maxHouseholdsPerCluster = 80): Promise<ClusterResult[]> {
    const tree = buildSpatialIndex(households);

    // On lance DBSCAN (Rayon : ~200 mètres, Min pts : 3 pour définir un "macro-village")
    const macroClusters = dbscan(households, tree, 0.20, 3);

    const result: ClusterResult[] = [];
    let clusterCounter = 1;

    // Process sub-clusters with KMeans if needed
    const processFinalGroup = (pts: SpatialPoint[], isIsochrone: boolean) => {
        if (pts.length > maxHouseholdsPerCluster) {
            const k = Math.ceil(pts.length / maxHouseholdsPerCluster);
            const centroids = kmeans(pts, k);
            const groups: SpatialPoint[][] = Array.from({ length: k }, () => []);

            pts.forEach(p => {
                let bestIdx = 0, bestDist = Infinity;
                centroids.forEach((c, idx) => {
                    const d = haversine(p.lat, p.lon, c.lat, c.lon);
                    if (d < bestDist) { bestDist = d; bestIdx = idx; }
                });
                groups[bestIdx].push(p);
            });

            groups.forEach((g, idx) => {
                if (g.length > 0) result.push({ id: `G-${clusterCounter++}`, type: 'kmeans', households: g, centroid: centroids[idx] });
            });
        } else {
            const centroidLat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
            const centroidLon = pts.reduce((sum, p) => sum + p.lon, 0) / pts.length;
            result.push({ id: `G-${clusterCounter++}`, type: isIsochrone ? 'dense' : 'isolated', households: pts, centroid: { lat: centroidLat, lon: centroidLon } });
        }
    };

    // Traitement des Macro Clusters
    for (const macroCluster of macroClusters) {
        // Trop grand pour OSRM API (limite fallback à 500 pour ne pas timeout, à ajuster selon instance locale)
        if (macroCluster.length > 500) {
            processFinalGroup(macroCluster, false);
            continue;
        }

        const timeMatrix = await getTravelTimeMatrix(macroCluster);

        if (timeMatrix) {
            // Isochrone clustering (Max 5 mins = 300s)
            const microClusters = isochroneDbscan(macroCluster, timeMatrix, 300, 3);
            for (const micro of microClusters) {
                processFinalGroup(micro, true);
            }
        } else {
            // Fallback to purely geometric partitioning
            processFinalGroup(macroCluster, false);
        }
    }

    return result;
}

// Convertit les clusters en FeatureCollection prête pour MapLibre
export function clustersToGeoJSON(clusters: ClusterResult[]): any {
    const collection = featureCollection([]);

    clusters.forEach((c, i) => {
        if (!c.households || c.households.length < 3) return; // Un polygone a besoin d'au moins 3 points

        const hull = convexHull(c.households);
        // Fermer le polygone pour Turf/MapLibre (le premier point doit être le dernier)
        hull.push(hull[0]);

        const coords = hull.map(p => [p.lon, p.lat]);

        try {
            const poly = polygon([[...coords]], {
                id: c.id,
                name: `Grappe ${c.id.replace('G-', '')}`,
                count: c.households.length,
                type: c.type,
                centroidX: c.centroid.lon,
                centroidY: c.centroid.lat
            });

            // Simplification Turf.js pour des perf extrêmes sur MapLibre
            const simplified = simplify(poly, { tolerance: 0.0001, highQuality: false });

            // MapLibre a besoin d'un ID numérique entier ou string simple au top-level pour le feature-state
            const intId = parseInt(c.id.replace(/\D/g, '')) || i;
            (simplified as any).id = intId;
            collection.features.push(simplified as any);
        } catch (e) {
            console.error("Erreur de polygon", e);
        }
    });

    return collection;
}

// GeoJSON "Centroids" pour les labels HTML / MapLibre (symbol layer)
export function centroidsToGeoJSON(clusters: ClusterResult[]): any {
    return {
        type: "FeatureCollection",
        features: clusters.map((c, i) => {
            const intId = parseInt(c.id.replace(/\D/g, '')) || i;
            return {
                type: "Feature",
                id: intId,
                properties: {
                    id: c.id,
                    name: `Grappe ${c.id.replace('G-', '')}`,
                    count: c.households.length
                },
                geometry: {
                    type: "Point",
                    coordinates: [c.centroid.lon, c.centroid.lat]
                }
            };
        })
    };
}
