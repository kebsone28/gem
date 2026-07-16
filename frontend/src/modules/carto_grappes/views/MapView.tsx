/**
 * MapView.tsx
 * Per-region collapsible accordion map matching the original HTML document design.
 * Each region gets a rubrique with header stats, SVG bubble map, legend, and tooltip.
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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  entrepreneur: string;
  n: number;
  hasBlocked: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGION_ICONS: Record<string, string> = {
  Kaffrine: '☀️',
  Tambacounda: '🌾',
};

/** Compute the bubble radius from village menage count and the region max. */
function bubbleRadius(n: number, maxN: number): number {
  if (maxN <= 0) return 10;
  return Math.max(5, Math.min(26, 5 + 21 * Math.sqrt(n / maxN)));
}

/** Check if a menage has any blocked status across lots A, B, C. */
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

// ─── Styles (matching original HTML CSS) ──────────────────────────────────────

const STYLES = {
  rubrique: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #d1d9e6',
    borderRadius: '14px',
    boxShadow: '0 4px 20px rgba(30,58,95,.06), 0 1px 3px rgba(0,0,0,.04)',
    overflow: 'hidden' as const,
    marginBottom: '18px',
  },
  header: {
    background: 'linear-gradient(135deg, #1E3A5F 0%, #2E5A8A 60%, #3A6FA0 100%)',
    color: 'white',
    padding: '16px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: 800,
    margin: 0,
  },
  statBox: {
    background: 'rgba(255,255,255,.15)',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: '8px',
    padding: '6px 14px',
    textAlign: 'center' as const,
    minWidth: '80px',
  },
  statVal: {
    fontSize: '20px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    opacity: 0.85,
  },
  body: {
    padding: '18px 22px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
  },
  svg: {
    borderRadius: '8px',
    border: '1px solid #e8edf2',
    background: 'linear-gradient(180deg, #1a2f4a 0%, #162840 100%)',
    maxWidth: '100%',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px 16px',
    padding: '12px 22px 14px',
    background: '#f4f7fa',
    borderTop: '1px solid #e8edf2',
  },
} as const;

const SVG_POINT_CLASS = `
  .vpoint {
    stroke: rgba(255,255,255,.7);
    stroke-width: 1.5;
    opacity: .9;
    cursor: pointer;
    transition: opacity .2s;
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
    50% { stroke-opacity: 0.3; filter: none; }
  }
`;

// ─── RegionRubrique (memoized sub-component) ─────────────────────────────────

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

    // ── Filter villages for this region ──
    const regionVillages = useMemo(
      () => villages.filter((v) => v.region === region),
      [villages, region]
    );

    // ── Compute menage count per village (for stats + blocked check) ──
    const villageMenageData = useMemo(() => {
      const map: Record<string, { count: number; hasBlocked: boolean }> = {};
      for (const m of menages) {
        if (m.region !== region) continue;
        const key = `${m.village}`;
        if (!map[key]) map[key] = { count: 0, hasBlocked: false };
        map[key].count++;
        if (!map[key].hasBlocked) {
          const entry = getEntry(m.ordre);
          map[key].hasBlocked = isMenageBlocked(entry);
        }
      }
      return map;
    }, [menages, region, getEntry]);

    // ── Max menage count for radius scaling ──
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
      // Fallback to defaultGrappe from village data
      for (const v of regionVillages) {
        if (map[v.village] === undefined) {
          map[v.village] = v.defaultGrappe;
        }
      }
      return map;
    }, [menages, region, regionVillages]);

    // ── Stats ──
    const totalGrappes = GRAPPE_COUNT[region] || 3;
    const villageCount = regionVillages.length;
    const totalMenages = useMemo(
      () => regionVillages.reduce((sum, v) => sum + v.n, 0),
      [regionVillages]
    );

    // ── Legend items: grappes with villages in this region ──
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
      <div style={STYLES.rubrique}>
        {/* ── Header ── */}
        <div
          style={STYLES.header}
          onClick={() => setCollapsed((c) => !c)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setCollapsed((c) => !c);
          }}
          aria-expanded={!collapsed}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{REGION_ICONS[region] || '📍'}</span>
            <h2 style={STYLES.headerTitle}>{region}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Stat boxes */}
            <div style={STYLES.statBox}>
              <div style={STYLES.statVal}>{totalGrappes}</div>
              <div style={STYLES.statLabel}>Grappes</div>
            </div>
            <div style={STYLES.statBox}>
              <div style={STYLES.statVal}>{villageCount}</div>
              <div style={STYLES.statLabel}>Villages</div>
            </div>
            <div style={STYLES.statBox}>
              <div style={STYLES.statVal}>{totalMenages}</div>
              <div style={STYLES.statLabel}>Ménages</div>
            </div>

            {/* Chevron */}
            <div
              style={{
                fontSize: '18px',
                transition: 'transform .25s',
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                marginLeft: '8px',
              }}
            >
              ▼
            </div>
          </div>
        </div>

        {/* ── Collapsible body ── */}
        {!collapsed && (
          <>
            <div style={STYLES.body}>
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
              <div style={STYLES.legend}>
                {legendItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background:
                        selectedGrappe === item.key ? 'rgba(30,58,95,.08)' : 'transparent',
                      border:
                        selectedGrappe === item.key ? '1px solid #2E5A8A' : '1px solid transparent',
                      transition: 'all .15s',
                    }}
                    onClick={() => onSelectGrappe(selectedGrappe === item.key ? null : item.key)}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: item.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                      Grappe {item.key.split('_')[1]}
                    </span>
                    {item.entrepreneur && (
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        — {item.entrepreneur}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
RegionRubrique.displayName = 'RegionRubrique';

// ─── RegionSVG (memoized SVG per region) ─────────────────────────────────────

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

    const handleMouseEnter = useCallback((data: TooltipData, e: React.MouseEvent) => {
      setTooltip(data);
      setTipPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      setTipPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }, []);

    const handleMouseLeave = useCallback(() => {
      setTooltip(null);
    }, []);

    return (
      <>
        {/* Scoped SVG styles */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ ...STYLES.svg, width: '100%', height: 'auto', maxHeight: '600px' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <style>{SVG_POINT_CLASS}</style>
          {villages.map((v, i) => {
            const data = villageMenageData[v.village] || { count: v.n, hasBlocked: false };
            const gNum = villageGrappeMap[v.village] || v.defaultGrappe;
            const gKey = `${region}_${gNum}`;
            const color = GRAPPE_COLORS[gKey] || '#6b7280';
            const radius = bubbleRadius(data.count, maxN);
            const isActive = selectedGrappe === gKey;
            const isDimmed = selectedGrappe !== null && !isActive;
            const pointClass = `vpoint${data.hasBlocked ? ' has-alert' : ''}`;

            return (
              <g
                key={`${region}-${v.village}-${i}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectGrappe(isActive ? null : gKey)}
                onMouseEnter={(e) =>
                  handleMouseEnter(
                    {
                      village: v.village,
                      region: v.region,
                      grappeKey: gKey,
                      grappeNum: gNum,
                      entrepreneur: '',
                      n: data.count,
                      hasBlocked: data.hasBlocked,
                    },
                    e
                  )
                }
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                {/* Main circle */}
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={radius}
                  fill={color}
                  opacity={isDimmed ? 0.08 : 0.85}
                  className={pointClass}
                />
              </g>
            );
          })}
        </svg>

        {/* ── Tooltip ── */}
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tipPos.x,
              top: tipPos.y,
              zIndex: 9999,
              pointerEvents: 'none',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #d1d9e6',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(30,58,95,.12), 0 2px 8px rgba(0,0,0,.06)',
              padding: '12px 16px',
              minWidth: '200px',
              maxWidth: '280px',
            }}
          >
            <div
              style={{ fontWeight: 700, fontSize: '14px', color: '#1E3A5F', marginBottom: '4px' }}
            >
              {tooltip.village}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
              {tooltip.region} — Grappe {tooltip.grappeNum}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: GRAPPE_COLORS[tooltip.grappeKey] || '#6b7280',
                }}
              />
              <span style={{ fontSize: '12px', color: '#374151' }}>
                {tooltip.n} ménage{tooltip.n > 1 ? 's' : ''}
              </span>
            </div>
            {tooltip.hasBlocked && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#DC2626',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⚠️ Ménage(s) bloqué(s)
              </div>
            )}
          </div>
        )}
      </>
    );
  }
);
RegionSVG.displayName = 'RegionSVG';

// ─── Main MapView Component ───────────────────────────────────────────────────

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

    // ── Which regions to display ──
    const visibleRegions = useMemo(() => {
      if (selectedRegion === '__ALL__') return REGIONS;
      return REGIONS.filter((r) => r === selectedRegion);
    }, [selectedRegion]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'auto',
          padding: '16px',
          gap: '6px',
        }}
      >
        {/* ── Top bar: title + action buttons ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px 10px',
            borderBottom: '1px solid #e8edf2',
            marginBottom: '8px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1E3A5F', margin: 0 }}>
            🗺️ Cartographie des grappes
          </h2>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedGrappe && (
              <button
                onClick={() => onSelectGrappe(null)}
                style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239,68,68,.3)',
                }}
              >
                ✕ Réinitialiser
              </button>
            )}
            <button
              onClick={() => setAssignPanelOpen((o) => !o)}
              style={{
                background: assignPanelOpen
                  ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                  : 'linear-gradient(135deg, #1E3A5F 0%, #2E5A8A 60%, #3A6FA0 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(30,58,95,.2)',
              }}
            >
              {assignPanelOpen ? '✕ Fermer' : '🔧 Affecter prestataires'}
            </button>
          </div>
        </div>

        {/* ── Region Rubriques ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: '300px',
                color: '#6b7280',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Aucune région à afficher</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Sélectionnez une région ou affichez toutes les régions.
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
