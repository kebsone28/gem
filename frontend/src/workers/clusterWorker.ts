import {
  hybridCluster,
  clustersToGeoJSON,
  centroidsToGeoJSON,
  getClusterName,
} from '../geo/hybridCluster';

self.onmessage = async (event) => {
  try {
    const { households, maxPerCluster } = event.data;

    // ✅ Ultra-robust filtering for WebWorker: only proceed with perfectly valid numeric coordinates
    const validHouseholds = (households || []).filter((h: any) => {
      const lat = Number(h.lat);
      const lng = Number(h.lon);
      return (
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat !== 0 &&
        lng !== 0 &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      );
    });

    // Éxecuter le pipeline lourd Isochrone + Géométrique
    const rawClusters = await hybridCluster(validHouseholds, maxPerCluster || 80);

    // Transformer en structures propres pour MapLibre GL
    const zonesGeoJSON = clustersToGeoJSON(rawClusters);
    const centroidsGeoJSON = centroidsToGeoJSON(rawClusters);

    // Extraire la liste brute pour le panneau React UI (GrappeSelectorPanel)
    const panelData = rawClusters.map((c) => ({
      id: c.id,
      name: getClusterName(c),
      count: c.households.length,
      type: c.type,
      bbox: computeBBox(c.households),
    }));

    self.postMessage({
      success: true,
      zones: zonesGeoJSON,
      centroids: centroidsGeoJSON,
      panelData,
    });
  } catch (e: any) {
    self.postMessage({ success: false, error: e.message });
  }
};

function computeBBox(points: any[]) {
  if (!points || points.length === 0) return null;
  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  // Représentation standard Bbox pour fitBounds [swLng, swLat, neLng, neLat]
  // Ajoute un epsilon de sécurité pour éviter une box infiniment fine sur un ménage
  return [
    [minLon - 0.005, minLat - 0.005], // SouthWest
    [maxLon + 0.005, maxLat + 0.005], // NorthEast
  ];
}
