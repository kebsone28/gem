import { Map } from 'maplibre-gl';

/**
 * Register a PMTiles-based vector source on the map.
 * @param map Map instance
 * @param sourceId source id
 * @param tileUrlTemplate e.g. 'http://localhost:4000/tiles/{z}/{x}/{y}.pbf'
 */
export function registerPMTilesSource(map: Map, sourceId: string, tileUrlTemplate: string) {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: 'vector',
    tiles: [tileUrlTemplate],
    maxzoom: 14,
  });
}

export function removePMTilesSource(map: Map, sourceId: string) {
  try {
    if (!map) return;
    if (map.getLayer(sourceId)) map.removeLayer(sourceId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {
    /* swallow */
  }
}
