import React, { useState, useMemo } from 'react';
import type { Menage, RegionSummary, LotKey, StatusValue } from '../types';
import { STATUS_MAP, LOT_KEYS } from '../constants';

interface DashboardViewProps {
  menages: Menage[];
  entries: Record<number, {
    A: { status: StatusValue; justif: string };
    B: { status: StatusValue; justif: string };
    C: { status: StatusValue; justif: string };
    conforme: boolean;
    obs: string;
  }>;
  regionSummaries: RegionSummary[];
  globalSummary: {
    total: number; fait: number; enCours: number; bloque: number;
    nonFait: number; conforme: number; pourcentage: number;
  };
}

const BAREME: Record<LotKey, number> = { A: 15000, B: 25000, C: 10000 };

function isBloque(s: StatusValue): boolean {
  return s.startsWith('bloque_');
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function fmtFCFA(n: number): string {
  return fmt(n) + ' FCFA';
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
}

const DonutChart: React.FC<{
  segments: { value: number; color: string }[];
  size?: number;
  sw?: number;
  center?: string;
  sub?: string;
}> = ({ segments, size = 110, sw = 14, center, sub }) => {
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        )}
        {segments.map((seg, i) => {
          const len = total > 0 ? (seg.value / total) * C : 0;
          const prevLen = segments.slice(0, i).reduce((acc, s) => acc + (total > 0 ? (s.value / total) * C : 0), 0);
          const off = -prevLen;
          return len > 0 ? (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={off}
            />
          ) : null;
        })}
      </g>
      {center != null && (
        <text
          x={size / 2}
          y={sub ? size / 2 - 5 : size / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fontWeight={900}
          fill="#1e293b"
        >
          {center}
        </text>
      )}
      {sub != null && (
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fill="#94a3b8"
        >
          {sub}
        </text>
      )}
    </svg>
  );
};

const StatusBadge: React.FC<{ status: StatusValue }> = ({ status }) => {
  const label = STATUS_MAP[status]?.label ?? status;
  const cls = isBloque(status)
    ? 'bg-red-100 text-red-700'
    : status === 'fait'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'en_cours'
        ? 'bg-sky-100 text-sky-700'
        : status === 'non_conforme'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  menages, entries, regionSummaries, globalSummary,
}) => {
  const [showFin, setShowFin] = useState(false);

  const lotStats = useMemo(() => {
    const s: Record<LotKey, { fait: number; enCours: number; bloque: number; nonFait: number }> = {
      A: { fait: 0, enCours: 0, bloque: 0, nonFait: 0 },
      B: { fait: 0, enCours: 0, bloque: 0, nonFait: 0 },
      C: { fait: 0, enCours: 0, bloque: 0, nonFait: 0 },
    };
    for (const m of menages) {
      const e = entries[m.ordre];
      for (const lot of LOT_KEYS) {
        if (!e) { s[lot].nonFait++; continue; }
        const st = e[lot].status;
        if (st === 'fait') s[lot].fait++;
        else if (isBloque(st)) s[lot].bloque++;
        else if (st === 'en_cours' || st === 'non_conforme') s[lot].enCours++;
        else s[lot].nonFait++;
      }
    }
    return s;
  }, [menages, entries]);

  const priorityMenages = useMemo(() => {
    return menages
      .filter(m => {
        const e = entries[m.ordre];
        if (!e) return false;
        if (!e.conforme) return true;
        return LOT_KEYS.some(lot => isBloque(e[lot].status));
      })
      .sort((a, b) => {
        const ea = entries[a.ordre]!, eb = entries[b.ordre]!;
        const aBlok = LOT_KEYS.some(l => isBloque(ea[l].status)) ? 0 : 1;
        const bBlok = LOT_KEYS.some(l => isBloque(eb[l].status)) ? 0 : 1;
        return aBlok - bBlok || a.ordre - b.ordre;
      });
  }, [menages, entries]);

  const finData = useMemo(() => {
    const byGrappe: Record<string, {
      region: string; grappe: number;
      cA: number; cB: number; cC: number;
    }> = {};
    for (const m of menages) {
      if (m.grappe == null) continue;
      const k = `${m.region}|${m.grappe}`;
      if (!byGrappe[k]) {
        byGrappe[k] = { region: m.region, grappe: m.grappe, cA: 0, cB: 0, cC: 0 };
      }
      const e = entries[m.ordre];
      if (!e) continue;
      if (e.A.status === 'fait') byGrappe[k].cA++;
      if (e.B.status === 'fait') byGrappe[k].cB++;
      if (e.C.status === 'fait') byGrappe[k].cC++;
    }
    const regions: Record<string, {
      items: typeof byGrappe[string][];
      subtotal: number;
    }> = {};
    for (const g of Object.values(byGrappe)) {
      if (!regions[g.region]) regions[g.region] = { items: [], subtotal: 0 };
      regions[g.region].items.push(g);
      regions[g.region].subtotal +=
        g.cA * BAREME.A + g.cB * BAREME.B + g.cC * BAREME.C;
    }
    for (const r of Object.values(regions)) {
      r.items.sort((a, b) => a.grappe - b.grappe);
    }
    const grand = Object.values(regions).reduce((s, r) => s + r.subtotal, 0);
    return { regions, grand };
  }, [menages, entries]);

  const metrics = useMemo(() => {
    const sz = new Blob([JSON.stringify(entries)]).size;
    const entered = Object.keys(entries).length;
    return { total: menages.length, entered, size: sz };
  }, [menages, entries]);

  const conformeSegs = [
    { value: globalSummary.conforme, color: '#10b981' },
    { value: globalSummary.total - globalSummary.conforme, color: '#ef4444' },
  ];

  const lotSegs = (lot: LotKey) => {
    const s = lotStats[lot];
    return [
      { value: s.fait, color: '#10b981' },
      { value: s.enCours, color: '#f59e0b' },
      { value: s.bloque, color: '#ef4444' },
      { value: s.nonFait, color: '#d1d5db' },
    ];
  };

  const pct = globalSummary.total > 0 ? globalSummary.pourcentage : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'Total Ménages', value: globalSummary.total, color: 'from-blue-500 to-blue-600', tc: 'text-blue-600' },
          { label: 'Terminés', value: globalSummary.fait, color: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-600' },
          { label: 'En Cours', value: globalSummary.enCours, color: 'from-amber-500 to-amber-600', tc: 'text-amber-600' },
          { label: 'Bloqués', value: globalSummary.bloque, color: 'from-red-500 to-red-600', tc: 'text-red-600' },
        ] as const).map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${c.color} rounded-l-xl`} />
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{c.label}</div>
            <div className={`text-3xl font-black ${c.tc} mt-1`}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Progression Globale ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Progression Globale</h3>
          <span className="text-2xl font-black text-blue-600">{pct}%</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${globalSummary.total > 0 ? (globalSummary.fait / globalSummary.total) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-sky-400 transition-all"
            style={{ width: `${globalSummary.total > 0 ? (globalSummary.enCours / globalSummary.total) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-red-400 transition-all"
            style={{ width: `${globalSummary.total > 0 ? (globalSummary.bloque / globalSummary.total) * 100 : 0}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Terminés</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" />En cours</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Bloqués</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />Non faits</span>
        </div>
      </div>

      {/* ── Donut Charts ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Vue par Donut</h3>
        <div className="flex flex-wrap items-start justify-around gap-6">
          <div className="flex flex-col items-center gap-1">
            <DonutChart
              segments={conformeSegs}
              center={fmt(globalSummary.conforme)}
              sub="conformes"
            />
            <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />Conformes
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />Non conf.
              </span>
            </div>
          </div>

          {(LOT_KEYS as LotKey[]).map(lot => {
            const totalLot = lotStats[lot].fait;
            const pctLot = globalSummary.total > 0
              ? Math.round((totalLot / globalSummary.total) * 100)
              : 0;
            return (
              <div key={lot} className="flex flex-col items-center gap-1">
                <DonutChart
                  segments={lotSegs(lot)}
                  center={`${pctLot}%`}
                  sub={`Lot ${lot}`}
                />
                <div className="flex gap-2 text-[10px] text-slate-500 mt-1 flex-wrap justify-center">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />Fait
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />En cours
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />Bloqué
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />Non fait
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Region Sections ── */}
      {regionSummaries.map(region => (
        <div key={region.region} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">{region.region}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{fmt(region.fait)}/{fmt(region.total)} terminés</span>
              <span className="font-bold text-blue-600">{region.pct}%</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {region.grappes.filter(g => g.total > 0).map(grp => (
              <div key={grp.key}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-700">Grappe {grp.grappe}</span>
                  <span className="font-bold text-blue-600">{grp.pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${grp.total > 0 ? (grp.fait / grp.total) * 100 : 0}%` }}
                  />
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${grp.total > 0 ? (grp.enCours / grp.total) * 100 : 0}%` }}
                  />
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${grp.total > 0 ? (grp.bloque / grp.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Priority Table ── */}
      {priorityMenages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">
            Ménages bloqués / non conformes
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({priorityMenages.length})
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-semibold text-slate-500">Ordre</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-500">Nom</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-500">Village</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-500">Région</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-500">Grappe</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-500">Lot A</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-500">Lot B</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-500">Lot C</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-500">Conforme</th>
                </tr>
              </thead>
              <tbody>
                {priorityMenages.map(m => {
                  const e = entries[m.ordre]!;
                  const hasBlok = LOT_KEYS.some(l => isBloque(e[l].status));
                  const rowCls = hasBlok ? 'bg-red-50' : 'bg-amber-50';
                  return (
                    <tr key={m.ordre} className={`border-b border-slate-100 ${rowCls}`}>
                      <td className="py-1.5 px-2 text-slate-700 font-mono">{m.ordre}</td>
                      <td className="py-1.5 px-2 text-slate-700 font-medium">{m.nom}</td>
                      <td className="py-1.5 px-2 text-slate-700">{m.village}</td>
                      <td className="py-1.5 px-2 text-slate-700">{m.region}</td>
                      <td className="py-1.5 px-2 text-slate-700 text-center">{m.grappe ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center"><StatusBadge status={e.A.status} /></td>
                      <td className="py-1.5 px-2 text-center"><StatusBadge status={e.B.status} /></td>
                      <td className="py-1.5 px-2 text-center"><StatusBadge status={e.C.status} /></td>
                      <td className="py-1.5 px-2 text-center">
                        {e.conforme
                          ? <span className="text-emerald-600 font-bold">✓</span>
                          : <span className="text-red-500 font-bold">✗</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Data Metrics Footer ── */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-t border-slate-200 pt-3 px-1">
        <span>Total ménages : {fmt(metrics.total)}</span>
        <span>Enregistrements saisis : {fmt(metrics.entered)}</span>
        <span>Taille estimée : {fmtBytes(metrics.size)}</span>
      </div>

      {/* ── Financial Button (fixed) ── */}
      <button
        onClick={() => setShowFin(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-3 rounded-xl shadow-lg transition-colors"
      >
        🧮 Bordereau Financier
      </button>

      {/* ── Financial Modal ── */}
      {showFin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowFin(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-800">🧮 Bordereau Financier</h2>
              <button
                onClick={() => setShowFin(false)}
                className="text-slate-400 hover:text-slate-800 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Barème : Lot A = {fmtFCFA(BAREME.A)} · Lot B = {fmtFCFA(BAREME.B)} · Lot C = {fmtFCFA(BAREME.C)} par ménage conforme (statut « fait »)
              </p>

              {Object.entries(finData.regions).map(([region, data]) => (
                <div key={region} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">{region}</span>
                    <span className="text-sm font-bold text-blue-600">{fmtFCFA(data.subtotal)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-1.5 px-3">Grappe</th>
                        <th className="text-center py-1.5 px-2">Conf. A</th>
                        <th className="text-center py-1.5 px-2">Conf. B</th>
                        <th className="text-center py-1.5 px-2">Conf. C</th>
                        <th className="text-right py-1.5 px-3">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map(g => {
                        const montant = g.cA * BAREME.A + g.cB * BAREME.B + g.cC * BAREME.C;
                        return (
                          <tr key={g.grappe} className="border-b border-slate-100">
                            <td className="py-1.5 px-3 text-slate-700 font-medium">Grappe {g.grappe}</td>
                            <td className="py-1.5 px-2 text-slate-700 text-center">{g.cA}</td>
                            <td className="py-1.5 px-2 text-slate-700 text-center">{g.cB}</td>
                            <td className="py-1.5 px-2 text-slate-700 text-center">{g.cC}</td>
                            <td className="py-1.5 px-3 text-slate-700 text-right font-mono">{fmtFCFA(montant)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="flex items-center justify-between bg-slate-800 text-white rounded-xl px-5 py-3">
                <span className="font-bold">Total Général</span>
                <span className="text-xl font-black">{fmtFCFA(finData.grand)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DashboardView.displayName = 'DashboardView';
export default DashboardView;
