/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTerrainUIStore } from '../../../store/terrainUIStore';
import logger from '../../../utils/logger';
import { generatePopupHTML } from '../mapUtils';
import { getIconId } from '../mapConfig';
import { getHouseholdDisplayName } from '../../../utils/householdDisplay';

interface HouseholdLayerProps {
  map: maplibregl.Map | null;
  householdGeoJSON: any;
  households?: any[];
  projectId?: string;
  selectedHouseholdCoords?: [number, number] | null;
  showHeatmap?: boolean;
  styleIsReady: boolean;
  iconsReady: boolean;
  showZones?: boolean;
}

const SAFE_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];

const isMapAlive = (map: maplibregl.Map | null) =>
  Boolean(map && !(map as any)._removed && !!map.getStyle());

// ─── Source IDs ───────────────────────────────────────────────
const SRC_HOUSEHOLDS = 'households';
const SRC_CLUSTERS = 'supercluster-generated';
const SRC_HULLS = 'cluster-hulls';
const SRC_HULL_LABELS = 'cluster-hull-labels';
const SRC_SELECTED = 'selected-household';

function ensureZoneBadgeImages(map: maplibregl.Map) {
  const makePill = (id: string, fill: string, stroke: string) => {
    if (map.hasImage(id)) return;

    const width = 196;
    const height = 72;
    const radius = 26;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, fill);
    gradient.addColorStop(1, 'rgba(6, 10, 18, 0.58)');

    drawRoundedRect(6, 8, width - 12, height - 16, radius);
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(2, 6, 23, 0.28)';
    ctx.shadowBlur = 18;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    map.addImage(id, {
      width,
      height,
      data: ctx.getImageData(0, 0, width, height).data,
    });
  };

  makePill('zone-badge-pill', 'rgba(8, 12, 20, 0.72)', 'rgba(255,255,255,0.14)');
  makePill('zone-badge-pill-alert', 'rgba(56, 16, 24, 0.82)', 'rgba(252, 165, 165, 0.24)');
}

// ─── Create all GeoJSON sources on the map ────────────────────
function ensureSources(map: maplibregl.Map) {
  if (!isMapAlive(map)) return;
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
  if (!map.getSource(SRC_HULL_LABELS)) {
    map.addSource(SRC_HULL_LABELS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getSource(SRC_SELECTED)) {
    map.addSource(SRC_SELECTED, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
}

// ─── Create all layers ────────────────────────────────────────
function ensureLayers(map: maplibregl.Map, iconsReady: boolean) {
  // Guard: need sources
  if (!map.getSource(SRC_HOUSEHOLDS) || !map.getSource(SRC_CLUSTERS)) return;
  ensureZoneBadgeImages(map);

  if (!map.getLayer('cluster-zone-fill')) {
    map.addLayer({
      id: 'cluster-zone-fill',
      type: 'fill',
      source: SRC_HULLS,
      paint: {
        'fill-color': ['coalesce', ['get', 'zoneColor'], '#0F766E'],
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.11,
            ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
            0.09,
            ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
            0.075,
            ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 0]],
            0.032,
            0.05,
          ],
          13.5,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.085,
            ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
            0.065,
            ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
            0.052,
            ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 0]],
            0.022,
            0.038,
          ],
          16,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.05,
            ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
            0.04,
            ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
            0.032,
            ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 0]],
            0.014,
            0.024,
          ],
        ],
      },
    });
  }

  if (!map.getLayer('cluster-zone-outline')) {
    map.addLayer({
      id: 'cluster-zone-outline',
      type: 'line',
      source: SRC_HULLS,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          '#FDE7E7',
          ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
          '#FFF0C2',
          ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
          '#FFF5CC',
          '#E6FFFA',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.45, 15, 1.8, 17, 1.65],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.88, 13.5, 0.96, 17, 0.8],
        'line-dasharray': [0.8, 1.6],
      },
    });
  }

  if (!map.getLayer('cluster-zone-accent')) {
    map.addLayer({
      id: 'cluster-zone-accent',
      type: 'line',
      source: SRC_HULLS,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['coalesce', ['get', 'zoneStroke'], '#99F6E4'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 12, 2.1, 15, 2.6, 17, 2.2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.26, 13.5, 0.38, 17, 0.3],
        'line-dasharray': [2.1, 3],
      },
    });
  }

  if (!map.getLayer('cluster-zone-halo')) {
    map.addLayer({
      id: 'cluster-zone-halo',
      type: 'line',
      source: SRC_HULLS,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['coalesce', ['get', 'zoneHalo'], '#2DD4BF'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4.4, 12, 6.8, 15, 8.4],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.16,
            0.045,
          ],
          14.5,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.11,
            0.024,
          ],
          16.5,
          [
            'case',
            ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
            0.08,
            0.014,
          ],
        ],
        'line-blur': 2.4,
      },
    });
  }

  if (!map.getLayer('cluster-zone-badge-glow')) {
    map.addLayer({
      id: 'cluster-zone-badge-glow',
      type: 'circle',
      source: SRC_HULL_LABELS,
      filter: ['==', ['coalesce', ['get', 'showLabel'], false], true],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 8, 18, 180, 28],
        'circle-color': ['coalesce', ['get', 'zoneHalo'], '#22D3EE'],
        'circle-opacity': 0.1,
        'circle-blur': 1.8,
      },
    });
  }

  if (!map.getLayer('cluster-zone-badge-shell')) {
    map.addLayer({
      id: 'cluster-zone-badge-shell',
      type: 'symbol',
      source: SRC_HULL_LABELS,
      filter: ['==', ['coalesce', ['get', 'showLabel'], false], true],
      layout: {
        'icon-image': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          'zone-badge-pill-alert',
          'zone-badge-pill',
        ],
        'icon-size': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 8, 0.5, 120, 0.68, 220, 0.82],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  if (!map.getLayer('cluster-zone-name-labels')) {
    map.addLayer({
      id: 'cluster-zone-name-labels',
      type: 'symbol',
      source: SRC_HULL_LABELS,
      minzoom: 9.5,
      layout: {
        'text-field': ['coalesce', ['get', 'labelName'], ''],
        'text-font': SAFE_FONT,
        'text-size': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 8, 10.5, 120, 13.5],
        'text-line-height': 1,
        'text-letter-spacing': 0.015,
        'text-justify': 'center',
        'text-anchor': 'bottom',
        'text-offset': [0, -0.65],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-max-width': 10,
      },
      paint: {
        'text-color': '#E8EEF8',
        'text-halo-color': 'rgba(6,10,18,0.48)',
        'text-halo-width': 1,
        'text-halo-blur': 0,
      },
    });
  }

  if (!map.getLayer('cluster-zone-labels')) {
    map.addLayer({
      id: 'cluster-zone-labels',
      type: 'symbol',
      source: SRC_HULL_LABELS,
      minzoom: 9.5,
      layout: {
        'text-field': [
          'step',
          ['zoom'],
          ['coalesce', ['get', 'labelMetricCompact'], ['get', 'labelTiny'], ''],
          12.5,
          ['coalesce', ['get', 'labelMetric'], ['get', 'labelTiny'], ''],
        ],
        'text-font': SAFE_FONT,
        'text-size': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 8, 9.2, 120, 11.4],
        'text-line-height': 1,
        'text-letter-spacing': 0.008,
        'text-justify': 'center',
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-max-width': 7,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': 'rgba(5,10,20,0.12)',
        'text-halo-width': 0.45,
        'text-halo-blur': 0,
      },
    });
  }

  // Cluster halo
  if (!map.getLayer('cluster-halo')) {
    map.addLayer({
      id: 'cluster-halo',
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['==', ['coalesce', ['get', 'cluster'], false], true],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 10, 26, 100, 50],
        'circle-color': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          '#7F1D1D',
          ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
          '#7C2D12',
          ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
          '#78350F',
          ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 1]],
          '#064E3B',
          '#134E4A',
        ],
        'circle-opacity': 0.14,
        'circle-blur': 1.2,
      },
    });
  }

  // Cluster circles
  if (!map.getLayer('cluster-circles')) {
    map.addLayer({
      id: 'cluster-circles',
      type: 'circle',
      source: SRC_CLUSTERS,
      filter: ['==', ['coalesce', ['get', 'cluster'], false], true],
      paint: {
        'circle-color': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          '#C62828',
          ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
          '#D97706',
          ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
          '#C58F00',
          ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 1]],
          '#059669',
          '#0F766E',
        ],
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 10, 12, 100, 24],
        'circle-opacity': 0.22,
        'circle-stroke-width': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 10, 2, 100, 3],
        'circle-stroke-color': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          '#FCA5A5',
          ['>', ['coalesce', ['get', 'blocked_count'], 0], 0],
          '#FCD34D',
          ['>', ['coalesce', ['get', 'pending_count'], 0], 0],
          '#FDE68A',
          ['==', ['coalesce', ['get', 'compliant_count'], 0], ['coalesce', ['get', 'point_count'], 1]],
          '#A7F3D0',
          '#99F6E4',
        ],
      },
    });
  }

  // Cluster counts
  if (!map.getLayer('cluster-counts')) {
    map.addLayer({
      id: 'cluster-counts',
      type: 'symbol',
      source: SRC_CLUSTERS,
      filter: ['==', ['coalesce', ['get', 'cluster'], false], true],
      layout: {
        'text-field': [
          'case',
          ['>', ['coalesce', ['get', 'critical_count'], 0], 0],
          [
            'concat',
            ['to-string', ['coalesce', ['get', 'point_count'], 1]],
            '\n',
            ['to-string', ['coalesce', ['get', 'critical_count'], 0]],
            ' urg.',
          ],
          ['to-string', ['coalesce', ['get', 'point_count'], 1]],
        ],
        'text-font': SAFE_FONT,
        'text-size': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1], 10, 11, 100, 13],
        'text-allow-overlap': true,
        'text-line-height': 0.95,
        'text-letter-spacing': 0.02,
        'text-justify': 'center',
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(2,6,23,0.92)',
        'text-halo-width': 3,
        'text-halo-blur': 0.5,
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
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.4, 10, 3.8, 14, 5.8, 18, 8.4],
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
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.22, 13, 0.48, 16, 0.72],
        'circle-stroke-width': 1.15,
        'circle-stroke-color': 'rgba(255,255,255,0.42)',
      },
    });
    logger.debug('✅ [HouseholdLayer] layer: households-glow-layer created');
  }

  // Icon symbols
  if (iconsReady && !map.getLayer('households-local-layer')) {
    map.addLayer({
      id: 'households-local-layer',
      type: 'symbol',
      source: SRC_HOUSEHOLDS,
      layout: {
        'icon-image': [
          'concat', 'icon-', ['coalesce', ['get', 'iconId'], 'default'], '-small'
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.36, 13, 0.58, 15, 0.8, 18, 0.96],
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
      minzoom: 15,
      layout: {
        'text-field': ['coalesce', ['get', 'numeroordre'], ''],
        'text-font': SAFE_FONT,
        'text-size': 13,
        'text-variable-anchor': ['top'],
        'text-radial-offset': 1.8,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
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
            name: getHouseholdDisplayName(h),
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
  selectedHouseholdCoords = null,
  showHeatmap = false,
  styleIsReady,
  iconsReady,
  showZones = false,
}) => {
  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const dataRef = useRef({ householdGeoJSON, households });

  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    dataRef.current = { householdGeoJSON, households };
  }, [householdGeoJSON, households]);

  // ─── Click & Hover interactions ───────────────────────────────
  const setupClickHandlers = useCallback((map: maplibregl.Map) => {
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

    const onZoneClick = (e: any) => {
      const feature = e.features?.[0];
      const bbox = feature?.properties?.bbox;
      if (!Array.isArray(bbox) || bbox.length !== 4) return;
      map.fitBounds(
        [
          [Number(bbox[0]), Number(bbox[1])],
          [Number(bbox[2]), Number(bbox[3])],
        ],
        { padding: 72, duration: 700, maxZoom: 24 }
      );
    };

    ['cluster-zone-fill', 'cluster-zone-badge-shell', 'cluster-zone-name-labels', 'cluster-zone-labels'].forEach((layerId) => {
      map.on('click', layerId, onZoneClick);
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });

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
      ['cluster-zone-fill', 'cluster-zone-badge-shell', 'cluster-zone-name-labels', 'cluster-zone-labels'].forEach((layerId) => {
        map.off('click', layerId, onZoneClick);
      });
      popupRef.current?.remove();
    };
  }, [setSelectedHouseholdId]);

  // ── CORE: Setup sources + layers + data + click handlers ──
  useEffect(() => {
    if (!map || !styleIsReady) return;

    let clickCleanup: (() => void) | null = null;

    const stopRetry = () => {
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };

    const setup = async (): Promise<boolean> => {
      if (!isMapAlive(map)) return true;
      if (!styleIsReady) return false;
      if (!map.isStyleLoaded()) return false;

      try {
        // Step 1: Baseline data structures (Immediate)
        ensureSources(map);
        pushData(map, dataRef.current.householdGeoJSON, dataRef.current.households);

        // Step 2: Visual Layers (Base ones will be added, icon-ones will wait for iconsReady)
        ensureLayers(map, iconsReady);

        // Step 3: Icons (Potentially slightly delayed but we try to be fast)
        // We only proceed to full symbol rendering if icons are confirmed
        // Note: ensureLayers already checks for existence, so this is safe

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
    setup().then((ok) => {
      if (!ok) {
        retryRef.current = setInterval(async () => {
          if (await setup()) stopRetry();
        }, 300);
      }
    });

    // Re-run after style reloads (wipes everything)
    const handleStyleLoad = () => {
      stopRetry();
      clickCleanup?.();
      clickCleanup = null;
      setup().then((ok2) => {
        if (!ok2) {
          retryRef.current = setInterval(async () => {
            if (await setup()) stopRetry();
          }, 300);
        }
      });
    };

    map.on('style.load', handleStyleLoad);

    return () => {
      stopRetry();
      clickCleanup?.();
      if (!(map as any)._removed) {
        map.off('style.load', handleStyleLoad);
      }
    };
  }, [iconsReady, map, setupClickHandlers, styleIsReady]);


  // ── DATA UPDATE: re-push when GeoJSON changes ──
  useEffect(() => {
    if (!map || !styleIsReady || (map as any)._removed || !map.getStyle() || !map.isStyleLoaded()) return;
    if (!map.getSource(SRC_HOUSEHOLDS)) return; // Not ready yet

    pushData(map, householdGeoJSON, households);
  }, [map, styleIsReady, householdGeoJSON, households]);

  // ── SELECTED HOUSEHOLD HIGHLIGHT ──
  useEffect(() => {
    if (!map || (map as any)._removed || !map.getStyle() || !map.isStyleLoaded()) return;
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
    if (!map || !map.getStyle() || !map.isStyleLoaded()) return;
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
      const showZoneFill = !showZones;
      const showZoneOutline = !showZones;
      const showZoneHalo = zoom < 19.5 && !showZones;
      const showZoneLabels = zoom < 20.25 && !showZones;
      const showClusters = zoom >= 14 && zoom < 15.25 && !showZones;
      const showHouseholdPoints = zoom >= 11.5 || showZones;

      ['cluster-halo', 'cluster-circles', 'cluster-counts'].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showClusters ? 'visible' : 'none');
      });
      if (map.getLayer('cluster-zone-fill')) {
        map.setLayoutProperty('cluster-zone-fill', 'visibility', showZoneFill ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-zone-outline')) {
        map.setLayoutProperty(
          'cluster-zone-outline',
          'visibility',
          showZoneOutline ? 'visible' : 'none'
        );
      }
      if (map.getLayer('cluster-zone-accent')) {
        map.setLayoutProperty(
          'cluster-zone-accent',
          'visibility',
          showZoneOutline ? 'visible' : 'none'
        );
      }
      if (map.getLayer('cluster-zone-halo')) {
        map.setLayoutProperty('cluster-zone-halo', 'visibility', showZoneHalo ? 'visible' : 'none');
      }
      if (map.getLayer('cluster-zone-badge-glow')) {
        map.setLayoutProperty(
          'cluster-zone-badge-glow',
          'visibility',
          showZoneLabels ? 'visible' : 'none'
        );
      }
      if (map.getLayer('cluster-zone-badge-shell')) {
        map.setLayoutProperty(
          'cluster-zone-badge-shell',
          'visibility',
          showZoneLabels ? 'visible' : 'none'
        );
      }
      if (map.getLayer('cluster-zone-labels')) {
        map.setLayoutProperty(
          'cluster-zone-labels',
          'visibility',
          showZoneLabels ? 'visible' : 'none'
        );
      }
      if (map.getLayer('cluster-zone-name-labels')) {
        map.setLayoutProperty(
          'cluster-zone-name-labels',
          'visibility',
          showZoneLabels ? 'visible' : 'none'
        );
      }
      if (map.getLayer('households-glow-layer')) {
        map.setLayoutProperty('households-glow-layer', 'visibility', showHouseholdPoints ? 'visible' : 'none');
      }
      if (map.getLayer('households-local-layer')) {
        map.setLayoutProperty('households-local-layer', 'visibility', showHouseholdPoints ? 'visible' : 'none');
      }
      if (map.getLayer('households-labels-simple')) {
        map.setLayoutProperty(
          'households-labels-simple',
          'visibility',
          zoom >= 16.25 && !showZones ? 'visible' : 'none'
        );
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
