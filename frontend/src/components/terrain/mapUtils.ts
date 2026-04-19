/**
 * mapUtils.ts
 *
 * Utility functions for map operations:
 * - Icon loading (Néon-Glass Hyper-Real implementation)
 * - Data validation
 * - Coordinate helpers
 */

import maplibregl from 'maplibre-gl';
import { STATUS_CONFIG, ICON_SIZES } from './mapConfig';

// ── SINGLETON ICON REGISTRY ──
const iconRegistry = new Map<string, boolean>();

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

  const statuses = Object.keys(STATUS_CONFIG);

  for (const status of statuses) {
    const smallId = `icon-${status}-small`;
    const largeId = `icon-${status}-large`;
    const pulsingId = `pulsing-${status}`;

    if (!map.hasImage(smallId)) {
      const smallBitmap = await generateIconBitmap(status, ICON_SIZES.small);
      map.addImage(smallId, smallBitmap, { pixelRatio: 2 });
    }

    if (!map.hasImage(largeId)) {
      const largeBitmap = await generateIconBitmap(status, ICON_SIZES.large);
      map.addImage(largeId, largeBitmap, { pixelRatio: 2 });
    }

    // Register breathing pulsing variant
    if (!map.hasImage(pulsingId)) {
      map.addImage(pulsingId, new PulsingIcon(map, status));
    }
  }

  // Register the dedicated photo indicator icon
  if (!map.hasImage('photo-indicator')) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    
    // Draw a small white circle with a blue camera icon
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
    
    const bitmap = await createImageBitmap(canvas);
    map.addImage('photo-indicator', bitmap, { pixelRatio: 2 });
  }

  console.log('💎 [MapUtils] Néon-Glass icons registered (Squircles & VIP Diamond)');
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
