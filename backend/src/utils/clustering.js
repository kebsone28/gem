/**
 * Simple k-means clustering implementation for geographic coordinates.
 * Coordinates are { lat, lon }.
 */

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function kMeansClustering(points, k, maxIterations = 50) {
    if (points.length === 0 || k <= 0) return [];
    if (k >= points.length) {
        return points.map((p) => ({
            centroid: p.coords,
            points: [p]
        }));
    }

    const centroids = [];
    const usedIndices = new Set();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * points.length);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            centroids.push({ ...points[idx].coords });
        }
    }

    let clusters = Array.from({ length: k }, () => []);

    for (let iter = 0; iter < maxIterations; iter++) {
        const newClusters = Array.from({ length: k }, () => []);

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

        let changed = false;
        for (let i = 0; i < k; i++) {
            if (newClusters[i].length === 0) continue;

            const sumLat = newClusters[i].reduce((sum, p) => sum + p.coords.lat, 0);
            const sumLon = newClusters[i].reduce((sum, p) => sum + p.coords.lon, 0);

            const newLat = sumLat / newClusters[i].length;
            const newLon = sumLon / newClusters[i].length;

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

/**
 * Automating Regional Clustering Logic - SYNCED WITH FRONTEND
 * Hierarchy: Region -> Village -> Proximity (K-Means)
 */
export function generateDynamicGrappes(households, targetSize = 500) {
    const hierarchy = {};

    for (const h of households) {
        // Handle GeoJSON or direct lat/lon
        let lat, lon;
        if (h.latitude && h.longitude) {
            lat = parseFloat(h.latitude);
            lon = parseFloat(h.longitude);
        } else if (h.location?.coordinates) {
            lon = h.location.coordinates[0];
            lat = h.location.coordinates[1];
        }

        if (isNaN(lat) || isNaN(lon)) continue;
        
        const region = h.region || 'REGION_INCONNUE';
        const village = h.village || h.departement || 'VILLAGE_INCONNU';
        
        if (!hierarchy[region]) hierarchy[region] = {};
        if (!hierarchy[region][village]) hierarchy[region][village] = [];
        
        hierarchy[region][village].push({
            id: h.id,
            coords: { lat, lon },
            original: h
        });
    }

    const newGrappes = [];
    const newSousGrappes = [];

    for (const regionName in hierarchy) {
        let grappeCounterInRegion = 1;

        for (const villageName in hierarchy[regionName]) {
            const points = hierarchy[regionName][villageName];
            
            const kMain = Math.max(1, Math.round(points.length / targetSize));
            const villageClusters = kMeansClustering(points, kMain);

            villageClusters.forEach((cluster, vIdx) => {
                const grappeNumero = grappeCounterInRegion++;
                const grappeId = `G-${regionName.substring(0, 3).toUpperCase()}-${villageName.substring(0, 3).toUpperCase()}-${grappeNumero}`;

                let maxRadius = 0;
                let sumRadius = 0;
                cluster.points.forEach((p) => {
                    const dist = getDistance(cluster.centroid.lat, cluster.centroid.lon, p.coords.lat, p.coords.lon);
                    if (dist > maxRadius) maxRadius = dist;
                    sumRadius += dist;
                });
                const avgRadius = cluster.points.length ? sumRadius / cluster.points.length : 0;

                newGrappes.push({
                    id: grappeId,
                    nom: `${regionName} – ${villageName} – Grappe ${vIdx + 1}`,
                    region: regionName,
                    village: villageName,
                    numero: grappeNumero,
                    nb_menages: cluster.points.length,
                    centroide_lat: cluster.centroid.lat,
                    centroide_lon: cluster.centroid.lon,
                    rayon_moyen_km: Number(avgRadius.toFixed(2)),
                    rayon_max_km: Number(maxRadius.toFixed(2)),
                    points: cluster.points // Backend needs points for linking
                });

                const kSub = Math.max(1, Math.round(cluster.points.length / 100));
                const subClusters = kMeansClustering(cluster.points, kSub);

                subClusters.forEach((subCluster, subIdx) => {
                    const subNumero = subIdx + 1;
                    const subId = `${grappeId}-SG${subNumero.toString().padStart(2, '0')}`;

                    newSousGrappes.push({
                        id: subId,
                        grappe_id: grappeId,
                        region: regionName,
                        village: villageName,
                        grappe_numero: grappeNumero,
                        sous_grappe_numero: subNumero,
                        nom: `${regionName} – ${villageName} – Grappe ${vIdx + 1} – SG${subNumero.toString().padStart(2, '0')}`,
                        code: subId,
                        nb_menages: subCluster.points.length,
                        centroide_lat: subCluster.centroid.lat,
                        centroide_lon: subCluster.centroid.lon
                    });
                });
            });
        }
    }

    return {
        grappes: newGrappes,
        sous_grappes: newSousGrappes
    };
}
