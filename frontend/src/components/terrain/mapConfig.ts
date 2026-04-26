import type { StyleSpecification } from 'maplibre-gl';

/**
 * mapConfig.ts — GEM SAAS
 *
 * Styles cartographiques premium type "Yango / Uber Dark"
 * Utilise OpenFreeMap (gratuit, sans clé API) pour le style vectoriel.
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
  Désistement: { color: '#64748B', icon: 'warning' },
  Refusé: { color: '#F43F5E', icon: 'warning' },
  Eligible: { color: '#3B82F6', icon: 'dot' },
  'En attente': { color: '#64748B', icon: 'dot' },
  default: { color: '#6366F1', icon: 'dot' },
};

export const STATUS_ICON_IDS: Record<string, string> = {
  'Contrôle conforme': 'controle-conforme',
  'Non conforme': 'non-conforme',
  'Intérieur terminé': 'interieur-termine',
  'Réseau terminé': 'reseau-termine',
  'Murs terminés': 'murs-termines',
  'Livraison effectuée': 'livraison-effectuee',
  'Non éligible': 'non-eligible',
  'Non encore installée': 'non-encore-installee',
  Désistement: 'desistement',
  Refusé: 'refuse',
  Eligible: 'eligible',
  'En attente': 'en-attente',
  default: 'default',
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

export const resolveStatusConfigKey = (status?: string): string => {
  if (!status) return 'default';
  const match = Object.keys(STATUS_CONFIG).find((k) => status.includes(k));
  return match || 'default';
};

// ── OpenFreeMap vector tile styles (gratuit, no API key) ──
// Style "Libery" = moderne, vectoriel, proche Yango/Uber Dark
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron';
export const OPENFREEMAP_BRIGHT = 'https://tiles.openfreemap.org/styles/bright';

const MAPLIBRE_GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

// ── CARTO Dark Matter (Yango-like) via raster tiles ──
// Disponible sans clé API, qualité premium
const createCartoStyle = (
  variant: 'dark_all' | 'light_all' | 'rastertiles/voyager',
  bgColor: string
): StyleSpecification => ({
  version: 8,
  glyphs: MAPLIBRE_GLYPHS,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
        `https://b.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
        `https://c.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; OpenStreetMap contributors',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': bgColor },
    },
    {
      id: 'carto-tiles',
      type: 'raster',
      source: 'carto',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 200,
      } as any,
    },
  ],
});

// ── OSM raster de secours uniquement ──
const OSM_TILES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

const createOsmRasterStyle = (
  rasterPaint: Record<string, unknown> = {},
  backgroundColor = '#f4f7fb'
): StyleSpecification => ({
  version: 8,
  glyphs: MAPLIBRE_GLYPHS,
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
      id: 'osm-background',
      type: 'background',
      paint: { 'background-color': backgroundColor },
    },
    {
      id: 'osm-fallback',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 20,
      paint: { 'raster-opacity': 0.96, ...rasterPaint } as any,
    },
  ],
});

// ── Styles principaux exportés ──

/**
 * Style sombre "Yango / Uber" — CARTO Dark Matter
 * Fond très sombre (#121212), routes blanches, labels minimalistes
 */
export const MAP_STYLE_DARK: StyleSpecification = createCartoStyle('dark_all', '#121212');

/**
 * Style clair premium — CARTO Voyager (proche Google Maps)
 */
export const MAP_STYLE_LIGHT: StyleSpecification = createCartoStyle('rastertiles/voyager', '#f4f7fb');

/**
 * Style de secours OSM si CARTO indisponible
 */
export const MAP_STYLE_FALLBACK_RASTER = createOsmRasterStyle(
  {
    'raster-brightness-max': 0.98,
    'raster-brightness-min': 0.74,
    'raster-contrast': 0.08,
    'raster-saturation': -0.12,
  },
  '#eef4fb'
);

/**
 * Satellite — Esri World Imagery
 */
export const MAP_STYLE_SATELLITE: StyleSpecification = {
  version: 8,
  glyphs: MAPLIBRE_GLYPHS,
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

// Alias backward compatibility
export const MAP_STYLE_LIGHT_VECTOR = MAP_STYLE_LIGHT;

export const getIconId = (status: string) => {
  const key = resolveStatusConfigKey(status);
  return STATUS_ICON_IDS[key] || STATUS_ICON_IDS.default;
};

export const getStatusKeyByIconId = (iconId: string) => {
  const match = Object.entries(STATUS_ICON_IDS).find(([, value]) => value === iconId);
  return match?.[0] || 'default';
};
