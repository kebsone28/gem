/**
 * MapViewEnhanced - Carte interactive Leaflet avec clustering + heatmap
 * 100% Open Source (Leaflet + OpenStreetMap + MarkerCluster + Heatmap)
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Coordinate {
  lat: number;
  lon: number;
}

interface MapPoint {
  id: string;
  coordinates: Coordinate;
  label: string;
  subtitle?: string;
  color?: string;
}

interface BoundsFilter {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface MapViewEnhancedProps {
  points: MapPoint[];
  height?: number;
  onPointClick?: (id: string) => void;
  selectedId?: string | null;
  onFilterByBounds?: (bounds: BoundsFilter) => void;
  activeFilterBounds?: BoundsFilter | null;
}

export const MapViewEnhanced: React.FC<MapViewEnhancedProps> = ({
  points,
  height = 420,
  onPointClick,
  selectedId,
  onFilterByBounds,
  activeFilterBounds,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawnRect, setDrawnRect] = useState<L.Rectangle | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      zoomSnap: 0.5,
    }).setView([14.5, -14.5], 7); // Centered on Senegal

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // MarkerCluster group
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 10) size = 'medium';
        if (count >= 50) size = 'large';
        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
          className: 'custom-cluster',
          iconSize: L.point(40, 40),
        });
      },
    });
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    mapInstanceRef.current = map;

    // Fit bounds if there are points
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.coordinates.lat, p.coordinates.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    // Listen for boxzoom (Shift+drag) events
    map.on('boxzoomend', (e: any) => {
      if (!onFilterByBounds) return;
      const bounds = e.boxZoomBounds as L.LatLngBounds;
      if (bounds && bounds.isValid()) {
        onFilterByBounds({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLon: bounds.getWest(),
          maxLon: bounds.getEast(),
        });
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when points change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    // Clear existing markers
    clusterGroup.clearLayers();
    markersRef.current.clear();

    // Remove existing heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (points.length === 0) return;

    const bounds = L.latLngBounds([]);

    points.forEach((point) => {
      const latLng: L.LatLngExpression = [point.coordinates.lat, point.coordinates.lon];
      bounds.extend(latLng);

      const isSelected = point.id === selectedId;
      const markerColor = point.color || (isSelected ? '#2563eb' : '#06b6d4');

      const markerHtml = `<div style="
        width: ${isSelected ? '20px' : '14px'};
        height: ${isSelected ? '20px' : '14px'};
        border-radius: 50%;
        background: ${markerColor};
        border: ${isSelected ? '3px solid #1e40af' : '2px solid white'};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>`;

      const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-marker',
        iconSize: L.point(isSelected ? 20 : 14, isSelected ? 20 : 14),
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });

      const marker = L.marker(latLng, { icon });
      marker.bindTooltip(point.label, {
        direction: 'top',
        offset: L.point(0, -10),
        className: 'ged-marker-tooltip',
      });

      if (onPointClick) {
        marker.on('click', () => onPointClick(point.id));
      }

      clusterGroup.addLayer(marker);
      markersRef.current.set(point.id, marker);
    });

    if (points.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    // Re-add heat layer if active
    if (showHeatmap) {
      addHeatLayer(map, points);
    }
  }, [points, selectedId, onPointClick]);

  // Toggle heatmap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showHeatmap) {
      addHeatLayer(map, points);
    } else {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    }
  }, [showHeatmap, points]);

  // Update drawn rectangle when activeFilterBounds changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous rectangle
    if (drawnRect) {
      map.removeLayer(drawnRect);
      setDrawnRect(null);
    }

    if (activeFilterBounds) {
      const bounds = L.latLngBounds(
        [activeFilterBounds.minLat, activeFilterBounds.minLon],
        [activeFilterBounds.maxLat, activeFilterBounds.maxLon]
      );
      const rect = L.rectangle(bounds, {
        color: '#2563eb',
        weight: 2,
        fillOpacity: 0.08,
        dashArray: '6 4',
      }).addTo(map);
      setDrawnRect(rect);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [activeFilterBounds]);

  return (
    <div className="relative">
      <style>{`
        .custom-cluster { background: none !important; }
        .cluster-icon {
          width: 40px; height: 40px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 13px;
          color: white;
          border: 3px solid rgba(255,255,255,0.7);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .cluster-small { background: #06b6d4; }
        .cluster-medium { background: #f59e0b; }
        .cluster-large { background: #ef4444; }
        .ged-marker-tooltip {
          background: #1e293b !important;
          color: white !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          padding: 6px 12px !important;
          border: none !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .ged-marker-tooltip::before {
          border-top-color: #1e293b !important;
        }
      `}</style>

      {/* Controls */}
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowHeatmap((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg transition ${
            showHeatmap
              ? 'bg-orange-500 text-white'
              : 'bg-white/90 text-slate-700 hover:bg-white'
          }`}
        >
          🔥 Heatmap
        </button>
        {onFilterByBounds && (
          <button
            type="button"
            onMouseDown={() => setDrawMode(true)}
            onMouseUp={() => setDrawMode(false)}
            onMouseLeave={() => setDrawMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg transition ${
              activeFilterBounds
                ? 'bg-blue-600 text-white'
                : 'bg-white/90 text-slate-700 hover:bg-white'
            }`}
            title="Shift + cliquer-glisser pour dessiner une zone de filtre"
          >
            🟦 Zone
          </button>
        )}
        {activeFilterBounds && onFilterByBounds && (
          <button
            type="button"
            onClick={() => onFilterByBounds(null as any)}
            className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg hover:bg-rose-600"
          >
            ✕ Effacer zone
          </button>
        )}
      </div>

      <div ref={mapRef} style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }} />
    </div>
  );
};

function addHeatLayer(map: L.Map, points: MapPoint[]) {
  // Remove existing heat layer
  if ((window as any).__gedHeatLayer) {
    map.removeLayer((window as any).__gedHeatLayer);
  }

  if (points.length < 3) return;

  // Use leaflet.heat
  const heatPoints: Array<[number, number, number]> = points.map((p) => [
    p.coordinates.lat,
    p.coordinates.lon,
    0.8, // intensity
  ]);

  try {
    if (typeof (L as any).heatLayer === 'function') {
      const heatLayer = (L as any).heatLayer(heatPoints, {
        radius: 30,
        blur: 20,
        maxZoom: 12,
        max: 1.0,
        gradient: { 0.4: '#06b6d4', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#dc2626' },
      });
      heatLayer.addTo(map);
      (window as any).__gedHeatLayer = heatLayer;
    }
  } catch {
    // leaflet.heat not available
  }
}
