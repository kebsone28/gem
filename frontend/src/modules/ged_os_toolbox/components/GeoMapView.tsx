/**
 * GeoMapView - Affiche geopoint / geotrace / geoshape sur une carte Leaflet
 * 100% Open Source (Leaflet + OpenStreetMap)
 * Compatible format XLSForm natif: "lat lon alt acc ..."
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Corriger les icônes Leaflet par défaut (problème webpack/vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Coordinate {
  latitude: number;
  longitude: number;
}

/** Parse format XForm "lat lon alt acc; lat lon alt acc" ou "lat lon alt acc lat lon alt acc" */
function parseXFormGeoString(geoString: string | null | undefined): Coordinate[] {
  if (!geoString) return [];

  let points: string[] = [];
  if (geoString.includes(';')) {
    points = geoString.split(';').map((p) => p.trim());
  } else {
    const tokens = geoString.split(/\s+/).filter(Boolean);
    // Auto-détecter groupement par 4 (lat lon alt acc) ou 2 (lat lon)
    const step = tokens.length % 4 === 0 ? 4 : 2;
    for (let i = 0; i < tokens.length; i += step) {
      points.push(tokens.slice(i, i + step).join(' '));
    }
  }

  const coords: Coordinate[] = [];
  for (const point of points) {
    const parts = point.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        coords.push({ latitude: lat, longitude: lon });
      }
    }
  }
  return coords;
}

interface GeoMapViewProps {
  /** Valeur brute du champ (format XForm: "lat lon alt acc ...") */
  value: string;
  /** Type de champ XLSForm */
  type: 'geopoint' | 'geotrace' | 'geoshape';
  /** Hauteur de la carte en px */
  height?: number;
  /** Lecture seule */
  readOnly?: boolean;
  /** Classe CSS additionnelle */
  className?: string;
}

export const GeoMapView: React.FC<GeoMapViewProps> = ({
  value,
  type,
  height = 300,
  readOnly = true,
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([0, 0], 2);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const coords = parseXFormGeoString(value);
    if (coords.length === 0) return;

    if (type === 'geopoint') {
      const [c] = coords;
      map.setView([c.latitude, c.longitude], 16);
      L.marker([c.latitude, c.longitude]).addTo(map);
    } else if (type === 'geotrace') {
      const latLngs = coords.map((c) => [c.latitude, c.longitude] as L.LatLngExpression);
      const polyline = L.polyline(latLngs, { color: '#4f8cff', weight: 4, opacity: 0.8 }).addTo(map);
      map.fitBounds(polyline.getBounds());
      // Marqueurs début/fin
      L.circleMarker(latLngs[0], { radius: 6, color: '#22c55e', fillColor: '#22c55e' }).addTo(map).bindPopup('Début');
      L.circleMarker(latLngs[latLngs.length - 1], { radius: 6, color: '#ff4757', fillColor: '#ff4757' }).addTo(map).bindPopup('Fin');
    } else if (type === 'geoshape') {
      const latLngs = coords.map((c) => [c.latitude, c.longitude] as L.LatLngExpression);
      if (latLngs.length > 0) latLngs.push(latLngs[0]); // Fermer le polygone
      const polygon = L.polygon(latLngs, { color: '#4f8cff', weight: 3, fillColor: '#4f8cff', fillOpacity: 0.2 }).addTo(map);
      map.fitBounds(polygon.getBounds());
      // Marqueurs sommets
      coords.forEach((c, i) =>
        L.circleMarker([c.latitude, c.longitude], { radius: 5, color: '#fff', fillColor: '#4f8cff', weight: 2 })
          .addTo(map)
          .bindPopup(`Point ${i + 1}`)
      );
    }
  }, [value, type]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}
      className={className}
    />
  );
};
