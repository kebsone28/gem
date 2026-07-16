import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../hooks/carto_grappes.service';

interface WorkflowItem {
  id: string;
  householdOrdre: number;
  nom: string;
  village: string;
  region: string;
  grappe: string;
  statuts: Record<string, unknown>;
  status: string;
  createdAt: string;
}

const WorkflowView: React.FC = React.memo(() => {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchWorkflowQueue();
      setItems(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = useCallback(async (id: string) => {
    setActionId(id);
    try {
      await api.approveWorkflow(id);
      await load();
    } catch { /* ignore */ }
    setActionId(null);
  }, [load]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="text-xs text-slate-400 animate-pulse">Chargement de la file d'attente...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Validation des changements</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">File d'attente des modifications soumises pour approbation</p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">{items.length} en attente</span>
        </div>

        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <span className="text-3xl block mb-2">✅</span>
            <span className="text-xs font-semibold">Aucune modification en attente</span>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Ordre</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Nom</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Village</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Région</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Grappe</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Statut</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Date</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-xs font-semibold text-slate-800">{item.householdOrdre}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{item.nom}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{item.village}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{item.region}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{item.grappe}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[10px] text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => approve(item.id)}
                        disabled={actionId === item.id}
                        className="px-3 py-1 text-[10px] font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionId === item.id ? '...' : '✓ Approuver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

WorkflowView.displayName = 'WorkflowView';
export default WorkflowView;
