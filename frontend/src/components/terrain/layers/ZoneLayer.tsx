/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ZoneLayer.tsx — Village Region Renderer
 *
 * Displays each village as a convex hull polygon (region) with:
 * - A semi-transparent fill colored per-village
 * - A dashed outline
 * - A label showing village name + household count
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';
import { useTerrainUIStore } from '../../../store/terrainUIStore';

interface ZoneLayerProps {
  map: maplibregl.Map | null;
  styleIsReady: boolean;
  grappeZonesData: any;
  grappeCentroidsData: any;
  grappesConfig?: any;
  showZones?: boolean;
}

const ZONE_LAYERS = [
  'village-fill',
  'village-outline',
  'village-outline-color',
  'village-hierarchy-points',
  'village-labels',
];
const SAFE_TEXT_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];
const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as GeoJSON.Feature[],
};

const isMapAlive = (map: maplibregl.Map | null) =>
  Boolean(map && !(map as any)._removed && !!map.getStyle());

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computePolygonBBox = (feature: any): [number, number, number, number] | null => {
  const ring = feature?.geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  ring.forEach((coord: any) => {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [minLon, minLat, maxLon, maxLat];
};

const mergeBBoxes = (boxes: Array<[number, number, number, number]>): [number, number, number, number] | null => {
  if (!boxes.length) return null;
  return boxes.reduce(
    (acc, box) => [
      Math.min(acc[0], box[0]),
      Math.min(acc[1], box[1]),
      Math.max(acc[2], box[2]),
      Math.max(acc[3], box[3]),
    ],
    [...boxes[0]] as [number, number, number, number]
  );
};

const ZoneLayer: React.FC<ZoneLayerProps> = ({
  map,
  styleIsReady,
  grappeZonesData,
  grappeCentroidsData,
  grappesConfig,
  showZones = true,
}) => {
  const mergedCentroidsData = useMemo(() => {
    const autoFeatures = Array.isArray(grappeCentroidsData?.features) ? grappeCentroidsData.features : [];
    const autoZoneFeatures = Array.isArray(grappeZonesData?.features) ? grappeZonesData.features : [];
    const grappes = Array.isArray(grappesConfig?.grappes) ? grappesConfig.grappes : [];
    const sousGrappes = Array.isArray(grappesConfig?.sous_grappes) ? grappesConfig.sous_grappes : [];

    const autoZoneByVillage = new Map<string, { bbox: [number, number, number, number]; count: number }>();
    autoZoneFeatures.forEach((feature: any) => {
      const villageKey = String(feature?.properties?.village || '').trim();
      const bbox = computePolygonBBox(feature);
      if (!villageKey || !bbox) return;
      autoZoneByVillage.set(villageKey, {
        bbox,
        count: Number(feature?.properties?.count || 0),
      });
    });

    const autoClusterSeeds = autoFeatures
      .map((feature: any) => {
        const coords = feature?.geometry?.coordinates;
        const villageKey = String(feature?.properties?.village || '').trim();
        if (!Array.isArray(coords) || coords.length < 2 || !villageKey) return null;
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
        return {
          villageKey,
          lon,
          lat,
          count: Number(feature?.properties?.count || autoZoneByVillage.get(villageKey)?.count || 0),
          bbox: autoZoneByVillage.get(villageKey)?.bbox || null,
        };
      })
      .filter(Boolean) as Array<{
      villageKey: string;
      lon: number;
      lat: number;
      count: number;
      bbox: [number, number, number, number] | null;
    }>;

    const assignNearestBoxes = (
      entries: any[],
      distanceThresholdKm: number
    ) => {
      const mapById = new Map<string, Array<[number, number, number, number]>>();
      autoClusterSeeds.forEach((seed) => {
        let nearestId: string | null = null;
        let nearestDist = Infinity;
        entries.forEach((entry: any) => {
          const lat = Number(entry?.centroide_lat);
          const lon = Number(entry?.centroide_lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
          const dist = haversineKm(seed.lat, seed.lon, lat, lon);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestId = entry.id;
          }
        });
        if (!nearestId || nearestDist > distanceThresholdKm || !seed.bbox) return;
        const arr = mapById.get(nearestId) || [];
        arr.push(seed.bbox);
        mapById.set(nearestId, arr);
      });
      return mapById;
    };

    const grappeBoxes = assignNearestBoxes(grappes, 35);
    const sousGrappeBoxes = assignNearestBoxes(sousGrappes, 12);

    const officialFeatures = [
      ...grappes
        .filter((g: any) => Number.isFinite(Number(g?.centroide_lat)) && Number.isFinite(Number(g?.centroide_lon)))
        .map((g: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(g.centroide_lon), Number(g.centroide_lat)],
          },
          properties: {
            id: g.id,
            sourceType: 'official',
            zoneLevel: 'grappe',
            village: g.nom || g.name || (g.numero ? `Grappe ${g.numero}` : 'Grappe'),
            count: Number(g.nb_menages || g.householdsCount || 0),
            targetBbox: mergeBBoxes(grappeBoxes.get(g.id) || []),
            label:
              `${g.nom || g.name || (g.numero ? `Grappe ${g.numero}` : 'Grappe')}\n` +
              `${Number(g.nb_menages || g.householdsCount || 0)} ménages`,
            pointColor: '#60A5FA',
          },
        })),
      ...sousGrappes
        .filter((sg: any) => Number.isFinite(Number(sg?.centroide_lat)) && Number.isFinite(Number(sg?.centroide_lon)))
        .map((sg: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(sg.centroide_lon), Number(sg.centroide_lat)],
          },
          properties: {
            id: sg.id,
            sourceType: 'official',
            zoneLevel: 'sous_grappe',
            village: sg.nom || sg.code || `SG ${sg.sous_grappe_numero || ''}`.trim(),
            count: Number(sg.nb_menages || 0),
            targetBbox: mergeBBoxes(sousGrappeBoxes.get(sg.id) || []),
            label:
              `${sg.nom || sg.code || `Sous-grappe ${sg.sous_grappe_numero || ''}`.trim()}\n` +
              `${Number(sg.nb_menages || 0)} ménages`,
            pointColor: '#22C55E',
          },
        })),
    ] as any[];

    const unmatchedAuto = autoFeatures
      .filter((feature: any) => {
        const coords = feature?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        const [lon, lat] = coords.map(Number);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;

        return !officialFeatures.some((official: any) => {
          const [officialLon, officialLat] = official.geometry.coordinates;
          return haversineKm(lat, lon, Number(officialLat), Number(officialLon)) < 0.55;
        });
      })
      .map((feature: any) => ({
        ...feature,
        properties: {
          ...(feature.properties || {}),
          sourceType: 'auto',
          zoneLevel: 'auto',
          label:
            feature?.properties?.labelFull ||
            feature?.properties?.labelDetail ||
            `${feature?.properties?.village || 'Zone terrain'}\n${Number(feature?.properties?.count || 0)} ménages`,
          pointColor: feature?.properties?.color || '#F59E0B',
          targetBbox: autoZoneByVillage.get(String(feature?.properties?.village || '').trim())?.bbox || null,
        },
      }));

    return {
      type: 'FeatureCollection',
      features: [...officialFeatures, ...unmatchedAuto],
    };
  }, [grappeCentroidsData, grappeZonesData, grappesConfig]);

  const setupLayers = useCallback(
    (m: maplibregl.Map) => {
      if (!isMapAlive(m) || !m.isStyleLoaded()) return;

      try {
        const zonesSrc = m.getSource('village-zones') as maplibregl.GeoJSONSource | undefined;
        if (zonesSrc) {
          zonesSrc.setData((grappeZonesData || EMPTY_FEATURE_COLLECTION) as any);
        } else {
          m.addSource('village-zones', {
            type: 'geojson',
            data: (grappeZonesData || EMPTY_FEATURE_COLLECTION) as any,
            generateId: true,
          });
        }

        const centroidsSrc = m.getSource('village-centroids') as
          | maplibregl.GeoJSONSource
          | undefined;
        if (centroidsSrc) {
          centroidsSrc.setData((mergedCentroidsData || EMPTY_FEATURE_COLLECTION) as any);
        } else {
          m.addSource('village-centroids', {
            type: 'geojson',
            data: (mergedCentroidsData || EMPTY_FEATURE_COLLECTION) as any,
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-fill')) {
          m.addLayer({
            id: 'village-fill',
            type: 'fill',
            source: 'village-zones',
            layout: { visibility: showZones ? 'visible' : 'none' },
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#6366F1'],
              'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 12, 0.3, 16, 0.15],
            },
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-outline')) {
          m.addLayer({
            id: 'village-outline',
            type: 'line',
            source: 'village-zones',
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 6],
              'line-opacity': 0.8,
              'line-dasharray': [3, 2],
            },
          });
        }

        if (m.getSource('village-zones') && !m.getLayer('village-outline-color')) {
          m.addLayer({
            id: 'village-outline-color',
            type: 'line',
            source: 'village-zones',
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#6366F1'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2, 18, 3],
              'line-opacity': 1,
            },
          });
        }

        if (m.getSource('village-centroids') && !m.getLayer('village-hierarchy-points')) {
          m.addLayer({
            id: 'village-hierarchy-points',
            type: 'circle',
            source: 'village-centroids',
            layout: { visibility: showZones ? 'visible' : 'none' },
            paint: {
              'circle-color': ['coalesce', ['get', 'pointColor'], '#6366F1'],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                6,
                [
                  'case',
                  ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'grappe'],
                  8,
                  ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'sous_grappe'],
                  6,
                  5,
                ],
                12,
                [
                  'case',
                  ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'grappe'],
                  14,
                  ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'sous_grappe'],
                  10,
                  8,
                ],
              ],
              'circle-opacity': ['case', ['==', ['coalesce', ['get', 'sourceType'], ''], 'official'], 0.95, 0.8],
              'circle-stroke-width': [
                'case',
                ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'grappe'],
                2.5,
                ['==', ['coalesce', ['get', 'zoneLevel'], ''], 'sous_grappe'],
                1.5,
                1,
              ],
              'circle-stroke-color': '#FFFFFF',
            },
          });
        }

        if (m.getSource('village-centroids') && !m.getLayer('village-labels')) {
          m.addLayer({
            id: 'village-labels',
            type: 'symbol',
            source: 'village-centroids',
            minzoom: 10.5,
            layout: {
              visibility: showZones ? 'visible' : 'none',
              'text-field': ['coalesce', ['get', 'label'], ['get', 'village'], 'Village'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 16, 18, 20],
              'text-font': SAFE_TEXT_FONT,
              'text-anchor': 'center',
              'text-max-width': 12,
              'text-line-height': 1.1,
              'text-allow-overlap': false,
              'text-ignore-placement': false,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2,
              'text-opacity': 1,
            },
          });
        }

        logger.debug(
          `✅ [ZoneLayer] ${grappeZonesData?.features?.length ?? 0} zones auto + ${mergedCentroidsData?.features?.length ?? 0} repères fusionnés`
        );
      } catch (err) {
        logger.warn('⚠️ [ZoneLayer] Layer setup error:', err);
      }
    },
    [grappeZonesData, mergedCentroidsData, showZones]
  );

  useEffect(() => {
    if (!map || !styleIsReady) return;

    const queueSetup = () => {
      if (!isMapAlive(map)) return;
      if (!map.isStyleLoaded()) return;
      setTimeout(() => setupLayers(map), 0);
    };

    if (isMapAlive(map) && map.isStyleLoaded()) {
      queueSetup();
    }

    map.on('style.load', queueSetup);
    return () => {
      map.off('style.load', queueSetup);
    };
  }, [map, styleIsReady, grappeZonesData, mergedCentroidsData, setupLayers]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!isMapAlive(map) || !map.isStyleLoaded()) return;
    ZONE_LAYERS.forEach((id) => {
      if (isMapAlive(map) && map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
      }
    });
  }, [map, showZones, styleIsReady]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!isMapAlive(map) || !map.isStyleLoaded()) return;
    let hoveredId: number | string | null = null;

    const onMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: false });
      }
      hoveredId = e.features[0].id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: true });
      }
      map.getCanvas().style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'village-zones', id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      map.getCanvas().style.cursor = '';
    };

    if (map.getLayer('village-fill')) {
      map.on('mousemove', 'village-fill', onMouseMove);
      map.on('mouseleave', 'village-fill', onMouseLeave);
    }

    return () => {
      if (!isMapAlive(map)) return;
      if (map.getLayer('village-fill')) {
        map.off('mousemove', 'village-fill', onMouseMove);
        map.off('mouseleave', 'village-fill', onMouseLeave);
      }
    };
  }, [map, styleIsReady]);

  useEffect(() => {
    if (!map || !styleIsReady) return;
    if (!isMapAlive(map) || !map.isStyleLoaded()) return;

    const openZoneContext = (feature: any) => {
      const rawId =
        feature?.properties?.id ??
        feature?.properties?.village ??
        feature?.properties?.name ??
        feature?.properties?.dominantVillage ??
        null;
      if (!rawId) return;

      const zoneId = String(rawId).trim();
      if (!zoneId) return;

      const store = useTerrainUIStore.getState();
      store.setActiveGrappeId(zoneId);
      store.setPanel('grappe_allocation');
    };

    const zoomToFeature = (feature: any) => {
      const bbox = feature?.properties?.targetBbox;
      if (Array.isArray(bbox) && bbox.length === 4) {
        map.fitBounds(
          [
            [Number(bbox[0]), Number(bbox[1])],
            [Number(bbox[2]), Number(bbox[3])],
          ],
          { padding: 72, duration: 700, maxZoom: 15.5 }
        );
        return;
      }

      const coords = feature?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        map.easeTo({
          center: [Number(coords[0]), Number(coords[1])],
          zoom: Math.max(map.getZoom(), 14),
          duration: 700,
        });
      }
    };

    const handleZoneClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      openZoneContext(feature);
      zoomToFeature(feature);
    };

    ['village-fill', 'village-outline', 'village-outline-color', 'village-hierarchy-points', 'village-labels'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.on('click', layerId as any, handleZoneClick);
      }
    });

    return () => {
      if (!isMapAlive(map)) return;
      ['village-fill', 'village-outline', 'village-outline-color', 'village-hierarchy-points', 'village-labels'].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.off('click', layerId as any, handleZoneClick);
        }
      });
    };
  }, [map, styleIsReady, mergedCentroidsData, grappeZonesData]);

  return null;
};

export default React.memo(ZoneLayer);
