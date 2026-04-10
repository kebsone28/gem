// Simple k-means clustering implementation for geographic coordinates
// Coordinates are [longitude, latitude] to match GeoJSON Point format.

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function kMeansClustering(points: any[], k: number, maxIterations = 50) {
    if (points.length === 0 || k <= 0) return [];
    if (k >= points.length) {
        return points.map((p) => ({
            centroid: p.coords,
            points: [p]
        }));
    }

    // Initialize centroids randomly from existing points
    const centroids: { lat: number; lon: number }[] = [];
    const usedIndices = new Set();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * points.length);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            centroids.push({ ...points[idx].coords }); // { lat, lon }
        }
    }

    let clusters = Array.from({ length: k }, () => [] as any[]);

    for (let iter = 0; iter < maxIterations; iter++) {
        // Assign points to closest centroid
        const newClusters = Array.from({ length: k }, () => [] as any[]);

        for (const point of points) {
            let minDistance = Infinity;
            let closestCentroidIdx = 0;

            for (let i = 0; i < k; i++) {
                const dist = getDistance(point.coords.lat, point.coords.lon, centroids[i].lat, centroids[i].lon);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestCentroidIdx = i;
                }
            }
            newClusters[closestCentroidIdx].push(point);
        }

        // Recalculate centroids
        let changed = false;
        for (let i = 0; i < k; i++) {
            if (newClusters[i].length === 0) continue; // handle empty cluster edge case

            const sumLat = newClusters[i].reduce((sum, p) => sum + p.coords.lat, 0);
            const sumLon = newClusters[i].reduce((sum, p) => sum + p.coords.lon, 0);

            const newLat = sumLat / newClusters[i].length;
            const newLon = sumLon / newClusters[i].length;

            // Check for convergence (small threshold)
            if (Math.abs(centroids[i].lat - newLat) > 0.0001 || Math.abs(centroids[i].lon - newLon) > 0.0001) {
                changed = true;
            }

            centroids[i] = { lat: newLat, lon: newLon };
        }

        clusters = newClusters;
        if (!changed) break;
    }

    return clusters.map((clusterPoints, i) => ({
        centroid: centroids[i],
        points: clusterPoints
    }));
}

export function generateDynamicGrappes(households: any[], regionTargetSizes = { 'Kaffrine': 600, 'Tambacounda': 600 }) {
    // 1. Group households by region and ensure they have coordinates
    const regionGroups: Record<string, any[]> = {};

    for (const h of households) {
        if (!h.location || !h.location.coordinates || h.location.coordinates.length < 2) continue;
        const region = h.region || 'Unknown';
        if (!regionGroups[region]) regionGroups[region] = [];
        // Coordinates in GeoJSON are [lon, lat]
        regionGroups[region].push({
            id: h.id,
            coords: { lat: h.location.coordinates[1], lon: h.location.coordinates[0] },
            original: h
        });
    }

    const newGrappes: any[] = [];
    const newSousGrappes: any[] = [];

    // 2. Process each region
    for (const region in regionGroups) {
        const points = regionGroups[region];
        const targetSize = (regionTargetSizes as any)[region] || 500;

        // Determine k for main grappes (e.g., Target ~500 households per grappe)
        const kMain = Math.max(1, Math.round(points.length / targetSize));

        const mainClusters = kMeansClustering(points, kMain);

        mainClusters.forEach((mainCluster, mainIdx) => {
            const grappeNumero = mainIdx + 1;
            const grappeId = `${region.substring(0, 3).toUpperCase()}-G${grappeNumero}`;

            // Calculate radius (max distance from centroid)
            let maxRadius = 0;
            let sumRadius = 0;
            mainCluster.points.forEach((p: any) => {
                const dist = getDistance(mainCluster.centroid.lat, mainCluster.centroid.lon, p.coords.lat, p.coords.lon);
                if (dist > maxRadius) maxRadius = dist;
                sumRadius += dist;
            });
            const avgRadius = mainCluster.points.length ? sumRadius / mainCluster.points.length : 0;

            newGrappes.push({
                id: grappeId,
                nom: `${region} – Grappe ${grappeNumero}`,
                region: region,
                numero: grappeNumero,
                nb_menages: mainCluster.points.length,
                centroide_lat: mainCluster.centroid.lat,
                centroide_lon: mainCluster.centroid.lon,
                rayon_moyen_km: Number(avgRadius.toFixed(2)),
                rayon_max_km: Number(maxRadius.toFixed(2)),
                sous_grappes: []
            });

            // For each main grappe, cluster into sub-grappes (e.g., Target ~100 households per sub-grappe)
            const kSub = Math.max(1, Math.round(mainCluster.points.length / 100));
            const subClusters = kMeansClustering(mainCluster.points, kSub);

            subClusters.forEach((subCluster, subIdx) => {
                const subNumero = subIdx + 1;
                const subId = `${grappeId}-SG${subNumero.toString().padStart(2, '0')}`;

                newSousGrappes.push({
                    id: subId,
                    grappe_id: grappeId,
                    region: region,
                    grappe_numero: grappeNumero,
                    sous_grappe_numero: subNumero,
                    nom: `${region} – Grappe ${grappeNumero} – SG${subNumero.toString().padStart(2, '0')}`,
                    code: subId,
                    nb_menages: subCluster.points.length,
                    centroide_lat: subCluster.centroid.lat,
                    centroide_lon: subCluster.centroid.lon
                });
            });
        });
    }

    return {
        grappes: newGrappes,
        sous_grappes: newSousGrappes
    };
}
