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

/**
 * Amélioration: Détecte les GPS depuis plusieurs sources
 * - latitude/longitude séparés
 * - location.coordinates (GeoJSON)
 * - location_gis
 */
function extractGPS(household) {
    // 1. Priorité: latitude/longitude séparés
    if (household.latitude && household.longitude) {
        return {
            lat: parseFloat(household.latitude),
            lon: parseFloat(household.longitude),
            source: 'separated'
        };
    }

    // 2. Fallback: location.coordinates (GeoJSON: [lon, lat])
    if (household.location && household.location.coordinates && Array.isArray(household.location.coordinates)) {
        const [lon, lat] = household.location.coordinates;
        if (typeof lat === 'number' && typeof lon === 'number' && lat !== 0 && lon !== 0) {
            return {
                lat,
                lon,
                source: 'geojson'
            };
        }
    }

    return null;
}

/**
 * Validation GPS: Vérifie que les coordonnées sont valides
 */
function isValidGPS(coords) {
    if (!coords) return false;
    const { lat, lon } = coords;
    // Coordonnées valides: lat [-90, 90], lon [-180, 180]
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function kMeansClustering(points, k, maxIterations = 50) {
    if (points.length === 0 || k <= 0) return [];
    if (k >= points.length) {
        return points.map((p) => ({
            centroid: p.coords,
            points: [p]
        }));
    }

    // Initialize centroids randomly from existing points
    let centroids = [];
    let usedIndices = new Set();
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

function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
}

/**
 * AMÉLIORÉ: Génère des grappes intelligemment
 * 
 * Classement hiérarchique:
 * 1. RÉGION (groupe principal)
 * 2. VILLAGE (pas de GPS)
 * 3. GPS CLUSTERING (si GPS)
 * 
 * Détecte: latitude/longitude séparés OU location.coordinates
 */
export function generateDynamicGrappes(households, regionTargetSizes = { 'Kaffrine': 600, 'Tambacounda': 600 }) {
    // Statistiques de couverture GPS
    const stats = {
        totalHouseholds: households.length,
        withGPS: 0,
        withoutGPS: 0,
        gpsPercentage: 0,
        regionStats: {}
    };

    // Classification par région > village > gps
    const classifiedHouseholds = {};

    for (const h of households) {
        const region = normalizeName(h.region) || 'Zone Inconnue';
        const village = normalizeName(h.village || h.departement) || 'Non Spécifié';
        
        if (!classifiedHouseholds[region]) {
            classifiedHouseholds[region] = {
                byVillage: {},
                totalCount: 0,
                gpsCount: 0,
                villages: new Set()
            };
        }

        if (!classifiedHouseholds[region].byVillage[village]) {
            classifiedHouseholds[region].byVillage[village] = {
                withGPS: [],
                withoutGPS: []
            };
        }

        classifiedHouseholds[region].totalCount++;
        classifiedHouseholds[region].villages.add(village);

        // Détecte GPS
        const gpsCoords = extractGPS(h);
        if (gpsCoords && isValidGPS(gpsCoords)) {
            classifiedHouseholds[region].byVillage[village].withGPS.push({
                id: h.id,
                coords: gpsCoords,
                original: h
            });
            classifiedHouseholds[region].gpsCount++;
            stats.withGPS++;
        } else {
            classifiedHouseholds[region].byVillage[village].withoutGPS.push(h);
            stats.withoutGPS++;
        }
    }

    stats.gpsPercentage = ((stats.withGPS / stats.totalHouseholds) * 100).toFixed(1);

    // Build region stats
    for (const region in classifiedHouseholds) {
        const regionData = classifiedHouseholds[region];
        stats.regionStats[region] = {
            total: regionData.totalCount,
            withGPS: regionData.gpsCount,
            percentage: ((regionData.gpsCount / regionData.totalCount) * 100).toFixed(1)
        };
    }

    console.log(`\n[CLUSTERING] 📊 GPS Coverage Statistics:`);
    console.log(`   Total Households: ${stats.totalHouseholds}`);
    console.log(`   With GPS: ${stats.withGPS} (${stats.gpsPercentage}%)`);
    console.log(`   Without GPS: ${stats.withoutGPS}`);
    for (const region in stats.regionStats) {
        const rs = stats.regionStats[region];
        console.log(`   ${region}: ${rs.withGPS}/${rs.total} (${rs.percentage}%)`);
    }

    const newGrappes = [];
    const newSousGrappes = [];

    let globalGrappeCode = 1;
    let globalSousGrappeCode = 1;

    // Process each region
    const allRegions = Object.keys(classifiedHouseholds).sort();

    for (const region of allRegions) {
        const regionData = classifiedHouseholds[region];
        const villages = Array.from(regionData.villages).sort();

        console.log(`\n[CLUSTERING] 🌍 Processing Region: ${region} (${regionData.totalCount} ménages)`);

        // Pour chaque village
        for (const village of villages) {
            const villageData = regionData.byVillage[village];
            const { withGPS, withoutGPS } = villageData;

            // 1. Si GPS disponibles: Clustering K-Means
            if (withGPS.length > 0) {
                const targetSize = regionTargetSizes[region] || 100;
                let kMain = Math.max(1, Math.round(withGPS.length / targetSize));

                console.log(`   📍 ${village}: ${withGPS.length} avec GPS (${kMain} grappes)`);

                const mainClusters = kMeansClustering(withGPS, kMain);

                mainClusters.forEach((mainCluster) => {
                    const grappeNumero = globalGrappeCode++;
                    const grappeId = `GRAPPE-${grappeNumero}`;

                    let maxRadius = 0;
                    let sumRadius = 0;

                    mainCluster.points.forEach((p) => {
                        const dist = getDistance(mainCluster.centroid.lat, mainCluster.centroid.lon, p.coords.lat, p.coords.lon);
                        if (dist > maxRadius) maxRadius = dist;
                        sumRadius += dist;
                    });
                    const avgRadius = mainCluster.points.length ? sumRadius / mainCluster.points.length : 0;

                    const grappeName = `${region} – ${village} GPS G${grappeNumero}`;

                    newGrappes.push({
                        id: grappeId,
                        nom: grappeName,
                        region: region,
                        village: village,
                        numero: grappeNumero,
                        nb_menages: mainCluster.points.length,
                        gps_count: mainCluster.points.length,
                        gps_percentage: 100,
                        centroide_lat: mainCluster.centroid.lat,
                        centroide_lon: mainCluster.centroid.lon,
                        rayon_moyen_km: Number(avgRadius.toFixed(2)),
                        rayon_max_km: Number(maxRadius.toFixed(2)),
                        points: mainCluster.points,
                        sous_grappes: [],
                        has_gps: true
                    });

                    // Sub-clustering if needed
                    let kSub = Math.max(1, Math.round(mainCluster.points.length / 100));
                    const subClusters = kMeansClustering(mainCluster.points, kSub);

                    subClusters.forEach((subCluster) => {
                        const subNumero = globalSousGrappeCode++;
                        const subId = `SGRAPPE-${subNumero}`;

                        const subGrappeName = `${region} – ${village} GPS G${grappeNumero} – SG${subNumero.toString().padStart(2, '0')}`;

                        newSousGrappes.push({
                            id: subId,
                            grappe_id: grappeId,
                            region: region,
                            village: village,
                            grappe_numero: grappeNumero,
                            sous_grappe_numero: subNumero,
                            nom: subGrappeName,
                            code: subId,
                            nb_menages: subCluster.points.length,
                            centroide_lat: subCluster.centroid.lat,
                            centroide_lon: subCluster.centroid.lon
                        });
                    });
                });
            }

            // 2. Sans GPS: Grouper par village
            if (withoutGPS.length > 0) {
                const grappeNumero = globalGrappeCode++;
                const grappeId = `GRAPPE-${grappeNumero}`;

                console.log(`   📍 ${village}: ${withoutGPS.length} SANS GPS`);

                const grappeName = `${region} – ${village} (Sans GPS)`;

                newGrappes.push({
                    id: grappeId,
                    nom: grappeName,
                    region: region,
                    village: village,
                    numero: grappeNumero,
                    nb_menages: withoutGPS.length,
                    gps_count: 0,
                    gps_percentage: 0,
                    centroide_lat: null,
                    centroide_lon: null,
                    rayon_moyen_km: 0,
                    rayon_max_km: 0,
                    points: withoutGPS,
                    sous_grappes: [],
                    has_gps: false
                });
            }
        }
    }

    console.log(`\n[CLUSTERING] ✅ Generated ${newGrappes.length} grappes (${newSousGrappes.length} sous-grappes)\n`);

    return {
        grappes: newGrappes,
        sous_grappes: newSousGrappes,
        stats
    };
}

