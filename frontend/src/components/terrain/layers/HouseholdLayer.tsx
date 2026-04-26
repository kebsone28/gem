/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTerrainUIStore } from '../../../store/terrainUIStore';
import logger from '../../../utils/logger';
import { generatePopupHTML } from '../mapUtils';

import { getIconId } from '../mapConfig';

interface HouseholdLayerProps {
  map: maplibregl.Map | null;
  householdGeoJSON: any;
  households?: any[];
  projectId?: string;
  selectedHouseholdCoords?: [number, number] | null;
  showHeatmap?: boolean;
  styleIsReady: boolean;
  showZones?: boolean;
}

const SAFE_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];

// ─── Source IDs ───────────────────────────────────────────────
const SRC_HOUSEHOLDS = 'households';
const SRC_CLUSTERS = 'supercluster-generated';
const SRC_HULLS = 'cluster-hulls';
const SRC_SELECTED = 'selected-household';

// ─── Create all GeoJSON sources on the map ────────────────────
function ensureSources(map: maplibregl.Map) {
  if (!map.getSource(SRC_HOUSEHOLDS)) {
    map.addSource(SRC_HOUSEHOLDS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    logger.debug('✅ [HouseholdLayer] source: households created');
  }
  if (!map.getSource(SRC_CLUSTERS)) {
    map.addSource(SRC_CLUSTERS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getSource(SRC_HULLS)) {
    map.addSource(SRC_HULLS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getSource(SRC_SELECTED)) {
    map.addSource(SRC_SELECTED, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
}

// ─── Create all layers ────────────────────────────────────────
function ensureLayers(map: maplibregl.Map) {
  // Guard: need sources
  if (!map.getSource(SRC_HOUSEHOLDS) || !map.getSource(SRC_CLUSTERS)) return;

  // Cluster halo
  if (!map.getLayer('cluster-halo')) {
    map.addLayer({
      id: 'cluster-halo',
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['==', ['get', 'cluster'], true],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 10, 28, 100, 56],
        'circle-color': '#ffffff',
        'circle-opacity': 0.12,
        'circle-blur': 1,
      },
    });
  }

  // Cluster circles
  if (!map.getLayer('cluster-circles')) {
    map.addLayer({
      id: 'cluster-circles',
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['==', ['get', 'cluster'], true],
      paint: {
        'circle-color': [
          'step', ['to-number', ['coalesce', ['get', 'point_count'], 0]],
          '#00D084', 20, '#FFD60A', 50, '#FF9500', 80, '#FF3B30',
        ],
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 10, 22, 100, 44],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  // Cluster counts
  if (!map.getLayer('cluster-counts')) {
    map.addLayer({
      id: 'cluster-counts',
      type: 'symbol',
      source: SRC_CLUSTERS,
      filter: ['==', ['get', 'cluster'], true],
      layout: {
        'text-field': ['to-string', ['get', 'point_count']],
        'text-font': SAFE_FONT,
        'text-size': 16,
        'text-allow-overlap': true,
        'text-font': SAFE_FONT,
      },
      paint: { 
        'text-color': '#ffffff', 
        'text-halo-color': 'rgba(0,0,0,0.7)', 
        'text-halo-width': 2 
      },
    });
  }

  // Glow circles for individual points (always visible, small)
  if (!map.getLayer('households-glow-layer')) {
    map.addLayer({
      id: 'households-glow-layer',
      type: 'circle',
      source: SRC_HOUSEHOLDS,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 5, 14, 8, 18, 12],
        'circle-color': [
          'match', ['coalesce', ['get', 'status'], 'default'],
          'Contrôle conforme', '#00FF9D',
          'Non conforme', '#FF0055',
          'Intérieur terminé', '#6366F1',
          'Réseau terminé', '#00D2FF',
          'Murs terminés', '#FFD60A',
          'Livraison effectuée', '#059669',
          'Non éligible', '#64748B',
          'Désistement', '#64748B',
          'Refusé', '#F43F5E',
          'Eligible', '#3B82F6',
          'En attente', '#64748B',
          '#6366F1',
        ],
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.5)',
      },
    });
    logger.debug('✅ [HouseholdLayer] layer: households-glow-layer created');
  }

  // Icon symbols
  if (!map.getLayer('households-local-layer')) {
    map.addLayer({
      id: 'households-local-layer',
      type: 'symbol',
      source: SRC_HOUSEHOLDS,
      layout: {
        'icon-image': [
          'concat', 'icon-', ['coalesce', ['get', 'iconId'], 'default'], '-small'
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 13, 0.7, 15, 0.95, 18, 1.1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-optional': true,
      },
      paint: { 'icon-opacity': 1 },
    });
  }

  // Labels at high zoom
  if (!map.getLayer('households-labels-simple')) {
    map.addLayer({
      id: 'households-labels-simple',
      type: 'symbol',
      source: SRC_HOUSEHOLDS,
      layout: {
        'text-field': ['coalesce', ['get', 'numeroordre'], ''],
        'text-font': SAFE_FONT,
        'text-size': 13,
        'text-variable-anchor': ['top'],
        'text-radial-offset': 1.8,
        visibility: 'visible',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.9)',
        'text-halo-width': 2.5,
        'text-opacity': ['step', ['zoom'], 0, 15, 1],
      },
    });
  }


  // Selected highlight ring
  if (map.getSource(SRC_SELECTED) && !map.getLayer('selected-household-layer')) {
    map.addLayer({
      id: 'selected-household-layer',
      type: 'circle',
      source: SRC_SELECTED,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 18, 32],
        'circle-color': 'transparent',
        'circle-stroke-color': '#3b82f6',
        'circle-stroke-width': 3,
      },
    });
  }

  // Heatmap (hidden by default)
  if (!map.getLayer('heatmap')) {
    map.addLayer({
      id: 'heatmap',
      type: 'heatmap',
      source: SRC_HOUSEHOLDS,
      maxzoom: 17,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 8],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 45],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 20, 0.4],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(67,56,202,0)',
          0.4, 'rgba(59,130,246,0.6)',
          0.8, 'rgba(245,158,11,0.9)',
          1, 'rgba(239,68,68,1)',
        ],
      },
    });
  }

  logger.debug('✅ [HouseholdLayer] All layers created successfully');
}

// ─── Inject GeoJSON data into the source ──────────────────────
function pushData(map: maplibregl.Map, geoJSON: any, households: any[]) {
  const source = map.getSource(SRC_HOUSEHOLDS) as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    logger.warn('[HouseholdLayer] pushData: source not ready');
    return;
  }

  const withVisualProps = (feature: any) => {
    const properties = feature?.properties || {};
    const status = String(properties.status || 'default');
    return {
      ...feature,
      properties: {
        ...properties,
        status,
        iconId: getIconId(status),
      },
    };
  };

  let data: any = null;

  // Priority 1: Worker GeoJSON
  if (geoJSON?.features && geoJSON.features.length > 0) {
    data = {
      ...geoJSON,
      features: geoJSON.features.map(withVisualProps),
    };
  }
  // Priority 2: Raw array fallback
  else if (households && households.length > 0) {
    const features = households
      .map((h: any) => {
        let lng = Number(h.location?.coordinates?.[0] ?? h.longitude ?? 0);
        let lat = Number(h.location?.coordinates?.[1] ?? h.latitude ?? 0);

        // Senegal auto-correction
        if (lng > 0 && lat < 0) [lng, lat] = [lat, lng];
        if (Math.abs(lng) > 11 && Math.abs(lng) < 18) lng = -Math.abs(lng);
        if (Math.abs(lat) > 11 && Math.abs(lat) < 17) lat = Math.abs(lat);

        if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) return null;

        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: h.id,
            status: h.status || 'Non encore installée',
            iconId: getIconId(h.status || 'Non encore installée'),
            numeroordre: h.numeroordre || '',
            name: h.owner?.name || h.name || 'N/A',
          },
        };
      })
      .filter(Boolean);

    data = { type: 'FeatureCollection', features };
  } else {
    data = { type: 'FeatureCollection', features: [] };
  }

  source.setData(data as any);
  logger.debug(`✅ [HouseholdLayer] setData → ${data.features?.length ?? 0} features`);
}

// ─── Main Component ────────────────────────────────────────────
const HouseholdLayer: React.FC<HouseholdLayerProps> = ({
  map,
  householdGeoJSON,
  households = [],
  projectId,
  selectedHouseholdCoords = null,
  showHeatmap = false,
  styleIsReady,
  showZones = false,
}) => {
  const selectedPhases = useTerrainUIStore((s) => s.selectedPhases);
  const selectedTeam = useTerrainUIStore((s) => s.selectedTeam);

  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const dataRef = useRef({ householdGeoJSON, households });
  dataRef.current = { householdGeoJSON, households };

  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // ─── Click & Hover interactions ───────────────────────────────
  const setupClickHandlers = (map: maplibregl.Map) => {
    const INTERACTIVE_LAYERS = ['households-glow-layer', 'households-local-layer'];

    // Ensure popup instance
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'premium-map-popup',
        maxWidth: '300px',
        offset: 16,
      });
    }

    const openHousehold = (feature: any) => {
      if (!feature) return;
      const hId =
        feature.properties?.household_id ||
        feature.properties?.id ||
        (feature.id != null ? String(feature.id) : null);
      if (!hId) return;

      setSelectedHouseholdId(hId);

      // Show popup on desktop
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (!isMobile && popupRef.current && feature.geometry?.coordinates) {
        popupRef.current
          .setLngLat(feature.geometry.coordinates)
          .setHTML(generatePopupHTML(feature))
          .addTo(map);
      }
    };

    // Per-layer click
    INTERACTIVE_LAYERS.forEach((layerId) => {
      const onClick = (e: any) => {
        const f = e.features?.[0];
        if (f) {
          e.originalEvent?.stopPropagation?.();
          openHousehold(f);
        }
      };
      map.on('click', layerId, onClick);
    });

    // Fallback: map-level click with queryRenderedFeatures (wider hit area)
    const onMapClick = (e: any) => {
      if (!e?.point) return;
      const available = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id));
      if (available.length === 0) return;
      const pad = 10;
      const features = map.queryRenderedFeatures(
        [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]] as any,
        { layers: available }
      );
      if (features.length > 0) openHousehold(features[0]);
    };
    map.on('click', onMapClick);

    // Cursor on hover
    INTERACTIVE_LAYERS.forEach((layerId) => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });

    // Popup detail button listener
    const handleDetailEvent = (e: any) => {
      const hId = e.detail;
      if (hId) {
        setSelectedHouseholdId(hId);
        popupRef.current?.remove();
      }
    };
    window.addEventListener('map:select-household', handleDetailEvent);

    return () => {
      window.removeEventListener('map:select-household', handleDetailEvent);
      popupRef.current?.remove();
    };
  };

  // ── CORE: Setup sources + layers + data + click handlers ──
  useEffect(() => {
    if (!map) return;

    let clickCleanup: (() => void) | null = null;

    const stopRetry = () => {
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };

    const setup = (): boolean => {
      if (!map || (map as any)._removed) return true;
      if (!map.isStyleLoaded()) return false;

      try {
        ensureSources(map);
        ensureLayers(map);
        pushData(map, dataRef.current.householdGeoJSON, dataRef.current.households);

        // Attach click handlers once layers exist
        if (!clickCleanup) {
          clickCleanup = setupClickHandlers(map) || null;
        }

        return true;
      } catch (err) {
        logger.error('[HouseholdLayer] setup error:', err);
        return false;
      }
    };

    // Try immediately
    const ok = setup();

    if (!ok) {
      retryRef.current = setInterval(() => {
        if (setup()) stopRetry();
      }, 300);
    }

    // Re-run after style reloads (wipes everything)
    const handleStyleLoad = () => {
      stopRetry();
      clickCleanup?.();
      clickCleanup = null;
      const ok2 = setup();
      if (!ok2) {
        retryRef.current = setInterval(() => {
          if (setup()) stopRetry();
        }, 300);
      }
    };

    map.on('style.load', handleStyleLoad);

    return () => {
      stopRetry();
      clickCleanup?.();
      if (!(map as any)._removed) {
        map.off('style.load', handleStyleLoad);
      }
    };
  }, [map]); // Only depends on map instance


  // ── DATA UPDATE: re-push when GeoJSON changes ──
  useEffect(() => {
    if (!map || (map as any)._removed || !map.isStyleLoaded()) return;
    if (!map.getSource(SRC_HOUSEHOLDS)) return; // Not ready yet

    pushData(map, householdGeoJSON, households);
  }, [map, householdGeoJSON, households]);

  // ── SELECTED HOUSEHOLD HIGHLIGHT ──
  useEffect(() => {
    if (!map || (map as any)._removed || !map.isStyleLoaded()) return;
    const source = map.getSource(SRC_SELECTED) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: selectedHouseholdCoords
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: selectedHouseholdCoords }, properties: { selected: true } }]
        : [],
    });
  }, [map, selectedHouseholdCoords]);

  // ── HEATMAP TOGGLE ──
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('heatmap')) {
      map.setLayoutProperty('heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
    }
  }, [map, showHeatmap]);

  // ── ZOOM-BASED VISIBILITY ──
  useEffect(() => {
    if (!map) return;

    const updateVis = () => {
      if (!map.isStyleLoaded()) return;
      const zoom = map.getZoom();
      const showClusters = zoom < 15 && !showZones;

      ['cluster-halo', 'cluster-circles', 'cluster-counts'].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showClusters ? 'visible' : 'none');
      });
      if (map.getLayer('households-glow-layer')) {
        map.setLayoutProperty('households-glow-layer', 'visibility', 'visible');
      }
      if (map.getLayer('households-local-layer')) {
        map.setLayoutProperty('households-local-layer', 'visibility', 'visible');
      }
      if (map.getLayer('households-labels-simple')) {
        map.setLayoutProperty('households-labels-simple', 'visibility', zoom >= 15 ? 'visible' : 'none');
      }
    };

    updateVis();
    map.on('zoom', updateVis);
    map.on('zoomend', updateVis);
    map.on('styledata', updateVis);

    return () => {
      if (!(map as any)._removed) {
        map.off('zoom', updateVis);
        map.off('zoomend', updateVis);
        map.off('styledata', updateVis);
      }
    };
  }, [map, showZones]);

  return null;
};

export default React.memo(HouseholdLayer);
