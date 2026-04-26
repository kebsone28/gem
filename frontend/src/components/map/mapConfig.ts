import type { StyleSpecification } from 'maplibre-gl';

export const PMTILES_SOURCE_ID = 'pmtiles-source';

// Read env in a Vite-friendly way but safe for other runtimes
const VITE_ENV: any =
  (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) ??
  (typeof process !== 'undefined' ? process.env : {});
const IS_DEV = !!VITE_ENV?.DEV || VITE_ENV?.MODE === 'development';
const PMTILES_URL = VITE_ENV?.VITE_PMTILES_URL || (IS_DEV ? 'http://localhost:4000/tiles/{z}/{x}/{y}.pbf' : '/tiles/{z}/{x}/{y}.pbf');
const RASTER_FALLBACK = VITE_ENV?.VITE_RASTER_FALLBACK || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function baseSources(){
  return {
    // main vector source (PMTiles in dev/prod configurable)
    [PMTILES_SOURCE_ID]: {
      type: 'vector',
      tiles: [PMTILES_URL]
    },
    // raster fallback to ensure map shows something if vector tiles are unavailable
    raster_fallback: {
      type: 'raster',
      tiles: [RASTER_FALLBACK],
      tileSize: 256
    }
  } as Record<string, any>
}

function backgroundColorFor(mode: string){
  if (mode === 'dark') return '#041025'
  if (mode === 'light') return '#f7fbff'
  return '#e6eef8'
}

function commonStyle(mode: string): StyleSpecification{
  return {
    version: 8 as const,
    name: 'GEM Premium Vector Style',
    sources: baseSources() as any,
    layers: [
      // raster fallback at the bottom
      { id: 'raster_fallback', type: 'raster', source: 'raster_fallback', minzoom: 0, maxzoom: 22 },
      // background
      { id: 'background', type: 'background', paint: { 'background-color': backgroundColorFor(mode) } }
    ] as any[]
  }
}

// Premium style snippets for dark/light with tasteful palettes
function vectorLayersForMode(mode: string){
  const isDark = mode === 'dark'
  return [
    // landuse
    {
      id: 'landuse-fill',
      type: 'fill',
      source: PMTILES_SOURCE_ID,
      'source-layer': 'landuse',
      paint: { 'fill-color': isDark ? '#0b1b2b' : '#e9f1fb', 'fill-opacity': 0.9 }
    },
    // roads
    {
      id: 'road-primary',
      type: 'line',
      source: PMTILES_SOURCE_ID,
      'source-layer': 'roads',
      paint: { 'line-color': isDark ? '#2a9df4' : '#3b82f6', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 3] }
    },
    // buildings (3D extrusion)
    {
      id: 'buildings-extrude',
      type: 'fill-extrusion',
      source: PMTILES_SOURCE_ID,
      'source-layer': 'buildings',
      paint: {
        'fill-extrusion-color': isDark ? '#0f1724' : '#ffffff',
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
        'fill-extrusion-opacity': 0.9
      }
    }
  ] as any[]
}

export function getStyleForMode(mode: string): StyleSpecification{
  // fallback to light if unknown
  if (!mode) mode = IS_DEV ? 'dark' : 'light'

  if (mode === 'satellite'){
    const s = commonStyle(mode)
    // override sources: satellite raster placeholder
    s.sources = {
      raster_sat: { type: 'raster', tiles: [ VITE_ENV?.VITE_SATELLITE_URL || 'https://satellite-tiles.local/{z}/{x}/{y}.jpg' ], tileSize: 256 },
      ...baseSources()
    }
    s.layers = [ { id: 'sat', type: 'raster', source: 'raster_sat' }, ...s.layers ]
    return s
  }

  if (mode === 'hybrid'){
    const s = commonStyle(mode)
    // hybrid: raster satellite + vector overlays
    s.sources = { ...s.sources }
    s.layers = [
      { id: 'raster_sat', type: 'raster', source: 'raster_fallback' },
      ...vectorLayersForMode(mode),
      ...s.layers
    ]
    return s
  }

  // dark / light
  const style = commonStyle(mode)
  style.layers = [
    ...vectorLayersForMode(mode),
    // keep raster fallback bottom-most
    ...style.layers
  ]
  return style
}

