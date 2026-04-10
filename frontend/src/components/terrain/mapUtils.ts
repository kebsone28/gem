/**
 * mapUtils.ts
 *
 * Utility functions for map operations:
 * - Icon loading
 * - Data validation
 * - Coordinate helpers
 */

import maplibregl from 'maplibre-gl';
import {
  STATUS_COLOR,
  getStatusColor,
  getIconForStatus,
  ICON_SVGS,
  createIconDataURI,
} from './mapConfig';

export const loadMapImages = async (map: maplibregl.Map) => {
  // Guard: ensure map and style are ready
  if (!map || !map.isStyleLoaded?.()) {
    console.warn('❌ Map or style not ready for image loading');
    return;
  }

  const statuses = Object.keys(STATUS_COLOR);
  statuses.push('default');

  await Promise.all(
    statuses.map((status) => {
      return new Promise((resolve) => {
        const color = getStatusColor(status);
        const iconType = getIconForStatus(status);
        const svgContent = ICON_SVGS[iconType as keyof typeof ICON_SVGS] || ICON_SVGS['dot'];
        const dataUri = createIconDataURI(svgContent, color);

        const img = new Image();
        img.onload = () => {
          // ✅ Double-check map still exists and has required methods
          if (map && map.hasImage && map.addImage) {
            if (!map.hasImage(`icon-${status}`)) {
              map.addImage(`icon-${status}`, img);
            }
          }
          resolve(null);
        };
        img.onerror = () => {
          console.warn(`⚠️ Failed to load image for status: ${status}`);
          resolve(null);
        };
        img.src = dataUri;
      });
    })
  );
};

/**
 * Hash function for deep GeoJSON comparison
 * Used for memoization to detect changes
 */
export const hashGeoJSON = (data: any): string => {
  if (!data) return '';
  try {
    const json = JSON.stringify(data);
    // Simple hash for quick comparison
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  } catch {
    return '';
  }
};

/**
 * Validate household location coordinates
 */
export const isValidCoordinate = (coords: any): coords is [number, number] => {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords[0] != null &&
    coords[1] != null &&
    !isNaN(Number(coords[0])) &&
    !isNaN(Number(coords[1]))
  );
};

/**
 * Apply jitter to duplicate coordinates using golden angle spiral
 */
export const applyJitter = (coordinates: [number, number], index: number): [number, number] => {
  if (index === 0) return coordinates;

  const JITTER_STEP = 0.00005; // ~5m per step
  const angle = (index * 137.5 * Math.PI) / 180; // golden angle
  const radius = JITTER_STEP * Math.sqrt(index);

  return [coordinates[0] + radius * Math.cos(angle), coordinates[1] + radius * Math.sin(angle)];
};
/**
 * Generate lightweight HTML for the shared native popup
 */
export const generatePopupHTML = (feature: any): string => {
  const props = feature.properties;
  const color = props.color || '#3b82f6';
  const status = props.status || 'Inconnu';

  return `
        <div class="popup-card p-4 min-w-[220px] font-sans bg-white/95 dark:bg-slate-950/95 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xl">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${color}"></span>
                    <span class="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">${status}</span>
                </div>
                <span class="text-[10px] uppercase font-black text-slate-400">${props.owner ? props.owner : 'Sans propriétaire'}</span>
            </div>
            <div class="space-y-2">
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Ménage #${(props.household_id || props.id)?.slice(-6) || 'N/A'}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                    ID : <span class="font-mono text-[11px] text-slate-700 dark:text-slate-300">${props.household_id || props.id || 'N/A'}</span>
                </p>
                ${props.owner ? `<p class="text-xs text-slate-500 dark:text-slate-400">Propriétaire : <span class="font-semibold text-slate-900 dark:text-white">${props.owner}</span></p>` : ''}
            </div>
            <button 
                type="button"
                onclick="window.dispatchEvent(new CustomEvent('map:select-household', { detail: '${props.household_id || props.id}' }))"
                class="mt-4 w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
                style="background: #0f172a; color: #ffffff; border: 1px solid rgba(255,255,255,0.12);"
            >
                Voir les détails
            </button>
        </div>
    `;
};
