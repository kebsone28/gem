import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Menage, StatusValue } from '../types';
import { STATUS_MAP } from '../constants';
import * as api from '../hooks/carto_grappes.service';

interface SyncViewProps {
  menages: Menage[];
  entries: Record<number, { A: { status: StatusValue; justif: string }; B: { status: StatusValue; justif: string }; C: { status: StatusValue; justif: string }; conforme: boolean; obs: string }>;
}

interface ArchiveEntry {
  id: string;
  grappeKey: string;
  region: string;
  grappe: string;
  totalMenages: number;
  totalConformes: number;
  createdAt: string;
}

const SyncView: React.FC<SyncViewProps> = React.memo(({ menages, entries }) => {
  const [lastSyncTs, setLastSyncTs] = useState<string | null>(() => {
    try { return localStorage.getItem('proquelec_last_sync'); } catch { return null; }
  });
  const [importCount, setImportCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingArchives(true);
      try {
        const data = await api.fetchArchives();
        if (!cancelled && Array.isArray(data)) setArchives(data);
      } catch { /* ignore */ }
      if (!cancelled) setLoadingArchives(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const exportJSON = useCallback(() => {
    setSyncing(true);
    try {
      const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        source: 'GED OS — Carto Grappes',
        entries,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CartoGrappes_Suivi_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSyncing(false);
    }
  }, [entries]);

  const importJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string);
        const importedEntries = imported.entries || imported;
        let count = 0;
        const menageOrdres = new Set(menages.map(m => m.ordre));

        for (const [ordreStr, data] of Object.entries(importedEntries as Record<string, unknown>)) {
          const ordre = Number(ordreStr);
          if (!menageOrdres.has(ordre)) continue;
          const d = data as Record<string, unknown>;
          if (d.A || d.B || d.C) {
            localStorage.setItem(`proquelec_import_${ordre}`, JSON.stringify(d));
            count++;
          }
        }

        const ts = new Date().toISOString();
        localStorage.setItem('proquelec_last_sync', ts);
        setLastSyncTs(ts);
        setImportCount(count);
        setTimeout(() => setImportCount(null), 5000);
      } catch {
        alert('Fichier JSON invalide');
      } finally {
        setSyncing(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [menages]);

  const exportExcel = useCallback(async () => {
    setSyncing(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const rows = menages.map(m => {
        const e = entries[m.ordre];
        return {
          '#': m.ordre,
          'Nom': m.nom,
          'Village': m.village,
          'Région': m.region,
          'Grappe': m.grappe,
          'Lot A': e ? (STATUS_MAP[e.A.status]?.label || e.A.status) : 'Non fait',
          'Lot B': e ? (STATUS_MAP[e.B.status]?.label || e.B.status) : 'Non fait',
          'Lot C': e ? (STATUS_MAP[e.C.status]?.label || e.C.status) : 'Non fait',
          'Conforme': e?.conforme ? 'Oui' : 'Non',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Suivi');
      XLSX.writeFile(wb, `CartoGrappes_Sync_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setSyncing(false);
    }
  }, [menages, entries]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Synchronisation des données</h3>
        <p className="text-xs text-slate-500 mb-5">
          Exportez ou importez les données de suivi pour partager entre appareils ou conserver une sauvegarde.
        </p>

        <div className="space-y-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-slate-700 mb-3">Exporter</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportJSON}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                📦 Exporter les statuts (JSON)
              </button>
              <button
                onClick={exportExcel}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                📊 Exporter suivi complet (Excel)
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-slate-700 mb-3">Importer</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Importez un fichier JSON exporté depuis un autre appareil. Les statuts existants seront fusionnés.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 cursor-pointer transition-colors">
              {syncing ? 'Importation...' : '📂 Importer les statuts reçus (JSON)'}
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={importJSON}
              />
            </label>
            {importCount !== null && (
              <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-semibold">
                ✅ {importCount} enregistrement(s) importé(s) avec succès
              </div>
            )}
          </div>

          {lastSyncTs && (
            <div className="text-[10px] text-slate-400 text-center">
              Dernière synchronisation : {new Date(lastSyncTs).toLocaleString('fr-FR')}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Archives</h3>
        <p className="text-[11px] text-slate-400 mb-4">
          Snapshots archivés des grappes finalisées.
        </p>

        {loadingArchives ? (
          <span className="text-xs text-slate-400 animate-pulse">Chargement...</span>
        ) : archives.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="text-2xl block mb-2">📁</span>
            <span className="text-xs font-semibold">Aucune archive disponible</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Clé</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Région</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Grappe</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Ménages</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Conformes</th>
                  <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {archives.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-xs font-semibold text-slate-800">{a.grappeKey}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{a.region}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{a.grappe}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{a.totalMenages}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{a.totalConformes}</td>
                    <td className="py-2 px-3 text-[10px] text-slate-400">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
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

SyncView.displayName = 'SyncView';
export default SyncView;
