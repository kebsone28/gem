/**
 * mapConfig.ts
 *
 * Centralized map configuration:
 * - Status colors and icons
 * - Map styles
 * - Visual constants
 */

export const STATUS_COLOR: Record<string, string> = {
  'Contrôle conforme': '#10b981',    // Émeraude Vibrant
  'Non conforme': '#f43f5e',         // Rose Alerte
  'Intérieur terminé': '#6366f1',    // Indigo Électrique
  'Réseau terminé': '#3b82f6',       // Bleu Brillant
  'Murs terminés': '#f59e0b',        // Ambre Doré
  'Livraison effectuée': '#06b6d4',  // Cyan Océan
  'Non encore commencé': '#64748b',   // Ardoise Neutre
  'Non éligible': '#f43f5e',         // Même que non conforme (Rose)
  'Désistement': '#64748b',          // Neutre (Gris)
};

export const getStatusColor = (status?: string): string => {
  if (!status) return '#94a3b8';
  const match = Object.entries(STATUS_COLOR).find(
    ([k]) => status.includes(k) || k.includes(status)
  );
  return match ? match[1] : '#94a3b8';
};

const rasterOsmStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['cached://https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
    },
  },
  layers: [
    {
      id: 'osm-theme',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// const defaultStyle = rasterOsmStyle as any; // Force raster bypass for now

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
export const MAP_STYLE_LIGHT_RASTER = rasterOsmStyle;

export const ICON_SVGS = {
  check: `<path fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/>`,
  truck: `<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 17h4V5H2v12h3M20 17h2v-9h-4m-2 2h4M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>`,
  wrench: `<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  alert: `<path fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
  pin: `<g>
      <defs>
        <radialGradient id="pinGradient" cx="35%" cy="35%">
          <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#cc0000;stop-opacity:1" />
        </radialGradient>
        <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path fill="url(#pinGradient)" filter="url(#pinShadow)" d="M12,2 C6.5,2 2,6.5 2,12 C2,18 12,24 12,24 C12,24 22,18 22,12 C22,6.5 17.5,2 12,2 M12,15 C10.3,15 9,13.7 9,12 C9,10.3 10.3,9 12,9 C13.7,9 15,10.3 15,12 C15,13.7 13.7,15 12,15"/>
      <circle cx="12" cy="10" r="4.5" fill="white" opacity="0.95" filter="url(#pinShadow)"/>
      <circle cx="11" cy="9" r="1.5" fill="white" opacity="0.4"/>
    </g>`,
  dot: `<circle cx="12" cy="12" r="5" fill="white"/>`,
};

export const getIconForStatus = (status: string) => {
  if (status.includes('Contrôle conforme')) return 'check';
  if (
    status.includes('Non conforme') ||
    status.includes('Problème') ||
    status.includes('Non éligible') ||
    status.includes('Désistement')
  )
    return 'alert';
  if (status.includes('Livraison effectuée')) return 'truck';
  if (
    status.includes('Murs terminés') ||
    status.includes('Réseau terminé') ||
    status.includes('Intérieur terminé')
  )
    return 'wrench';
  if (status.includes('Non encore commencé') || status.includes('Non débuté')) return 'pin';
  return 'dot';
};

export const createIconDataURI = (svgContent: string, color: string) => {
  // Glow intensity and darker border
  const strokeColor = 'rgba(255,255,255,0.9)'; // White border for contrast
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="bubble" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:white;stop-opacity:0.4" />
            <stop offset="40%" style="stop-color:white;stop-opacity:0" />
            <stop offset="100%" style="stop-color:black;stop-opacity:0.2" />
          </linearGradient>
        </defs>
        <!-- External GLOW for status identification -->
        <circle cx="12" cy="12" r="10.5" fill="${color}" opacity="0.4" filter="url(#glow)"/>
        
        <!-- MAIN CIRCLE -->
        <circle cx="12" cy="12" r="9.5" fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
        
        <!-- GLASS SHINE -->
        <circle cx="12" cy="12" r="9.5" fill="url(#bubble)"/>
        
        <g transform="translate(4,4) scale(0.66)">
            ${svgContent}
        </g>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const getIconId = (status: string) => {
  const match = Object.keys(STATUS_COLOR).find((k) => status.includes(k));
  return match ? `icon-${match}` : 'icon-default';
};
