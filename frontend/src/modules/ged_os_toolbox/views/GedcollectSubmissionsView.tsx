import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Download, Loader2, Calendar, FileText } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

type MobileSubmission = {
  id: string;
  formKey: string;
  formVersion: string;
  status: string;
  values: Record<string, any>;
  submittedAt: string;
  submittedBy: { name: string; phone: string } | null;
};

const GedcollectSubmissionsView: React.FC = () => {
  const [submissions, setSubmissions] = useState<MobileSubmission[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('gedcollect-admin/submissions', {
        params: { offset: p * limit, limit },
      });
      setSubmissions(data.submissions || []);
      setCount(data.count || 0);
    } catch {
      toast.error('Erreur chargement soumissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await apiClient.get('gedcollect-admin/submissions', {
        params: { format: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gedcollect-submissions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé');
    } catch {
      toast.error('Erreur export');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(count / limit);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">
          GedCollect — Soumissions ({count})
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || count === 0}
          className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <Smartphone size={28} className="mx-auto mb-2 text-slate-600" />
          <p className="text-xs font-semibold text-slate-500">Aucune soumission mobile pour le moment.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                  <th className="pb-2 pr-2">Date</th>
                  <th className="pb-2 pr-2">Formulaire</th>
                  <th className="pb-2 pr-2">Statut</th>
                  <th className="pb-2 pr-2">Agent</th>
                  <th className="pb-2 pr-2">Téléphone</th>
                  <th className="pb-2">Valeurs</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 text-white/80 hover:bg-white/5">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="py-2 pr-2 font-semibold">{s.formKey}</td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                        s.status === 'submitted' ? 'bg-emerald-500/10 text-emerald-100' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{s.submittedBy?.name || '-'}</td>
                    <td className="py-2 pr-2">{s.submittedBy?.phone || '-'}</td>
                    <td className="py-2 max-w-[200px] truncate" title={JSON.stringify(s.values, null, 2)}>
                      {Object.values(s.values || {}).filter(Boolean).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-white disabled:opacity-30"
              >
                ←
              </button>
              <span className="text-[10px] text-slate-500">{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-white disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GedcollectSubmissionsView;