import { haversine } from './haversine';
import type { SpatialPoint } from './spatialIndex';

// Standard K-Means clustering algorithm
export function kmeans(points: SpatialPoint[], k: number = 3, iterations: number = 15): { lat: number, lon: number }[] {
    if (points.length === 0) return [];
    if (points.length <= k) return points.map(p => ({ lat: p.lat, lon: p.lon }));

    // Choix initial (naïf : on prend les k premiers, l'idéal serait kmeans++)
    let centroids = points.slice(0, k).map(p => ({ lat: p.lat, lon: p.lon }));

    for (let i = 0; i < iterations; i++) {
        const groups: SpatialPoint[][] = Array.from({ length: k }, () => []);

        // 1. Assign points to nearest centroid
        for (const p of points) {
            let bestIdx = 0;
            let bestDist = Infinity;

            centroids.forEach((c, idx) => {
                const d = haversine(p.lat, p.lon, c.lat, c.lon);
                if (d < bestDist) {
                    bestIdx = idx;
                    bestDist = d;
                }
            });

            groups[bestIdx].push(p);
        }

        // 2. Recalculate centroids
        centroids = groups.map((g, idx) => {
            if (g.length === 0) return centroids[idx]; // Keep old centroid if empty

            const lat = g.reduce((s, p) => s + p.lat, 0) / g.length;
            const lon = g.reduce((s, p) => s + p.lon, 0) / g.length;
            return { lat, lon };
        });
    }

    return centroids;
}
