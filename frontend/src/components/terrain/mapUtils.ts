/**
 * mapUtils.ts
 * 
 * Utility functions for map operations:
 * - Icon loading
 * - Data validation
 * - Coordinate helpers
 */

import maplibregl from 'maplibre-gl';
import { STATUS_COLOR, getStatusColor, getIconForStatus, ICON_SVGS, createIconDataURI } from './mapConfig';

export const loadMapImages = async (map: maplibregl.Map) => {
    // Guard: ensure map and style are ready
    if (!map || !map.isStyleLoaded?.()) {
        console.warn('❌ Map or style not ready for image loading');
        return;
    }

    const statuses = Object.keys(STATUS_COLOR);
    statuses.push('default');

    await Promise.all(statuses.map(status => {
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
    }));
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
            hash = ((hash << 5) - hash) + char;
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
    return Array.isArray(coords) &&
        coords.length === 2 &&
        coords[0] != null &&
        coords[1] != null &&
        !isNaN(Number(coords[0])) &&
        !isNaN(Number(coords[1]));
};

/**
 * Apply jitter to duplicate coordinates using golden angle spiral
 */
export const applyJitter = (coordinates: [number, number], index: number): [number, number] => {
    if (index === 0) return coordinates;
    
    const JITTER_STEP = 0.00005; // ~5m per step
    const angle = (index * 137.5 * Math.PI) / 180; // golden angle
    const radius = JITTER_STEP * Math.sqrt(index);
    
    return [
        coordinates[0] + radius * Math.cos(angle),
        coordinates[1] + radius * Math.sin(angle)
    ];
};
/**
 * Generate lightweight HTML for the shared native popup
 */
export const generatePopupHTML = (feature: any): string => {
    const props = feature.properties;
    const color = props.color || '#3b82f6';
    const status = props.status || 'Inconnu';
    
    return `
        <div class="p-3 min-w-[200px] font-sans">
            <div class="flex items-center gap-2 mb-2">
                <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">${status}</span>
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Ménage #${(props.household_id || props.id)?.slice(-6) || 'N/A'}
            </h3>
            <p class="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                ID: <span class="font-mono">${props.household_id || props.id || 'N/A'}</span>
            </p>
            <button 
                onclick="window.dispatchEvent(new CustomEvent('map:select-household', { detail: '${props.household_id || props.id}' }))"
                class="w-full py-2 px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[11px] font-bold transition-transform active:scale-95 shadow-lg"
            >
                Voir les détails
            </button>
        </div>
    `;
};
