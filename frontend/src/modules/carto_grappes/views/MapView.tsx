/**
 * MapView.tsx
 *
 * SVG bubble map for the PROQUELEC electrification project.
 * Shows regions (Kaffrine, Tambacounda) as collapsible rubriques, each with
 * an SVG bubble map where villages are colored by grappe.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type {
  Village,
  Menage,
  MenageEntry,
  GrappeSummary,
  EntrepreneurConfig,
  Prestataire,
  LotKey,
} from '../types';
import { GRAPPE_COLORS, VIEW_W, VIEW_H, REGIONS, GRAPPE_COUNT } from '../constants';
import GrappeAssignmentPanel from './GrappeAssignmentPanel';

/* ─── Props ───────────────────────────────────────────────────────────────── */

interface MapViewProps {
  villages: Village[];
  selectedRegion: string;
  selectedGrappe: string | null;
  regionGrappes: GrappeSummary[];
  onSelectGrappe: (key: string | null) => void;
  menages: Menage[];
  getEntry: (ordre: number) => MenageEntry;
  entrepreneurConfig: EntrepreneurConfig;
  onUpdateConfig: (config: EntrepreneurConfig) => void;
  onSyncToAPI?: () => Promise<void>;
  prestataires?: Prestataire[];
}

interface TooltipData {
  village: string;
  region: string;
  grappeKey: string;
  grappeNum: number;
  n: number;
  hasBlocked: boolean;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const REGION_ICONS: Record<string, string> = {
  Kaffrine: '\u{2600}\u{FE0F}', // ☀️
  Tambacounda: '\u{1F33E}', // 🌾
};

/**
 * Project a list of villages' lat/lon to SVG x,y coordinates.
 *
 * Uses a simple equirectangular projection with:
 *   - Bounding-box of all villages in the region, padded 10 %
 *   - cosine correction for longitude at ~13.5\u{00B0}N latitude
 *   - latitude mapped to y (inverted: north at top)
 *
 * Mutates the village objects in-place (x, y) and returns them.
 */
function projectVillagesToXY(villages: Village[]): Village[] {
  if (villages.length === 0) return villages;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;

  for (const v of villages) {
    if (v.lat < minLat) minLat = v.lat;
    if (v.lat > maxLat) maxLat = v.lat;
    if (v.lon < minLon) minLon = v.lon;
    if (v.lon > maxLon) maxLon = v.lon;
  }

  // Add 10 % padding
  const latPad = (maxLat - minLat) * 0.1 || 0.005;
  const lonPad = (maxLon - minLon) * 0.1 || 0.005;
  minLat -= latPad;
  maxLat += latPad;
  minLon -= lonPad;
  maxLon += lonPad;

  // Cosine correction for Mercator-like distortion at ~13.5\u{00B0}N
  const cosLat = Math.cos((13.5 * Math.PI) / 180);

  for (const v of villages) {
    v.x = (((v.lon - minLon) * cosLat) / ((maxLon - minLon) * cosLat || 1)) * VIEW_W;
    v.y = ((maxLat - v.lat) / (maxLat - minLat || 1)) * VIEW_H;
  }

  return villages;
}

/**
 * Assign bubble radii based on sqrt(n), scaled relative to the largest village.
 */
function assignRadii(villages: Village[]): void {
  const maxN = Math.max(...villages.map((v) => v.n), 1);
  const MAX_R = 24;
  const MIN_R = 5;
  for (const v of villages) {
    v.r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(v.n / maxN);
  }
}

/** Check if a ménage entry has any blocked status across lots A/B/C. */
function isMenageBlocked(entry: MenageEntry): boolean {
  const lots: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  return lots.some((l) => entry[l].status.startsWith('bloque_'));
}

/** Look up the entrepreneur name for a grappe in Lot B. */
function getEntrepreneurName(config: EntrepreneurConfig, grappeKey: string): string {
  const lotB = config['B'];
  if (!lotB) return '';
  const entry = lotB[grappeKey];
  if (!entry) return '';
  if ('entreprise' in entry && typeof entry.entreprise === 'string') {
    return entry.entreprise;
  }
  return '';
}

/* ─── Scoped SVG CSS (embedded as a <style> tag) ─────────────────────────── */

const SVG_STYLES = `
  .vpoint {
    stroke: rgba(255,255,255,.7);
    stroke-width: 1.5;
    opacity: .9;
    cursor: pointer;
    transition: opacity .2s, r .2s;
  }
  .vpoint:hover {
    stroke: #FFD700;
    stroke-width: 2.5;
    filter: drop-shadow(0 0 6px rgba(255,215,0,.45));
  }
  .vpoint.has-alert {
    stroke: #FF6B6B;
    stroke-width: 3;
    animation: alertPulse 1.6s ease-in-out infinite;
  }
  @keyframes alertPulse {
    0%,100% { stroke-opacity: 1; filter: drop-shadow(0 0 4px rgba(255,80,80,.4)); }
    50%     { stroke-opacity: .3; filter: none; }
  }
  .vlabel {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 8px;
    fill: rgba(255,255,255,.6);
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
  }
`;

/* ─── RegionRubrique (memoized sub-component) ────────────────────────────── */

interface RegionRubriqueProps {
  region: string;
  villages: Village[];
  menages: Menage[];
  getEntry: (ordre: number) => MenageEntry;
  selectedGrappe: string | null;
  onSelectGrappe: (key: string | null) => void;
  regionGrappes: GrappeSummary[];
  entrepreneurConfig: EntrepreneurConfig;
}

const RegionRubrique = React.memo<RegionRubriqueProps>(
  ({
    region,
    villages,
    menages,
    getEntry,
    selectedGrappe,
    onSelectGrappe,
    regionGrappes,
    entrepreneurConfig,
  }) => {
    const [collapsed, setCollapsed] = useState(false);

    // ── Filter + project villages for this region ──
    const regionVillages = useMemo(() => {
      const filtered = villages.filter((v) => v.region === region);
      projectVillagesToXY(filtered);
      assignRadii(filtered);
      return filtered;
    }, [villages, region]);

    // ── Menage count & blocked status per village ──
    const villageMenageData = useMemo(() => {
      const map: Record<string, { count: number; hasBlocked: boolean }> = {};
      for (const m of menages) {
        if (m.region !== region) continue;
        if (!map[m.village]) map[m.village] = { count: 0, hasBlocked: false };
        map[m.village].count++;
        if (!map[m.village].hasBlocked) {
          map[m.village].hasBlocked = isMenageBlocked(getEntry(m.ordre));
        }
      }
      return map;
    }, [menages, region, getEntry]);

    // ── Max menage count for radius normalisation (fallback from village data) ──
    const maxN = useMemo(() => {
      let mx = 0;
      for (const v of regionVillages) {
        const d = villageMenageData[v.village];
        if (d && d.count > mx) mx = d.count;
      }
      return mx || 1;
    }, [regionVillages, villageMenageData]);

    // ── Grappe number per village ──
    const villageGrappeMap = useMemo(() => {
      const map: Record<string, number> = {};
      for (const m of menages) {
        if (m.region !== region) continue;
        if (map[m.village] === undefined && m.grappe) {
          map[m.village] = m.grappe;
        }
      }
      for (const v of regionVillages) {
        if (map[v.village] === undefined) map[v.village] = v.defaultGrappe;
      }
      return map;
    }, [menages, region, regionVillages]);

    // ── Stats ──
    const totalGrappes = GRAPPE_COUNT[region] || 3;
    const villageCount = regionVillages.length;
    const totalMenages = useMemo(
      () => regionVillages.reduce((s, v) => s + (villageMenageData[v.village]?.count || v.n), 0),
      [regionVillages, villageMenageData]
    );

    // ── Legend items ──
    const legendItems = useMemo(() => {
      const seen = new Map<number, { key: string; color: string; entrepreneur: string }>();
      for (const v of regionVillages) {
        const gNum = villageGrappeMap[v.village] || v.defaultGrappe;
        if (!seen.has(gNum)) {
          const gKey = `${region}_${gNum}`;
          seen.set(gNum, {
            key: gKey,
            color: GRAPPE_COLORS[gKey] || '#6b7280',
            entrepreneur: getEntrepreneurName(entrepreneurConfig, gKey),
          });
        }
      }
      return Array.from(seen.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, item]) => item);
    }, [regionVillages, villageGrappeMap, region, entrepreneurConfig]);

    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50">
        {/* ── Header ── */}
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#1E3A5F] via-[#2E5A8A] to-[#3A6FA0] text-white cursor-pointer select-none"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{REGION_ICONS[region] || '\u{1F4CD}'}</span>
            <h2 className="text-[17px] font-extrabold m-0">{region}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Stat badges */}
            <StatBadge value={totalGrappes} label="Grappes" />
            <StatBadge value={villageCount} label="Villages" />
            <StatBadge value={totalMenages} label={'M\u{00E9}nages'} />

            {/* Chevron */}
            <span
              className="text-lg ml-2 transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            >
              {'\u{25BC}'}
            </span>
          </div>
        </button>

        {/* ── Collapsible body ── */}
        {!collapsed && (
          <>
            <div className="flex flex-col items-center px-5 py-4 gap-3">
              <RegionSVG
                region={region}
                villages={regionVillages}
                villageMenageData={villageMenageData}
                villageGrappeMap={villageGrappeMap}
                maxN={maxN}
                selectedGrappe={selectedGrappe}
                onSelectGrappe={onSelectGrappe}
              />
            </div>

            {/* ── Legend ── */}
            {legendItems.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
                {legendItems.map((item) => {
                  const active = selectedGrappe === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-150 cursor-pointer border ${
                        active
                          ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                          : 'bg-transparent border-transparent hover:bg-slate-100'
                      }`}
                      onClick={() => onSelectGrappe(active ? null : item.key)}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-700">
                        Grappe {item.key.split('_')[1]}
                      </span>
                      {item.entrepreneur && (
                        <span className="text-slate-400">&mdash; {item.entrepreneur}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
RegionRubrique.displayName = 'RegionRubrique';

/* ─── StatBadge (small header stat) ──────────────────────────────────────── */

const StatBadge: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-center min-w-[72px]">
    <div className="text-xl font-extrabold leading-tight">{value}</div>
    <div className="text-[10px] uppercase tracking-wider opacity-85">{label}</div>
  </div>
);

/* ─── RegionSVG (memoized SVG per region) ────────────────────────────────── */

interface RegionSVGProps {
  region: string;
  villages: Village[];
  villageMenageData: Record<string, { count: number; hasBlocked: boolean }>;
  villageGrappeMap: Record<string, number>;
  maxN: number;
  selectedGrappe: string | null;
  onSelectGrappe: (key: string | null) => void;
}

const RegionSVG = React.memo<RegionSVGProps>(
  ({
    region,
    villages,
    villageMenageData,
    villageGrappeMap,
    maxN,
    selectedGrappe,
    onSelectGrappe,
  }) => {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

    const onMouseEnter = useCallback((data: TooltipData, e: React.MouseEvent) => {
      setTooltip(data);
      setTipPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
      setTipPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }, []);

    const onMouseLeave = useCallback(() => setTooltip(null), []);

    return (
      <>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto max-h-[600px] rounded-lg border border-slate-200"
          style={{ background: 'linear-gradient(180deg, #1a2f4a 0%, #162840 100%)' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Subtle radial glow behind each bubble */}
            <radialGradient id={`glow-${region}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <style>{SVG_STYLES}</style>

          {villages.map((v, i) => {
            const data = villageMenageData[v.village] || { count: v.n, hasBlocked: false };
            const gNum = villageGrappeMap[v.village] || v.defaultGrappe;
            const gKey = `${region}_${gNum}`;
            const color = GRAPPE_COLORS[gKey] || '#6b7280';
            const r = v.r || 5 + 21 * Math.sqrt(data.count / (maxN || 1));
            const isActive = selectedGrappe === gKey;
            const isDimmed = selectedGrappe !== null && !isActive;

            return (
              <g
                key={`${region}-${v.village}-${i}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectGrappe(isActive ? null : gKey)}
                onMouseEnter={(e) =>
                  onMouseEnter(
                    {
                      village: v.village,
                      region: v.region,
                      grappeKey: gKey,
                      grappeNum: gNum,
                      n: data.count,
                      hasBlocked: data.hasBlocked,
                    },
                    e
                  )
                }
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
              >
                {/* Glow halo */}
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={r * 2.2}
                  fill={`url(#glow-${region})`}
                  opacity={isDimmed ? 0.05 : 0.5}
                />
                {/* Main bubble */}
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={r}
                  fill={color}
                  opacity={isDimmed ? 0.08 : 0.88}
                  className={`vpoint${data.hasBlocked ? ' has-alert' : ''}`}
                />
                {/* Village name label (only when not too dimmed) */}
                {!isDimmed && r >= 8 && (
                  <text x={v.x} y={v.y + r + 11} className="vlabel">
                    {v.village}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Floating Tooltip ── */}
        {tooltip && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: tipPos.x, top: tipPos.y }}
          >
            <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl shadow-xl p-3 min-w-[200px] max-w-[280px]">
              {/* Village name */}
              <div className="font-bold text-sm text-[#1E3A5F] mb-0.5">{tooltip.village}</div>
              {/* Region & Grappe */}
              <div className="text-[11px] text-slate-400 mb-2">
                {tooltip.region} {'\u{2014}'} Grappe {tooltip.grappeNum}
              </div>
              {/* Color dot + menage count */}
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: GRAPPE_COLORS[tooltip.grappeKey] || '#6b7280' }}
                />
                <span className="text-xs text-slate-600">
                  {tooltip.n} m{'\u{00E9}'}nage{tooltip.n > 1 ? 's' : ''}
                </span>
              </div>
              {/* Blocked warning */}
              {tooltip.hasBlocked && (
                <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                  {'\u{26A0}\u{FE0F}'} M{'\u{00E9}'}nage(s) bloqu{'\u{00E9}'}(s)
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
);
RegionSVG.displayName = 'RegionSVG';

/* ─── Main MapView Component ─────────────────────────────────────────────── */

const MapView: React.FC<MapViewProps> = React.memo(
  ({
    villages,
    selectedRegion,
    selectedGrappe,
    regionGrappes,
    onSelectGrappe,
    menages,
    getEntry,
    entrepreneurConfig,
    onUpdateConfig,
    onSyncToAPI,
    prestataires,
  }) => {
    const [assignPanelOpen, setAssignPanelOpen] = useState(false);

    // Determine which regions to display
    const visibleRegions = useMemo(() => {
      if (selectedRegion === '__ALL__') return REGIONS;
      return REGIONS.filter((r) => r === selectedRegion);
    }, [selectedRegion]);

    return (
      <div className="flex flex-col h-full overflow-auto p-4 gap-1.5">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-1 pb-2.5 border-b border-slate-200 mb-2">
          <h2 className="text-lg font-extrabold text-[#1E3A5F] m-0">
            {'\u{1F5FA}\u{FE0F}'} Cartographie des grappes
          </h2>

          <div className="flex gap-2 items-center">
            {selectedGrappe && (
              <button
                type="button"
                className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer shadow-md shadow-red-200 hover:shadow-lg transition-shadow"
                onClick={() => onSelectGrappe(null)}
              >
                {'\u{2715}'} R{'\u{00E9}'}initialiser
              </button>
            )}
            <button
              type="button"
              className={`text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer shadow-md transition-shadow ${
                assignPanelOpen
                  ? 'bg-gradient-to-r from-gray-500 to-gray-600 shadow-gray-200'
                  : 'bg-gradient-to-r from-[#1E3A5F] via-[#2E5A8A] to-[#3A6FA0] shadow-blue-200'
              }`}
              onClick={() => setAssignPanelOpen((o) => !o)}
            >
              {assignPanelOpen ? `\u{2715} Fermer` : `\u{1F527} Affecter prestataires`}
            </button>
          </div>
        </div>

        {/* ── Region Rubriques ── */}
        <div className="flex flex-col gap-4 flex-1">
          {visibleRegions.map((region) => (
            <RegionRubrique
              key={region}
              region={region}
              villages={villages}
              menages={menages}
              getEntry={getEntry}
              selectedGrappe={selectedGrappe}
              onSelectGrappe={onSelectGrappe}
              regionGrappes={regionGrappes}
              entrepreneurConfig={entrepreneurConfig}
            />
          ))}

          {visibleRegions.length === 0 && (
            <div className="flex items-center justify-center flex-1 min-h-[300px] text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-3">{'\u{1F5FA}\u{FE0F}'}</div>
                <div className="text-base font-semibold">
                  Aucune r{'\u{00E9}'}gion {'\u{00E0}'} afficher
                </div>
                <div className="text-[13px] mt-1">
                  S{'\u{00E9}'}lectionnez une r{'\u{00E9}'}gion ou affichez toutes les r{'\u{00E9}'}gions.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Grappe Assignment Panel (overlay) ── */}
        {assignPanelOpen && (
          <GrappeAssignmentPanel
            regionGrappes={regionGrappes}
            entrepreneurConfig={entrepreneurConfig}
            onUpdateConfig={onUpdateConfig}
            onSyncToAPI={onSyncToAPI}
            initialGrappeKey={selectedGrappe}
            initialLot={'B' as LotKey}
            prestataires={prestataires}
            onClose={() => setAssignPanelOpen(false)}
          />
        )}
      </div>
    );
  }
);

MapView.displayName = 'MapView';

export default MapView;
