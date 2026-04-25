 
import type { StyleSpecification } from 'maplibre-gl';

/**
 * mapConfig.ts
 *
 * Centralized map configuration:
 * - Status colors and icons
 * - Map styles
 * - Visual constants
 */

export const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  'Contrôle conforme': { color: '#00FF9D', icon: 'check' },
  'Non conforme': { color: '#FF0055', icon: 'warning' },
  'Intérieur terminé': { color: '#6366F1', icon: 'interior' },
  'Réseau terminé': { color: '#00D2FF', icon: 'network' },
  'Murs terminés': { color: '#FFD60A', icon: 'walls' },
  'Livraison effectuée': { color: '#059669', icon: 'delivery' },
  'Non éligible': { color: '#64748B', icon: 'dot' },
  'Non encore installée': { color: '#6366F1', icon: 'dot' },
  'Désistement': { color: '#64748B', icon: 'warning' },
  'Refusé': { color: '#F43F5E', icon: 'warning' },
  'Eligible': { color: '#3B82F6', icon: 'dot' },
  'En attente': { color: '#64748B', icon: 'dot' },
  default: { color: '#6366F1', icon: 'dot' },
};


export const ICON_SIZES = {
  small: 22,
  large: 34,
};

export const getStatusColor = (status?: string): string => {
  if (!status) return STATUS_CONFIG.default.color;
  const match = Object.keys(STATUS_CONFIG).find((k) => status.includes(k));
  return match ? STATUS_CONFIG[match].color : STATUS_CONFIG.default.color;
};

const OSM_TILES = ['cached://https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

const createOsmRasterStyle = (
  overrides: Record<string, unknown> = {}
): StyleSpecification => ({
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: OSM_TILES,
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-fallback',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 20,
      paint: overrides as any,
    },
  ],
});

export const MAP_STYLE_LIGHT = createOsmRasterStyle();
export const MAP_STYLE_DARK = createOsmRasterStyle({
  'raster-brightness-max': 0.35,
  'raster-brightness-min': 0.05,
  'raster-contrast': 0.2,
  'raster-saturation': -1,
});
export const MAP_STYLE_FALLBACK_RASTER = createOsmRasterStyle();

export const MAP_STYLE_SATELLITE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'cached://https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// Backward compatibility & aliases
export const MAP_STYLE_LIGHT_VECTOR = MAP_STYLE_LIGHT;

export const getIconId = (status: string) => {
  const match = Object.keys(STATUS_CONFIG).find((k) => status.includes(k));
  return match ? match : 'default';
};
