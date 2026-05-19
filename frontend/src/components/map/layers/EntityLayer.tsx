/**
 * EntityLayer — Couche MapLibre générique pour tous les domaines GED OS.
 *
 * Remplace le couplage fort de HouseholdLayer (électrification uniquement)
 * par un composant configurable par domaine. Les styles (couleurs, rayon)
 * sont définis dans DOMAIN_STYLES et surchargés via la prop `styleOverride`.
 *
 * Usage :
 *   <EntityLayer domainType="electricity" features={geojsonFeatures} />
 *   <EntityLayer domainType="agriculture" features={geojsonFeatures} styleOverride={{ color: '#10b981' }} />
 *   <EntityLayer domainType="health"      features={geojsonFeatures} />
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Map, Popup } from 'maplibre-gl';
import { MapContext } from '../MapLibreVectorMap';
import { useCluster } from '../../../services/cluster/useCluster';

// ── Domain Style Registry ──────────────────────────────────────────────────
export type DomainType =
  | 'electricity'
  | 'agriculture'
  | 'health'
  | 'logistics'
  | 'highvoltage'
  | 'solar'
  | 'targeting'
  | 'custom';

interface DomainStyle {
  /** Couleur des points non-cluster */
  color: string;
  /** Couleur des clusters */
  clusterColor: string;
  /** Rayon des points individuels */
  radius: number;
  /** Emoji ou label court pour les popups */
  emoji: string;
  /** Libellé humain du domaine */
  label: string;
}

export const DOMAIN_STYLES: Record<DomainType, DomainStyle> = {
  electricity: {
    color: '#22c55e',
    clusterColor: '#ff7a59',
    radius: 6,
    emoji: '⚡',
    label: 'Électrification',
  },
  agriculture: {
    color: '#10b981',
    clusterColor: '#059669',
    radius: 7,
    emoji: '🌱',
    label: 'Agriculture',
  },
  health: {
    color: '#3b82f6',
    clusterColor: '#1d4ed8',
    radius: 7,
    emoji: '🏥',
    label: 'Santé',
  },
  logistics: {
    color: '#f59e0b',
    clusterColor: '#d97706',
    radius: 7,
    emoji: '🚛',
    label: 'Logistique',
  },
  highvoltage: {
    color: '#ef4444',
    clusterColor: '#b91c1c',
    radius: 8,
    emoji: '🔌',
    label: 'Haute Tension',
  },
  solar: {
    color: '#eab308',
    clusterColor: '#ca8a04',
    radius: 6,
    emoji: '☀️',
    label: 'Solaire',
  },
  targeting: {
    color: '#8b5cf6',
    clusterColor: '#6d28d9',
    radius: 6,
    emoji: '🎯',
    label: 'Ciblage',
  },
  custom: {
    color: '#6b7280',
    clusterColor: '#374151',
    radius: 6,
    emoji: '📍',
    label: 'Entité',
  },
};

// ── Types ──────────────────────────────────────────────────────────────────
export interface GeoEntity {
  id: string;
  name?: string;
  status?: string;
  location?: { lat: number; lng: number } | null;
  domainData?: Record<string, any>;
  [key: string]: any;
}

export interface EntityLayerProps {
  /** Identifiant unique de la couche MapLibre (doit être unique si multiple couches) */
  id?: string;
  /** Domaine GED OS → applique les styles correspondants */
  domainType: DomainType;
  /** Entités à afficher. Si fourni, court-circuite le hook interne. */
  features?: GeoJSON.Feature[];
  /** Surcharge partielle des styles du domaine */
  styleOverride?: Partial<DomainStyle>;
  /** Callback on single entity click */
  onEntityClick?: (entity: GeoJSON.Feature) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function entitiesToGeoJSON(entities: GeoEntity[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = entities
    .filter((e) => e.location?.lat && e.location?.lng)
    .map((e) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [e.location!.lng, e.location!.lat],
      },
      properties: {
        id: e.id,
        name: e.name || e.id,
        status: e.status || '',
        ...e.domainData,
      },
    }));
  return { type: 'FeatureCollection', features };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function EntityLayer({
  id = 'entities',
  domainType,
  features,
  styleOverride,
  onEntityClick,
}: EntityLayerProps) {
  const { map, isStyleLoaded } = useContext(MapContext);
  const baseStyle = DOMAIN_STYLES[domainType] ?? DOMAIN_STYLES.custom;
  const style: DomainStyle = { ...baseStyle, ...styleOverride };

  const { ready, clusters, load, getClusters, getLeaves } = useCluster();
  const [snapshot, setSnapshot] = useState<GeoJSON.FeatureCollection | null>(null);
  const popupRef = useRef<Popup | null>(null);

  // Quand les features sont passées directement (mode API externe)
  useEffect(() => {
    if (!features) return;
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    setSnapshot(fc);
    if (ready && features.length) load(features);
  }, [features, ready, load]);

  // Enregistrement des sources/couches MapLibre (idempotent)
  useEffect(() => {
    if (!map || !isStyleLoaded()) return;

    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    if (!map.getLayer(id + '-clusters')) {
      map.addLayer({
        id: id + '-clusters',
        type: 'circle',
        source: id,
        paint: {
          'circle-radius': [
            'case',
            ['has', 'point_count'],
            ['interpolate', ['linear'], ['get', 'point_count'], 1, 12, 100, 40],
            style.radius,
          ],
          'circle-color': [
            'case',
            ['has', 'point_count'],
            style.clusterColor,
            style.color,
          ],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.92,
        },
      });
    }

    if (!map.getLayer(id + '-unclustered')) {
      map.addLayer({
        id: id + '-unclustered',
        type: 'circle',
        source: id,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': style.radius,
          'circle-color': style.color,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.92,
        },
      });
    }

    if (!map.getLayer(id + '-count')) {
      map.addLayer({
        id: id + '-count',
        type: 'symbol',
        source: id,
        layout: {
          'text-field': ['to-string', ['coalesce', ['get', 'point_count'], '']],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#fff' },
      });
    }

    return () => {
      try { if (map.getLayer(id + '-count')) map.removeLayer(id + '-count'); } catch (_) {}
      try { if (map.getLayer(id + '-unclustered')) map.removeLayer(id + '-unclustered'); } catch (_) {}
      try { if (map.getLayer(id + '-clusters')) map.removeLayer(id + '-clusters'); } catch (_) {}
      try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
    };
  }, [map, isStyleLoaded, id, style]);

  // Update source data depuis clusters worker
  useEffect(() => {
    if (!map || !clusters) return;
    const fc = { type: 'FeatureCollection', features: clusters as any[] };
    try {
      const src = map.getSource(id) as any;
      if (src) src.setData(fc);
    } catch (_) {}
  }, [clusters, map, id]);

  // Demander les clusters au moveend
  useEffect(() => {
    if (!map) return;
    const onMove = async () => {
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const z = Math.round(map.getZoom());
      try { await getClusters(bbox, z); } catch (_) {}
    };
    map.on('moveend', onMove);
    return () => { map.off('moveend', onMove); };
  }, [map, getClusters]);

  // Interactions : hover popup + clic (expansion cluster / callback)
  useEffect(() => {
    if (!map) return;

    const onMouseMove = (e: any) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [id + '-unclustered', id + '-clusters'],
      });
      if (!feats.length) {
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
        map.getCanvas().style.cursor = '';
        return;
      }
      const f = feats[0];
      map.getCanvas().style.cursor = 'pointer';
      const coords = (f.geometry as any).coordinates.slice();
      const props = f.properties || {};
      const html = `
        <div style="min-width:150px;padding:8px 12px;border-radius:12px;backdrop-filter:blur(8px);
          background:rgba(0,0,0,0.7);color:#fff;font-size:13px;line-height:1.4">
          <strong>${style.emoji} ${props.name || props.id || style.label}</strong>
          ${props.status ? `<br/><small style="opacity:.75">${props.status}</small>` : ''}
        </div>`;
      if (!popupRef.current) {
        popupRef.current = new Popup({ closeButton: false, closeOnClick: false });
      }
      popupRef.current.setLngLat(coords).setHTML(html).addTo(map);
    };

    const onClick = async (e: any) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [id + '-clusters', id + '-unclustered'],
      });
      if (!feats.length) return;
      const f = feats[0];
      const props = f.properties || {};
      const coords = (f.geometry as any).coordinates.slice();
      const isCluster = !!props.cluster || !!props.cluster_id || !!props.point_count;

      if (isCluster) {
        const clusterId = Number(props.cluster_id ?? props.clusterId);
        try {
          const leaves = await getLeaves(clusterId, 200);
          if (leaves?.length) {
            let minX = 180, minY = 90, maxX = -180, maxY = -90;
            for (const lf of leaves) {
              const c = (lf.geometry as any).coordinates;
              if (!c) continue;
              const [x, y] = c;
              if (x < minX) minX = x; if (y < minY) minY = y;
              if (x > maxX) maxX = x; if (y > maxY) maxY = y;
            }
            if (minX === maxX && minY === maxY) { const p = 0.01; minX -= p; minY -= p; maxX += p; maxY += p; }
            map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 700 });
          }
        } catch (_) {}
      } else {
        onEntityClick?.(f);
        const html = `
          <div style="min-width:200px;padding:10px 14px;border-radius:12px;backdrop-filter:blur(8px);
            background:rgba(0,0,0,0.75);color:#fff">
            <strong>${style.emoji} ${props.name || props.id || style.label}</strong>
            ${props.status ? `<div style="opacity:.8;font-size:12px;margin-top:4px">${props.status}</div>` : ''}
          </div>`;
        new Popup({ offset: 12 }).setLngLat(coords).setHTML(html).addTo(map);
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('click', onClick);
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('click', onClick);
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    };
  }, [map, id, style, getLeaves, onEntityClick]);

  return null;
}
