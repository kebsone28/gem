/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
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

export const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
export const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
export const MAP_STYLE_SATELLITE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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
