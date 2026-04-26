/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * mapUtils.ts
 *
 * Utility functions for map operations:
 * - Icon loading (Néon-Glass Hyper-Real implementation)
 * - Data validation
 * - Coordinate helpers
 */

import maplibregl from 'maplibre-gl';
import {
  STATUS_CONFIG,
  STATUS_ICON_IDS,
  ICON_SIZES,
  getStatusKeyByIconId,
  resolveStatusConfigKey,
} from './mapConfig';
import logger from '../../utils/logger';

// ── SINGLETON ICON REGISTRY ──
const iconRegistry = new Map<string, boolean>();
const styleImageFallbackRegistry = new WeakSet<maplibregl.Map>();

/**
 * Draws a Squircle (Lamé Curve approximation) using Cubic Bezier curves
 * @param ctx The canvas context
 * @param size The size of the marker
 * @param radius The 'Squircle' radius (Golden Ratio: 12 on 40px)
 */
function drawSquircle(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const r = 12 * (size / 40); // Proportional radius
  const s = size;
  const p = 1.5; // Padding for the glow/border
  
  ctx.beginPath();
  // We use 4 cubic bezier segments to simulate the organic Lamé curve
  // Control point offset for Squircle look is roughly 0.6-0.7
  const k = 0.65; 
  
  ctx.moveTo(p + r, p);
  ctx.lineTo(s - p - r, p);
  ctx.bezierCurveTo(s - p - r + r * k, p, s - p, p + r - r * k, s - p, p + r);
  ctx.lineTo(s - p, s - p - r);
  ctx.bezierCurveTo(s - p, s - p - r + r * k, s - p - r + r * k, s - p, s - p - r, s - p);
  ctx.lineTo(p + r, s - p);
  ctx.bezierCurveTo(p + r - r * k, s - p, p, s - p - r + r * k, p, s - p - r);
  ctx.lineTo(p, p + r);
  ctx.bezierCurveTo(p, p + r - r * k, p + r - r * k, p, p + r, p);
  ctx.closePath();

  // 1. Shadow / Base Depth
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // 2. Glass Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#0f172a'); // Midnight tint for depth
  ctx.fillStyle = grad;
  ctx.fill();

  // 3. Inner Gloss / Frosted effect
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  // 4. Premium White Rim (Glass Edge)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. Surface Shine (Top-down reflection)
  const shine = ctx.createLinearGradient(0, 0, 0, s / 2);
  shine.addColorStop(0, 'rgba(255,255,255,0.25)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();
}

/**
 * Draws a VIP Diamond for specialized status
 */
function drawDiamond(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const center = size / 2;
  const s = size - 4;

  ctx.beginPath();
  ctx.moveTo(center, 2);
  ctx.lineTo(size - 2, center);
  ctx.lineTo(center, size - 2);
  ctx.lineTo(2, center);
  ctx.closePath();

  // Depth Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#701a75'); // Dark Purple/Red tint
  ctx.fillStyle = grad;
  ctx.fill();

  // Glass Rim
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Professional Pictogram Drawing (Bold Hybrid Logic)
 */
function drawPictogram(ctx: CanvasRenderingContext2D, size: number, type: string) {
  const center = size / 2;
  const iconSize = size / 1.8;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${iconSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 20% inner fill logic
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';

  const glyphs: Record<string, string> = {
    check: '✔',
    alert: '!',
    warning: '⚠',
    home: '🏠',
    plug: '🔌',
    brick: '🧱',
    truck: '🚚',
    noentry: '⛔',
    dot: '●',
    diamond: '💎',
    interior: '⚡',
    network: '📡',
    walls: '🏗',
    delivery: '📦',
    camera: '📷',
  };


  const char = glyphs[type] || glyphs.dot;
  
  // Draw with semi-transparent fill and bold stroke
  ctx.globalAlpha = 0.2;
  ctx.fillText(char, center, center);
  ctx.globalAlpha = 1.0;
  ctx.strokeText(char, center, center);
  ctx.fillText(char, center, center);
}

/**
 * Generate a sharp ImageBitmap for a given status and size
 */
async function generateIconBitmap(status: string, size: number): Promise<ImageBitmap> {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = size * scale;
  canvas.height = size * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;
  
  if (config.icon === 'warning' || config.icon === 'diamond') {
    drawDiamond(ctx, size, config.color);
  } else {
    drawSquircle(ctx, size, config.color);
  }
  
  drawPictogram(ctx, size, config.icon);

  return createImageBitmap(canvas);
}

async function generatePhotoIndicatorBitmap(): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📷', 16, 16);

  return createImageBitmap(canvas);
}

const resolveStatusFromImageId = (imageId: string): { iconId: string; variant: 'small' | 'large' | 'pulsing' | null } | null => {
  const pulsingMatch = imageId.match(/^pulsing-(.+)$/);
  if (pulsingMatch) {
    return {
      iconId: pulsingMatch[1],
      variant: 'pulsing',
    };
  }

  const staticMatch = imageId.match(/^icon-(.+)-(small|large)$/);
  if (staticMatch) {
    return {
      iconId: staticMatch[1],
      variant: staticMatch[2] as 'small' | 'large',
    };
  }

  return null;
};

const resolveStatusKeyFromImageSegment = (segment: string): string => {
  const fromIconId = getStatusKeyByIconId(segment);
  if (fromIconId && fromIconId !== 'default') return fromIconId;

  if (STATUS_CONFIG[segment]) return segment;

  const fromDerivedStatus = resolveStatusConfigKey(segment);
  if (fromDerivedStatus && fromDerivedStatus !== 'default') return fromDerivedStatus;

  const normalizedSegment = segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const normalizedStatus = Object.keys(STATUS_CONFIG).find((status) => {
    if (status === 'default') return false;
    return (
      status
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase() === normalizedSegment
    );
  });

  return normalizedStatus || 'default';
};

export async function ensureMapImage(map: maplibregl.Map, imageId: string): Promise<boolean> {
  if (!map || !map.isStyleLoaded() || map.hasImage(imageId)) return false;

  if (imageId === 'photo-indicator') {
    const bitmap = await generatePhotoIndicatorBitmap();
    if (!map.hasImage(imageId)) {
      map.addImage(imageId, bitmap, { pixelRatio: 2 });
    }
    return true;
  }

  const resolved = resolveStatusFromImageId(imageId);
  if (!resolved) return false;

  const status = resolveStatusKeyFromImageSegment(resolved.iconId);

  if (resolved.variant === 'pulsing') {
    if (!map.hasImage(imageId)) {
      map.addImage(imageId, new PulsingIcon(map, status));
    }
    return true;
  }

  const size = resolved.variant === 'large' ? ICON_SIZES.large : ICON_SIZES.small;
  const bitmap = await generateIconBitmap(status, size);
  if (!map.hasImage(imageId)) {
    map.addImage(imageId, bitmap, { pixelRatio: 2 });
  }
  return true;
}

function attachStyleImageFallback(map: maplibregl.Map) {
  if (styleImageFallbackRegistry.has(map)) return;

  const handleStyleImageMissing = async (event: { id: string }) => {
    try {
      await ensureMapImage(map, event.id);
    } catch (error) {
      logger.warn(`[MapUtils] Impossible de régénérer l'image ${event.id}`, error);
    }
  };

  map.on('styleimagemissing', handleStyleImageMissing as any);
  styleImageFallbackRegistry.add(map);
}

/**
 * Professional Pulsing Dot implementation using MapLibre StyleImageInterface
 * Upgraded with "Respiration" (Dual-Halo) and "Shimmer" (Diamond VIP)
 */
class PulsingIcon implements maplibregl.StyleImageInterface {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
  context: CanvasRenderingContext2D | null = null;
  map: maplibregl.Map;
  status: string;
  duration = 2000;

  constructor(map: maplibregl.Map, status: string, size: number = 44) {
    this.width = size * 2.5; // Large buffer for neon halo
    this.height = size * 2.5;
    this.data = new Uint8Array(this.width * this.height * 4);
    this.map = map;
    this.status = status;
  }

  onAdd() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    this.context = canvas.getContext('2d');
  }

  render() {
    if (!this.context) return false;
    const now = performance.now();
    const t = (now % this.duration) / this.duration;

    const center = this.width / 2;
    const bodySize = 34;
    const context = this.context;
    const config = STATUS_CONFIG[this.status] || STATUS_CONFIG.default;

    context.clearRect(0, 0, this.width, this.height);

    // ── 1. BREATHING NEON HALO (Respiration) ──
    const pulseScale = 1 + 0.4 * Math.sin(t * Math.PI);
    const pulseOpacity = 0.3 + 0.5 * Math.sin(t * Math.PI);

    context.save();
    context.translate(center, center);
    context.scale(pulseScale, pulseScale);
    context.beginPath();
    context.arc(0, 0, bodySize / 2, 0, Math.PI * 2);
    context.fillStyle = `${config.color}${Math.floor(pulseOpacity * 140).toString(16).padStart(2, '0')}`;
    context.shadowColor = config.color;
    context.shadowBlur = 15;
    context.fill();
    context.restore();

    // ── 2. DRAW MAIN BODY (Squircle or Diamond) ──
    context.save();
    context.translate(center - bodySize / 2, center - bodySize / 2);
    
    if (config.icon === 'warning' || config.icon === 'diamond') {
        // Auto-rotation for VIP Diamond
        context.translate(bodySize/2, bodySize/2);
        context.rotate((Math.sin(now / 1000) * 8 * Math.PI) / 180);
        context.translate(-bodySize/2, -bodySize/2);
        drawDiamond(context, bodySize, config.color);
        
        // ── SHIMMER (Brilliant reflection) ──
        const st = (now % 3000) / 3000;
        if (st < 0.3) {
            const shimT = st / 0.3;
            const shimGrad = context.createLinearGradient(0, 0, bodySize, bodySize);
            shimGrad.addColorStop(Math.max(0, shimT - 0.1), 'rgba(255,255,255,0)');
            shimGrad.addColorStop(shimT, 'rgba(255,255,255,0.8)');
            shimGrad.addColorStop(Math.min(1, shimT + 0.1), 'rgba(255,255,255,0)');
            context.fillStyle = shimGrad;
            context.fill();
        }
    } else {
        drawSquircle(context, bodySize, config.color);
    }
    
    drawPictogram(context, bodySize, config.icon);
    context.restore();

    // Update pixel data and trigger repaint
    this.data = context.getImageData(0, 0, this.width, this.height).data;
    this.map.triggerRepaint();

    return true;
  }
}

/**
 * Register all icons into a Map instance once per style load
 */
export async function registerIcons(map: maplibregl.Map) {
  if (!map || !map.isStyleLoaded()) return;
  attachStyleImageFallback(map);

  const iconIds = Array.from(new Set(Object.values(STATUS_ICON_IDS)));
  const legacyStatusKeys = Object.keys(STATUS_CONFIG).filter((status) => status !== 'default');

  for (const iconId of iconIds) {
    const smallId = `icon-${iconId}-small`;
    const largeId = `icon-${iconId}-large`;
    const pulsingId = `pulsing-${iconId}`;

    if (!map.hasImage(smallId)) {
      await ensureMapImage(map, smallId);
    }

    if (!map.hasImage(largeId)) {
      await ensureMapImage(map, largeId);
    }

    // Register breathing pulsing variant
    if (!map.hasImage(pulsingId)) {
      await ensureMapImage(map, pulsingId);
    }
  }

  for (const statusKey of legacyStatusKeys) {
    const legacySmallId = `icon-${statusKey}-small`;
    const legacyLargeId = `icon-${statusKey}-large`;
    const legacyPulsingId = `pulsing-${statusKey}`;

    if (!map.hasImage(legacySmallId)) {
      await ensureMapImage(map, legacySmallId);
    }

    if (!map.hasImage(legacyLargeId)) {
      await ensureMapImage(map, legacyLargeId);
    }

    if (!map.hasImage(legacyPulsingId)) {
      await ensureMapImage(map, legacyPulsingId);
    }
  }

  await ensureMapImage(map, 'photo-indicator');

  logger.debug('💎 [MapUtils] Néon-Glass icons registered (Squircles & VIP Diamond)');
}

/**
 * Hash function for deep GeoJSON comparison
 */
export const hashGeoJSON = (data: any): string => {
  if (!data) return '';
  try {
    const json = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
        const char = json.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
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
 * Apply jitter to duplicate coordinates
 */
export const applyJitter = (coordinates: [number, number], index: number): [number, number] => {
  if (index === 0) return coordinates;
  const JITTER_STEP = 0.00005;
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = JITTER_STEP * Math.sqrt(index);
  return [coordinates[0] + radius * Math.cos(angle), coordinates[1] + radius * Math.sin(angle)];
};

/**
 * Generate popup HTML
 */
export const generatePopupHTML = (feature: any): string => {
  const props = feature.properties;
  const config = STATUS_CONFIG[props.status] || STATUS_CONFIG.default;
  const color = config.color;
  const status = props.status || 'Inconnu';

  return `
    <div class="popup-card p-5 min-w-[240px] font-sans bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-xl">
        <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 py-1 px-2 rounded-full">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></span>
                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">${status}</span>
            </div>
            <span class="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">${props.owner && props.owner !== 'N/A' ? props.owner : 'Sans propriétaire'}</span>
        </div>
        <div class="space-y-1 mb-5">
            <h3 class="text-lg font-black tracking-tight leading-tight dark:text-white" style="color: #0f172a;">
                Ménage #${(props.household_id || props.id)?.slice(-6) || 'N/A'}
            </h3>
            <p class="text-xs font-bold dark:text-slate-400" style="color: #475569;">
                ID : <span class="font-mono dark:text-slate-200" style="color: #1e293b;">${props.household_id || props.id || 'N/A'}</span>
            </p>
        </div>

        <button 
            type="button"
            onclick="window.dispatchEvent(new CustomEvent('map:select-household', { detail: '${props.household_id || props.id}' }))"
            class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style="background: #0f172a; color: #ffffff; border: 1px solid rgba(255,255,255,0.1);"
        >
            Voir les détails
        </button>
    </div>
  `;
};
