import React, { useState, useMemo, useCallback } from 'react';
import type { HistoryEntry, Menage } from '../types';
import * as api from '../hooks/carto_grappes.service';

interface HistoryViewProps {
  history: HistoryEntry[];
  menages: Menage[];
  onRefresh?: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = React.memo(({ history, menages, onRefresh }) => {
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterLot, setFilterLot] = useState<string>('all');
  const [clearing, setClearing] = useState(false);

  const menageMap = useMemo(() => {
    const m: Record<number, Menage> = {};
    for (const x of menages) m[x.ordre] = x;
    return m;
  }, [menages]);

  const clearHistory = useCallback(async () => {
    if (!confirm('Supprimer tout l\'historique ? Cette action est irréversible.')) return;
    setClearing(true);
    try {
      await api.clearHistory();
      onRefresh?.();
    } catch { /* ignore */ }
    setClearing(false);
  }, [onRefresh]);

  const filtered = useMemo(() => {
    let result = [...history].reverse();
    if (filterRegion !== 'all') {
      result = result.filter(h => {
        const mg = menageMap[h.householdOrdre];
        return mg?.region === filterRegion;
      });
    }
    if (filterLot !== 'all') {
      result = result.filter(h => h.lot === filterLot);
    }
    return result;
  }, [history, filterRegion, filterLot, menageMap]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Historique des modifications</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Suivi des changements de statut avec timestamps et utilisateur</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">{filtered.length} entrées</span>
            {filtered.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={clearing}
                className="px-2.5 py-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {clearing ? 'Suppression...' : '🗑 Vider'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all" style={{ color: '#1e293b' }}>Toutes les régions</option>
            <option value="Kaffrine" style={{ color: '#1e293b' }}>Kaffrine</option>
            <option value="Tambacounda" style={{ color: '#1e293b' }}>Tambacounda</option>
          </select>
          <select
            value={filterLot}
            onChange={e => setFilterLot(e.target.value)}
            className="px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all" style={{ color: '#1e293b' }}>Tous les lots</option>
            <option value="A" style={{ color: '#1e293b' }}>Lot A</option>
            <option value="B" style={{ color: '#1e293b' }}>Lot B</option>
            <option value="C" style={{ color: '#1e293b' }}>Lot C</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">📝</span>
            <span className="text-sm font-medium">Aucun historique disponible</span>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ménage</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Lot</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ancien statut</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Nouveau statut</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => {
                  const mg = menageMap[h.householdOrdre];
                  return (
                    <tr key={h.id || i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                        {new Date(h.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {mg?.nom || `#${h.householdOrdre}`}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {h.lot}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-red-600">{h.fromStatus}</td>
                      <td className="px-3 py-2 text-emerald-600 font-semibold">{h.toStatus}</td>
                      <td className="px-3 py-2 text-slate-500">{h.userName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

HistoryView.displayName = 'HistoryView';
export default HistoryView;
