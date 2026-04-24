/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import {
  Search,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Filter,
  Download,
  Upload,
} from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { useTheme } from '../../contexts/ThemeContext';
import { fmtFCFA } from '../../utils/format';
import logger from '../../utils/logger';

const REGIONS = ['Tous', 'Global', 'Kaffrine', 'Tambacounda'];
const STATUS = ['Tous', 'Conforme', 'Dépassement'];

export default function DevisVsReel() {
  const {
    devis,
    updateRealCost,
    updatePlannedCost,
    deleteDevisItem,
    addDevisItem,
    importDevisList,
    project,
  } = useFinances();
  const { isDarkMode } = useTheme();

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('Tous');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);

  // ── Filtered report ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return (devis.report || []).filter((item: any) => {
      const matchSearch =
        !search ||
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.region.toLowerCase().includes(search.toLowerCase());
      const matchRegion = regionFilter === 'Tous' || item.region === regionFilter;
      const matchStatus =
        statusFilter === 'Tous' ||
        (statusFilter === 'Conforme' ? item.margin >= 0 : item.margin < 0);
      return matchSearch && matchRegion && matchStatus;
    });
  }, [devis.report, search, regionFilter, statusFilter]);

  const overBudgetCount = (devis.report || []).filter((i: any) => i.margin < 0).length;
  const budgetUsagePct = devis.ceiling
    ? Math.min(Math.round((devis.totalReal / devis.ceiling) * 100), 100)
    : 0;

  // ── Excel Export (multi-sheet) ────────────────────────────────────────────
  const handleExcelExport = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      const wb = utils.book_new();

      // Sheet 1: Devis vs Réel
      const devisData = (devis.report || []).map((item: any) => ({
        ID: item.id,
        Poste_de_Depense: item.label,
        Region: item.region,
        Prevision_Qte: item.qty,
        Prevision_PU: item.unit,
        Total_Prevu: item.planned,
        Reel_Qte: item.rq,
        Reel_PU: item.ru,
        Total_Reel: item.realTotal,
        Ecart_Marge: item.margin,
        Statut: item.margin >= 0 ? 'CONFORME' : 'DEPASSEMENT',
      }));
      const wsDevis = utils.json_to_sheet(devisData);
      utils.book_append_sheet(wb, wsDevis, 'Devis vs Reel');

      // Sheet 2: KPIs résumé
      const kpiData = [
        { Indicateur: 'Total Estime', Valeur: devis.totalPlanned },
        { Indicateur: 'Total Realise', Valeur: devis.totalReal },
        { Indicateur: 'Marge Globale', Valeur: devis.globalMargin },
        { Indicateur: 'Marge (%)', Valeur: parseFloat(devis.marginPct?.toFixed(2) || '0') },
        { Indicateur: 'Plafond Devis', Valeur: devis.ceiling },
        { Indicateur: 'Usage Budget (%)', Valeur: budgetUsagePct },
        { Indicateur: 'Postes En Depassement', Valeur: overBudgetCount },
      ];
      const wsKPI = utils.json_to_sheet(kpiData);
      utils.book_append_sheet(wb, wsKPI, 'KPIs');

      writeFile(wb, `bilan_complet_${project?.name || 'projet'}.xlsx`);
    } catch (err) {
      logger.error('[DevisVsReel] Erreur export Excel', err);
      alert("Erreur lors de l'export Excel.");
    }
  };

  // ── Excel Import with validation ─────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors([]);
    setImportSuccess(false);

    try {
      let rawData: any[] = [];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            const row: any = {};
            headers.forEach((h, j) => {
              row[h] = cols[j];
            });
            rawData.push(row);
          }
        }
      } else {
        const { read, utils } = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        rawData = utils.sheet_to_json(workbook.Sheets[sheetName]);
      }

      // Validation
      const errors: string[] = [];
      const REQUIRED = ['Poste_de_Depense'];
      rawData.forEach((row, i) => {
        REQUIRED.forEach((col) => {
          if (!row[col] && !row['Label'] && !row['label']) {
            errors.push(`Ligne ${i + 2}: Colonne '${col}' manquante ou vide.`);
          }
        });
        const qty = Number(row.Prevision_Qte || row.Quantite_Prevue || 0);
        const unit = Number(row.Prevision_PU || row.Prix_Unitaire || 0);
        if (isNaN(qty)) errors.push(`Ligne ${i + 2}: 'Prevision_Qte' doit être un nombre.`);
        if (isNaN(unit)) errors.push(`Ligne ${i + 2}: 'Prevision_PU' doit être un nombre.`);
      });

      if (errors.length > 0) {
        setImportErrors(errors);
        e.target.value = '';
        return;
      }

      if (rawData.length === 0) {
        setImportErrors(['Le fichier est vide ou son format est incorrect.']);
        e.target.value = '';
        return;
      }

      await importDevisList(rawData);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err: any) {
      setImportErrors([`Erreur de lecture: ${err.message || 'Format de fichier invalide.'}`]);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Import Errors */}
      {importErrors.length > 0 && (
        <div
          className={`border rounded-2xl p-4 ${isDarkMode ? 'bg-rose-900/20 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
        >
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest mb-2">
            <AlertTriangle size={14} /> Erreurs d'import détectées
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            {importErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          <p className="text-xs mt-2 opacity-70">
            Format attendu : ID, Poste_de_Depense, Region, Prevision_Qte, Prevision_PU, Reel_Qte,
            Reel_PU
          </p>
        </div>
      )}

      {/* Import Success */}
      {importSuccess && (
        <div
          className={`border rounded-2xl p-4 flex items-center gap-3 ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
        >
          <CheckCircle2 size={16} />
          <span className="text-sm font-bold">
            Import réussi ! Les données ont été mises à jour.
          </span>
        </div>
      )}

      {/* Budget alert banner */}
      {overBudgetCount > 0 && (
        <div
          className={`border rounded-2xl p-4 flex items-center justify-between gap-4 ${isDarkMode ? 'bg-rose-900/20 border-rose-800' : 'bg-rose-50 border-rose-200'}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-500 shrink-0" />
            <div>
              <p className={`font-black text-sm ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
                {overBudgetCount} poste{overBudgetCount > 1 ? 's' : ''} en dépassement budgétaire
              </p>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>
                Filtrer par "Dépassement" pour les identifier rapidement.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('Dépassement')}
            className="px-4 py-2 bg-rose-500 text-white font-black text-xs rounded-xl hover:bg-rose-600 transition-all shrink-0"
          >
            VOIR
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 group">
            <Search
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}
              size={16}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un poste..."
              title="Rechercher un poste de dépense"
              className={`w-full border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:ring-indigo-500/30' : 'bg-white border-slate-200 text-slate-700 focus:ring-indigo-500/20'}`}
            />
          </div>

          {/* Region filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
            <select
              title="Filtrer par région"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className={`border rounded-xl py-3 px-3 text-sm focus:outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              title="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`border rounded-xl py-3 px-3 text-sm focus:outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {(search || regionFilter !== 'Tous' || statusFilter !== 'Tous') && (
              <button
                onClick={() => {
                  setSearch('');
                  setRegionFilter('Tous');
                  setStatusFilter('Tous');
                }}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-bold transition-all"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Right side: Summary + Buttons */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div
            className={`backdrop-blur-md border rounded-2xl px-6 py-3 shadow flex items-center gap-6 transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className="flex flex-col items-center">
              <span
                className={`text-xs font-black uppercase tracking-widest mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Marge Globale
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-base font-black ${devis.globalMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
                >
                  {fmtFCFA(devis.globalMargin)}
                </span>
                {devis.globalMargin >= 0 ? (
                  <TrendingUp size={14} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={14} className="text-rose-500" />
                )}
              </div>
            </div>
            <div className={`w-px h-8 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <div className="flex flex-col items-center">
              <span
                className={`text-xs font-black uppercase tracking-widest mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Performance
              </span>
              <span className="text-base font-black text-indigo-600">
                {devis.marginPct?.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Export Excel */}
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Download size={15} />
            <span>EXCEL</span>
          </button>

          {/* Import Excel */}
          <label className="flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs rounded-xl transition-all shadow-lg cursor-pointer active:scale-95">
            <Upload size={15} />
            <span>IMPORTER</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {/* Result count */}
      {filtered.length !== (devis.report || []).length && (
        <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur{' '}
          {(devis.report || []).length} postes
        </p>
      )}

      {/* Comparison Table */}
      <div
        className={`border rounded-3xl overflow-hidden shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`${isDarkMode ? 'bg-slate-950/50 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-100'}`}
              >
                <th
                  className={`px-6 py-5 text-xs font-black uppercase tracking-[0.2em] w-1/4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  Poste de Dépense
                </th>
                <th
                  className={`px-4 py-5 text-xs font-black border-x text-center ${isDarkMode ? 'text-slate-400 border-slate-800 bg-blue-500/5' : 'text-slate-500 border-slate-100 bg-blue-50/30'}`}
                  colSpan={2}
                >
                  Prévision (Devis)
                </th>
                <th
                  className={`px-4 py-5 text-xs font-black border-x text-center ${isDarkMode ? 'text-slate-400 border-slate-800 bg-indigo-500/5' : 'text-slate-500 border-slate-100 bg-indigo-50/30'}`}
                  colSpan={2}
                >
                  Réalisation (Réel)
                </th>
                <th
                  className={`px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  Ecart / Marge
                </th>
              </tr>
              <tr
                className={`border-b ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-100/80 border-slate-100'}`}
              >
                <th className="px-6 py-3"></th>
                <th
                  className={`px-4 py-3 text-xs font-black text-right ${isDarkMode ? 'text-slate-500 bg-blue-500/5' : 'text-slate-400 bg-blue-50/30'}`}
                >
                  Qté
                </th>
                <th
                  className={`px-4 py-3 text-xs font-black text-right ${isDarkMode ? 'text-slate-500 bg-blue-500/5' : 'text-slate-400 bg-blue-50/30'}`}
                >
                  P.U
                </th>
                <th
                  className={`px-4 py-3 text-xs font-black text-right border-l ${isDarkMode ? 'text-slate-500 bg-indigo-500/5 border-slate-800' : 'text-slate-400 bg-indigo-50/30 border-slate-100'}`}
                >
                  Qté Réelle
                </th>
                <th
                  className={`px-4 py-3 text-xs font-black text-right ${isDarkMode ? 'text-slate-500 bg-indigo-500/5' : 'text-slate-400 bg-indigo-50/30'}`}
                >
                  P.U Réel
                </th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/50' : 'divide-slate-50'}`}>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`px-6 py-12 text-center text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    Aucun poste ne correspond à votre recherche.
                  </td>
                </tr>
              ) : (
                filtered.map((item: any) => {
                  const isKaffrine = item.region === 'Kaffrine';
                  const isTamba = item.region === 'Tambacounda';
                  const isOver = item.margin < 0;
                  const usagePct =
                    item.planned > 0
                      ? Math.min(Math.round((item.realTotal / item.planned) * 100), 100)
                      : 0;

                  const bgClass = isKaffrine
                    ? isDarkMode
                      ? 'bg-amber-500/5 hover:bg-amber-500/10'
                      : 'bg-amber-50/50 hover:bg-amber-100/80'
                    : isTamba
                      ? isDarkMode
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'bg-emerald-50/50 hover:bg-emerald-100/80'
                      : isDarkMode
                        ? 'hover:bg-slate-800/30'
                        : 'hover:bg-indigo-50/30';

                  const borderClass = isKaffrine
                    ? 'border-l-4 border-l-amber-500'
                    : isTamba
                      ? 'border-l-4 border-l-emerald-500'
                      : isOver
                        ? 'border-l-4 border-l-rose-500'
                        : 'border-l-4 border-l-transparent';

                  return (
                    <tr key={item.id} className={`group transition-all ${bgClass} ${borderClass}`}>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteDevisItem(item.id)}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all"
                              title="Supprimer ce poste"
                            >
                              <Trash2 size={13} />
                            </button>
                            <span
                              className={`font-bold text-xs tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-700'}`}
                            >
                              {item.label}
                            </span>
                            {isOver && (
                              <span title="Depassement budgetaire">
                                <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pl-7">
                            <span
                              className={`text-xs font-black uppercase tracking-widest ${isKaffrine ? 'text-amber-500/80' : isTamba ? 'text-emerald-500/80' : 'text-slate-500 opacity-50'}`}
                            >
                              {item.region}
                            </span>
                            {/* Mini usage bar */}
                            <div
                              className={`flex-1 max-w-20 h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
                            >
                              <div
                                className={`h-full rounded-full transition-all devis-usage-bar ${isOver ? 'bg-rose-500' : usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ '--usage-pct': `${usagePct}%` } as React.CSSProperties}
                              />
                            </div>
                            <span
                              className={`text-xs font-bold ${isOver ? 'text-rose-400' : usagePct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}
                            >
                              {usagePct}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Devis - Inputs */}
                      <td
                        className={`px-4 py-5 transition-all ${isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50/10'}`}
                      >
                        <input
                          title={`Quantité prévue pour ${item.label}`}
                          type="number"
                          value={item.qty}
                          onChange={(e) =>
                            updatePlannedCost(item.id, 'qty', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full border p-2 rounded-xl text-right text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600'}`}
                        />
                      </td>
                      <td
                        className={`px-4 py-5 border-r transition-all ${isDarkMode ? 'bg-blue-500/5 border-slate-800/50' : 'bg-blue-50/10 border-slate-100'}`}
                      >
                        <input
                          title={`Prix unitaire prévu pour ${item.label}`}
                          type="number"
                          value={item.unit}
                          onChange={(e) =>
                            updatePlannedCost(item.id, 'unit', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full border p-2 rounded-xl text-right text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600'}`}
                        />
                      </td>

                      {/* Réel - Inputs */}
                      <td
                        className={`px-4 py-5 transition-all ${isDarkMode ? 'bg-indigo-500/5' : 'bg-indigo-50/10'}`}
                      >
                        <input
                          title={`Quantité réelle pour ${item.label}`}
                          type="number"
                          value={item.rq}
                          onChange={(e) =>
                            updateRealCost(item.id, 'qty', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full border p-2 rounded-xl text-right text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-600'}`}
                        />
                      </td>
                      <td
                        className={`px-4 py-5 border-r transition-all ${isDarkMode ? 'bg-indigo-500/5 border-slate-800/50' : 'bg-indigo-50/10 border-slate-100'}`}
                      >
                        <input
                          title={`Prix unitaire réel pour ${item.label}`}
                          type="number"
                          value={item.ru}
                          onChange={(e) =>
                            updateRealCost(item.id, 'unit', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full border p-2 rounded-xl text-right text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-600'}`}
                        />
                      </td>

                      {/* Marge */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-sm font-black tracking-tighter ${item.margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
                          >
                            {fmtFCFA(item.margin)}
                          </span>
                          <div className="flex items-center gap-1">
                            {item.margin >= 0 ? (
                              <CheckCircle2 size={10} className="text-emerald-500/50" />
                            ) : (
                              <AlertTriangle size={10} className="text-rose-500/50" />
                            )}
                            <span
                              className={`text-xs font-black uppercase tracking-widest ${item.margin >= 0 ? 'text-emerald-500/50' : 'text-rose-500/50'}`}
                            >
                              {item.margin >= 0 ? 'CONFORME' : 'DÉPASSEMENT'}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot
              className={`border-t-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
            >
              <tr className="font-black">
                <td
                  className={`px-6 py-6 tracking-widest text-xs uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  TOTAUX ({filtered.length} postes)
                </td>
                <td
                  colSpan={2}
                  className={`px-4 py-6 text-right border-r text-base tabular-nums tracking-tighter transition-all ${isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-slate-800' : 'text-indigo-600 bg-indigo-50/30 border-slate-100'}`}
                >
                  {fmtFCFA(filtered.reduce((s: number, i: any) => s + i.planned, 0))}
                </td>
                <td
                  colSpan={2}
                  className={`px-4 py-6 text-right border-r text-base tabular-nums tracking-tighter transition-all ${isDarkMode ? 'text-white bg-indigo-500/10 border-slate-800' : 'text-slate-900 bg-indigo-50/50 border-slate-100'}`}
                >
                  {fmtFCFA(filtered.reduce((s: number, i: any) => s + i.realTotal, 0))}
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-xl font-black tracking-tighter ${devis.globalMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                      {fmtFCFA(devis.globalMargin)}
                    </span>
                    <span
                      className={`text-xs font-black uppercase tracking-[0.2em] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                    >
                      Marge Reliquat
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Quick Add Form */}
      <div
        className={`p-4 border rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-4 transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <input
            id="new_devis_label"
            placeholder="Nouveau poste (ex: Installation Solaire)"
            title="Libellé du nouveau poste de dépense"
            className={`flex-1 text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white focus:ring-indigo-500/30' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-600/20'}`}
          />
          <select
            id="new_devis_region"
            title="Région du nouveau poste"
            className={`text-sm border rounded-xl px-3 py-2.5 focus:outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          >
            <option value="Global">Global</option>
            <option value="Kaffrine">Kaffrine</option>
            <option value="Tambacounda">Tambacounda</option>
          </select>
        </div>
        <button
          onClick={() => {
            const lbl = (document.getElementById('new_devis_label') as HTMLInputElement)?.value;
            const reg = (document.getElementById('new_devis_region') as HTMLSelectElement)?.value;
            if (lbl) {
              addDevisItem({ label: lbl, region: reg || 'Global', qty: 1, unit: 0 });
              (document.getElementById('new_devis_label') as HTMLInputElement).value = '';
            }
          }}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all active:scale-95"
        >
          <Plus size={13} />
          <span>AJOUTER UN POSTE</span>
        </button>
      </div>
    </div>
  );
}
