import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { LotKey } from '../types';
import * as api from '../hooks/carto_grappes.service';

interface StatsViewProps {
  entries: Record<number, { A: { status: string }; B: { status: string }; C: { status: string }; conforme: boolean }>;
  menages: Array<{ ordre: number; region: string; grappe?: number }>;
}

interface Snapshot {
  id?: string;
  conforme: number;
  lotA: number;
  lotB: number;
  lotC: number;
  bloques: number;
  createdAt: string;
}

const StatsView: React.FC<StatsViewProps> = React.memo(({ entries, menages }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const totalMenages = menages.length || 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchStatsSnapshots();
        if (!cancelled && Array.isArray(data)) setSnapshots(data);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const takeSnapshot = useCallback(async () => {
    let conforme = 0, lotA = 0, lotB = 0, lotC = 0, bloques = 0;
    for (const m of menages) {
      const e = entries[m.ordre];
      if (!e) continue;
      if (e.conforme) conforme++;
      if (e.A?.status === 'fait') lotA++;
      if (e.B?.status === 'fait') lotB++;
      if (e.C?.status === 'fait') lotC++;
      (['A', 'B', 'C'] as LotKey[]).forEach(k => {
        if (e[k]?.status?.startsWith('bloque_')) bloques++;
      });
    }
    try {
      await api.createStatsSnapshot({ conforme, lotA, lotB, lotC, bloques });
      const data = await api.fetchStatsSnapshots();
      if (Array.isArray(data)) setSnapshots(data);
    } catch { /* ignore */ }
  }, [menages, entries]);

  const currentStats = useMemo(() => {
    let conforme = 0, lotA = 0, lotB = 0, lotC = 0, bloques = 0;
    for (const m of menages) {
      const e = entries[m.ordre];
      if (!e) continue;
      if (e.conforme) conforme++;
      if (e.A?.status === 'fait') lotA++;
      if (e.B?.status === 'fait') lotB++;
      if (e.C?.status === 'fait') lotC++;
      (['A', 'B', 'C'] as LotKey[]).forEach(k => {
        if (e[k]?.status?.startsWith('bloque_')) bloques++;
      });
    }
    const tot = menages.length || 1;
    return { conforme, lotA, lotB, lotC, bloques, tot, pctConforme: Math.round(conforme / tot * 100), pctA: Math.round(lotA / tot * 100), pctB: Math.round(lotB / tot * 100), pctC: Math.round(lotC / tot * 100) };
  }, [menages, entries]);

  const W = 800, H = 260;
  const padL = 44, padR = 12, padT = 16, padB = 30;
  const cW = W - padL - padR, cH = H - padB - padT;

  const maxVal = useMemo(() => {
    if (snapshots.length === 0) return menages.length || 1;
    return Math.max(menages.length, ...snapshots.map(s => Math.max(s.conforme, s.lotA, s.lotB, s.lotC, s.bloques)));
  }, [snapshots, menages.length]);

  const xStep = snapshots.length > 1 ? cW / (snapshots.length - 1) : cW;
  const xScale = (i: number) => padL + i * xStep;
  const yScale = (v: number) => padT + cH - (v / maxVal) * cH;

  const mkPath = (key: keyof Snapshot, color: string) => {
    if (snapshots.length < 2) return null;
    const pts = snapshots.map((s, i) => `${xScale(i).toFixed(1)},${yScale(Number(s[key])).toFixed(1)}`).join(' ');
    return <polyline key={`p-${key}`} points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />;
  };
  const mkDots = (key: keyof Snapshot, color: string) =>
    snapshots.map((s, i) => {
      const pct = Math.round(Number(s[key]) / totalMenages * 100);
      return <circle key={`d-${key}-${i}`} cx={xScale(i)} cy={yScale(Number(s[key]))} r={3} fill={color} stroke="white" strokeWidth={1.5}><title>{s.createdAt?.slice(0, 10)}: {s[key]} ({pct}%)</title></circle>;
    });

  if (loading) return <div className="p-6 text-center"><span className="text-xs text-slate-400 animate-pulse">Chargement...</span></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Évolution dans le temps</h3>
            <p className="text-[11px] text-slate-400">{snapshots.length} jours enregistrés</p>
          </div>
          <button onClick={takeSnapshot} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">📸 Snapshot</button>
        </div>
        {snapshots.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
                {[0, 25, 50, 75, 100].map(pct => {
                  const y = yScale(pct / 100 * maxVal);
                  return <React.Fragment key={pct}><text x={padL - 4} y={y} textAnchor="end" fontSize={9} fill="#8A97A3" dominantBaseline="middle">{pct}%</text><line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E8EDF2" strokeWidth={1} /></React.Fragment>;
                })}
                {snapshots.map((s, i) => { if (i % Math.max(1, Math.floor(snapshots.length / 6)) !== 0 && i !== snapshots.length - 1) return null; return <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#8A97A3">{s.createdAt?.slice(5, 10)}</text>; })}
                {mkPath('conforme', '#22863a')}{mkDots('conforme', '#22863a')}
                {mkPath('lotA', '#2E86AB')}{mkDots('lotA', '#2E86AB')}
                {mkPath('lotB', '#E07A5F')}{mkDots('lotB', '#E07A5F')}
                {mkPath('lotC', '#2F855A')}{mkDots('lotC', '#2F855A')}
                {mkPath('bloques', '#cb2431')}{mkDots('bloques', '#cb2431')}
              </svg>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-[11px]">
              {[['Conforme', '#22863a'], ['Lot A', '#2E86AB'], ['Lot B', '#E07A5F'], ['Lot C', '#2F855A'], ['Blocages', '#cb2431']].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5 text-slate-700"><span className="w-4 h-1 rounded inline-block" style={{ background: c as string }} /> {l}</span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs">📊 Pas encore de données d'évolution.</div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-xs font-bold text-slate-700 mb-4">Données du jour</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[{ label: 'Total', val: currentStats.tot, color: '#1e293b', pct: 100 }, { label: 'Conformes', val: currentStats.conforme, color: '#22863a', pct: currentStats.pctConforme }, { label: 'Lot A', val: currentStats.lotA, color: '#2E86AB', pct: currentStats.pctA }, { label: 'Lot B', val: currentStats.lotB, color: '#E07A5F', pct: currentStats.pctB }, { label: 'Lot C', val: currentStats.lotC, color: '#2F855A', pct: currentStats.pctC }, { label: 'Bloqués', val: currentStats.bloques, color: '#cb2431', pct: Math.round(currentStats.bloques / totalMenages * 100) }].map(c => (
            <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold" style={{ color: c.color }}>{c.val}</div>
              <div className="text-[10px] text-slate-400">{c.label}</div>
              <div className="text-[10px] font-semibold" style={{ color: c.color }}>{c.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

StatsView.displayName = 'StatsView';
export default StatsView;