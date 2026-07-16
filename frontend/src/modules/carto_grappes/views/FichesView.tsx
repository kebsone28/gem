import React, { useState, useCallback, useMemo } from 'react';
import type { FicheDef, FicheEntry, FicheFieldDef, Menage } from '../types';
import { FICHE_DEFS, FICHE_LEVEL_LABELS, FICHE_LEVEL_COLORS, REGIONS, GRAPPE_COUNT } from '../constants';
import * as api from '../hooks/carto_grappes.service';
import { generateFicheDocx } from '../engine/docxEngine';

interface FichesViewProps {
  menages: Menage[];
}

function getGrappeOptions(region: string): string[] {
  const count = GRAPPE_COUNT[region] || 1;
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

const LEVEL_BG: Record<number, string> = {
  1: 'bg-blue-50 border-blue-200',
  2: 'bg-yellow-50 border-yellow-200',
  3: 'bg-green-50 border-green-200',
};

const OBS_KEYS = new Set(['observations', 'observation', 'actionCorrective']);

const FichesView: React.FC<FichesViewProps> = React.memo(({ menages }) => {
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [activeFiche, setActiveFiche] = useState<FicheDef | null>(null);
  const [entries, setEntries] = useState<FicheEntry[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saveFeedback, setSaveFeedback] = useState(false);

  const visibleFiches = useMemo(() =>
    FICHE_DEFS.filter(f => f.level === activeLevel),
    [activeLevel],
  );

  const levelBg = activeFiche ? (LEVEL_BG[activeFiche.level] || 'bg-white border-slate-200') : '';

  const loadEntries = useCallback(async (ficheKey: string) => {
    try {
      const data = await api.fetchFiches(ficheKey);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    }
  }, []);

  const selectFiche = useCallback(async (fiche: FicheDef) => {
    setActiveFiche(fiche);
    setFormData({});
    await loadEntries(fiche.id);
  }, [loadEntries]);

  const updateField = useCallback((key: string, value: unknown) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'grappe' && activeFiche) {
        const region = next.region as string;
        const grappe = Number(value);
        const matchingMenages = menages.filter(m => m.region === region && m.grappe === grappe);
        if (activeFiche.id === 'F03') next.murPrevus = matchingMenages.length;
        if (activeFiche.id === 'F10') { next.menagesPrevus = matchingMenages.length; }
      }
      if (key === 'coffretsJour' || key === 'rejets' || key === 'reprises') {
        const jour = Number(next.coffretsJour) || 0;
        const rej = Number(next.rejets) || 0;
        const rep = Number(next.reprises) || 0;
        const prevCumul = entries.reduce((s, e) => s + (Number(e.data.coffretsJour) || 0), 0);
        next.cumul = prevCumul + jour - rej;
        next.stockRestant = (prevCumul + jour) - rej - rep;
      }
      if (key === 'coffretsControles' || key === 'nc') {
        const ctrl = Number(next.coffretsControles) || 0;
        const nc = Number(next.nc) || 0;
        next.tauxNc = ctrl > 0 ? Math.round((nc / ctrl) * 1000) / 10 : 0;
      }
      return next;
    });
  }, [activeFiche, entries, menages]);

  const saveEntry = useCallback(async () => {
    if (!activeFiche) return;
    const hasRegion = activeFiche.fields.some(f => f.key === 'region');
    const hasGrappe = activeFiche.fields.some(f => f.key === 'grappe');

    if (hasRegion && !formData.region) {
      alert('Veuillez sélectionner une région.');
      return;
    }
    if (hasGrappe && !formData.grappe) {
      alert('Veuillez sélectionner une grappe.');
      return;
    }
    try {
      await api.addFicheEntry(activeFiche.id, formData);
      setFormData({});
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2500);
      await loadEntries(activeFiche.id);
    } catch {
      alert('Erreur lors de la sauvegarde');
    }
  }, [activeFiche, formData, loadEntries]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!confirm('Supprimer cet enregistrement ?')) return;
    if (!activeFiche) return;
    try {
      await api.deleteFicheEntry(entryId);
      await loadEntries(activeFiche.id);
    } catch { /* ignore */ }
  }, [activeFiche, loadEntries]);

  const cumulativeSums = useMemo(() => {
    if (!activeFiche || entries.length === 0) return {};
    const numericFields = activeFiche.fields.filter(f => f.type === 'number' && !f.readonly);
    const sums: Record<string, number> = {};
    for (const field of numericFields) {
      let total = 0;
      for (const entry of entries) {
        const v = Number(entry.data[field.key]);
        if (!isNaN(v)) total += v;
      }
      sums[field.key] = total;
    }
    return sums;
  }, [activeFiche, entries]);

  const showFields = useMemo(() =>
    activeFiche ? activeFiche.fields.filter(f => !OBS_KEYS.has(f.key)) : [],
    [activeFiche],
  );

  const handleExportWord = useCallback((entry: FicheEntry, idx: number) => {
    if (!activeFiche) return;
    generateFicheDocx(activeFiche, entry, idx);
  }, [activeFiche]);

  const handleExportWordFromForm = useCallback(() => {
    if (!activeFiche) return;
    const fakeEntry: FicheEntry = { id: '', ficheKey: activeFiche.id, data: formData };
    generateFicheDocx(activeFiche, fakeEntry, 0);
  }, [activeFiche, formData]);

  const handleExportBlank = useCallback(() => {
    if (!activeFiche) return;
    generateFicheDocx(activeFiche, { id: '', ficheKey: activeFiche.id, data: {} }, 0);
  }, [activeFiche]);

  const renderField = (field: FicheFieldDef) => {
    const value = formData[field.key] ?? '';

    if (field.type === 'region') {
      return (
        <select
          key={field.key}
          value={value as string}
          onChange={e => updateField(field.key, e.target.value)}
          className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">— Région —</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      );
    }
    if (field.type === 'grappe') {
      const region = (formData.region as string) || '';
      const options = region ? getGrappeOptions(region) : [];
      return (
        <select
          key={field.key}
          value={value as string}
          onChange={e => updateField(field.key, e.target.value)}
          className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">— Grappe —</option>
          {options.map(g => <option key={g} value={g}>Grappe {g}</option>)}
        </select>
      );
    }
    if (field.type === 'select' && field.options) {
      return (
        <select
          key={field.key}
          value={value as string}
          onChange={e => updateField(field.key, e.target.value)}
          className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">—</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (field.type === 'textarea') {
      return (
        <textarea
          key={field.key}
          value={value as string}
          onChange={e => updateField(field.key, e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      );
    }
    return (
      <input
        key={field.key}
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={value as string}
        onChange={e => updateField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
        disabled={field.readonly}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Fiches de Suivi</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Niveau 1 = Production par grappe (prestataire) · Niveau 2 = Fiches quantitatives par activité · Niveau 3 = Qualité, réception & facturation
        </p>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4 overflow-x-auto">
          {[1, 2, 3].map(level => (
            <button
              key={level}
              onClick={() => { setActiveLevel(level); setActiveFiche(null); setFormData({}); }}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                activeLevel === level
                  ? `${FICHE_LEVEL_COLORS[level]} text-white shadow-sm`
                  : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              {FICHE_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>

        {!activeFiche ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFiches.map(fiche => (
              <button
                key={fiche.id}
                onClick={() => selectFiche(fiche)}
                className={`text-left border rounded-xl p-4 hover:shadow-md transition-all ${LEVEL_BG[fiche.level] || 'border-slate-200'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-blue-700">{fiche.id}</span>
                  {fiche.lot && (
                    <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                      Lot {fiche.lot}
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-900 mb-1">{fiche.title}</div>
                <div className="text-xs text-slate-500 mb-2">{fiche.purpose.slice(0, 80)}…</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{fiche.period}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    fiche.fillByTag === 'presta' ? 'bg-blue-100 text-blue-800' :
                    fiche.fillByTag === 'ctrl' ? 'bg-purple-100 text-purple-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {fiche.fillBy}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <button
              onClick={() => { setActiveFiche(null); setFormData({}); }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              ← Retour aux fiches
            </button>

            <div className={`rounded-xl p-4 ${levelBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-bold text-blue-700">{activeFiche.id}</span>
                <span className="text-base font-bold text-slate-900">{activeFiche.title}</span>
              </div>
              <p className="text-sm text-slate-600">{activeFiche.purpose}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <form id="fiche-form" onSubmit={e => { e.preventDefault(); saveEntry(); }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeFiche.fields.map(field => (
                    <div key={field.key} className={field.full ? 'sm:col-span-2 lg:col-span-3' : ''}>
                      <label className="text-xs font-semibold text-slate-600 uppercase">{field.label}</label>
                      <div className="mt-1">{renderField(field)}</div>
                    </div>
                  ))}
                </div>
              </form>
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  onClick={saveEntry}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Enregistrer
                </button>
                {saveFeedback && (
                  <span className="text-sm font-semibold text-green-600 animate-pulse">Enregistré !</span>
                )}
                <button
                  onClick={handleExportWordFromForm}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Télécharger Word
                </button>
                <button
                  onClick={handleExportBlank}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-300 text-slate-700 rounded-lg hover:border-blue-500 hover:text-blue-700 transition-colors bg-white"
                >
                  Modèle Word vierge
                </button>
              </div>
            </div>

            {entries.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[450px]">
                <h4 className="px-4 pt-4 text-sm font-bold text-slate-800">Enregistrements ({entries.length})</h4>
                <table className="w-full text-sm border-collapse mt-2">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      {showFields.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold">{f.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-semibold">Saisi par</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => (
                      <tr key={entry.id || i} className={`border-t border-slate-100 ${LEVEL_BG[activeFiche.level] || ''} hover:bg-slate-50/50`}>
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        {showFields.map(f => (
                          <td key={f.key} className="px-3 py-2 text-slate-700">{String(entry.data[f.key] ?? '—')}</td>
                        ))}
                        <td className="px-3 py-2 text-xs text-slate-500 font-semibold">{entry.author || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{entry.createdAt || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleExportWord(entry, i)}
                              className="px-2 py-1 text-xs font-semibold border border-slate-300 text-slate-700 rounded hover:border-blue-500 hover:text-blue-700 transition-colors bg-white"
                            >
                              Word
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                            >
                              Suppr
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {Object.keys(cumulativeSums).length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td className="px-3 py-2 text-slate-700">Σ</td>
                        {showFields.map(f => (
                          <td key={f.key} className="px-3 py-2 text-slate-800">
                            {cumulativeSums[f.key] != null ? String(cumulativeSums[f.key]) : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
});

FichesView.displayName = 'FichesView';
export default FichesView;
