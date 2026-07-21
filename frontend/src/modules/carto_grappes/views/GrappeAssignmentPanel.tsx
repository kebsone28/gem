/**
 * GrappeAssignmentPanel.tsx — Affectation prestataires / grappes / lots.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  LotKey,
  EntrepreneurConfig,
  EntrepreneurData,
  EntrepreneurGroup,
  GrappeSummary,
  Prestataire,
} from '../types';
import { LOT_KEYS, GRAPPE_COLORS, getGrappeColorKey } from '../constants';

const I = {
  // Unicode icons (Vite-safe escape sequences)
  search: '\u{1F50D}',
  check: '\u{2713}',
  close: '\u{2715}',
  map: '\u{1F5FA}',
  wrench: '\u{1F527}',
  bolt: '\u{26A1}',
  plug: '\u{1F50C}',
  sat: '\u{1F4E1}',
  save: '\u{1F4BE}',
  done: '\u{2705}',
  cab: '\u{1F5C4}',
  dot: '\u{00B7}',
  ellipsis: '\u{2026}',
  dash: '\u{2014}',
  circ1: '\u{2460}',
  circ2: '\u{2461}',
} as const;

interface GrappeAssignmentPanelProps {
  regionGrappes: GrappeSummary[];
  entrepreneurConfig: EntrepreneurConfig;
  onUpdateConfig: (config: EntrepreneurConfig) => void;
  onSyncToAPI?: () => Promise<void>;
  initialGrappeKey?: string | null;
  initialLot?: LotKey;
  prestataires?: Prestataire[];
  onClose: () => void;
}

interface Row {
  entreprise: string;
  societe: string;
  telephone: string;
  email: string;
  adresse: string;
}
const EMPTY: Row = { entreprise: '', societe: '', telephone: '', email: '', adresse: '' };
const LOT_META: Record<LotKey, { color: string; bg: string; icon: string; desc: string }> = {
  A: { color: 'text-blue-700', bg: 'bg-blue-50', icon: I.wrench, desc: 'Precablage & coffrets' },
  B: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    icon: I.bolt,
    desc: 'Installation interieure',
  },
  C: { color: 'text-violet-700', bg: 'bg-violet-50', icon: I.plug, desc: 'Raccordement abonnes' },
};

const grappeColor = (k: string) => GRAPPE_COLORS[getGrappeColorKey(k)] || '#5A6672';

function extractKnown(cfg: EntrepreneurConfig): EntrepreneurData[] {
  const seen = new Set<string>();
  const out: EntrepreneurData[] = [];
  for (const lot of LOT_KEYS) {
    const c = cfg[lot] || {};
    const add = (d: EntrepreneurData | undefined | null) => {
      if (!d?.entreprise) return;
      const k = `${d.entreprise}|${d.telephone}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(d);
      }
    };
    if (c.__global) add(c.__global as EntrepreneurData);
    if (c.__groupes) for (const g of c.__groupes as EntrepreneurGroup[]) add(g);
    for (const [k, v] of Object.entries(c)) if (!k.startsWith('__')) add(v as EntrepreneurData);
  }
  return out;
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

const Autocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}> = ({ value, onChange, suggestions, placeholder }) => {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () =>
      suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
        .slice(0, 6),
    [suggestions, value]
  );
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {filtered.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => {
                onChange(s);
                setOpen(false);
              }}
              className="px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const GrappeAssignmentPanel: React.FC<GrappeAssignmentPanelProps> = ({
  regionGrappes,
  entrepreneurConfig,
  onUpdateConfig,
  onSyncToAPI,
  initialGrappeKey,
  initialLot,
  prestataires = [],
  onClose,
}) => {
  const [sel, setSel] = useState<Set<string>>(
    () => new Set(initialGrappeKey ? [initialGrappeKey] : [])
  );
  const [lot, setLot] = useState<LotKey>(initialLot || 'A');
  const [rows, setRows] = useState<Record<LotKey, Row>>({
    A: { ...EMPTY },
    B: { ...EMPTY },
    C: { ...EMPTY },
  });
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  // Merged prestataires (DB + config)
  const allP = useMemo(() => {
    const m = new Map<string, EntrepreneurData>();
    extractKnown(entrepreneurConfig).forEach((p) => {
      if (p.entreprise) m.set(p.entreprise, p);
    });
    prestataires.forEach((p) => {
      const e = p.entreprise || p.nom || '';
      if (e)
        m.set(e, {
          entreprise: e,
          societe: p.societe || '',
          telephone: p.telephone || '',
          email: p.email || '',
          adresse: p.adresse || '',
        });
    });
    return Array.from(m.values());
  }, [entrepreneurConfig, prestataires]);

  const suggestions = useMemo(() => allP.map((p) => p.entreprise).filter(Boolean), [allP]);

  const fillEntreprise = useCallback(
    (l: LotKey, val: string) => {
      setRows((prev) => {
        const f = allP.find((p) => p.entreprise === val);
        return {
          ...prev,
          [l]: {
            entreprise: val,
            societe: f?.societe || prev[l].societe,
            telephone: f?.telephone || prev[l].telephone,
            email: f?.email || prev[l].email,
            adresse: f?.adresse || prev[l].adresse,
          },
        };
      });
    },
    [allP]
  );

  // Load existing on pre-select
  useEffect(() => {
    if (!initialGrappeKey) return;
    for (const l of LOT_KEYS) {
      const ex = (entrepreneurConfig[l] || {})[initialGrappeKey] as EntrepreneurData | undefined;
      if (ex?.entreprise)
        setRows((prev) => ({
          ...prev,
          [l]: {
            entreprise: ex.entreprise || '',
            societe: ex.societe || '',
            telephone: ex.telephone || '',
            email: ex.email || '',
            adresse: ex.adresse || '',
          },
        }));
    }
  }, [initialGrappeKey, entrepreneurConfig]);

  const toggle = useCallback((k: string) => {
    setSel((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
    setApplied(false);
  }, []);

  const filtered = useMemo(
    () =>
      regionGrappes.filter(
        (g) => g.total > 0 && (!search || g.key.toLowerCase().includes(search.toLowerCase()))
      ),
    [regionGrappes, search]
  );

  const updField = useCallback(
    (l: LotKey, field: keyof Row, val: string) => {
      if (field === 'entreprise') fillEntreprise(l, val);
      else setRows((prev) => ({ ...prev, [l]: { ...prev[l], [field]: val } }));
      setApplied(false);
    },
    [fillEntreprise]
  );

  const clearL = useCallback((l: LotKey) => {
    setRows((prev) => ({ ...prev, [l]: { ...EMPTY } }));
    setApplied(false);
  }, []);

  const handleApply = useCallback(async () => {
    if (sel.size === 0) return;
    setApplying(true);
    try {
      const c: EntrepreneurConfig = {
        A: { ...entrepreneurConfig.A },
        B: { ...entrepreneurConfig.B },
        C: { ...entrepreneurConfig.C },
      };
      for (const gk of sel)
        for (const l of LOT_KEYS) {
          const { entreprise: s, societe, telephone, email, adresse } = rows[l];
          if (!s.trim()) continue;
          c[l] = { ...c[l], [gk]: { entreprise: s, societe, telephone, email, adresse } };
        }
      onUpdateConfig(c);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }, [sel, rows, entrepreneurConfig, onUpdateConfig]);

  const handleSync = useCallback(async () => {
    if (!onSyncToAPI) return;
    setSyncing(true);
    try {
      await onSyncToAPI();
    } finally {
      setSyncing(false);
    }
  }, [onSyncToAPI]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const cnt = sel.size;
  const hasA = LOT_KEYS.some((l) => rows[l].entreprise.trim() !== '');

  // ─── Render ────────────────────────────────────────────────────────────────

  const Step = ({
    n,
    label,
    done,
    emerald,
  }: {
    n: number;
    label: string;
    done: boolean;
    emerald?: boolean;
  }) => (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? (emerald ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white') : 'bg-slate-200 text-slate-500'}`}
      >
        {done ? I.check : n}
      </div>
      <span
        className={
          done
            ? emerald
              ? 'font-semibold text-emerald-700'
              : 'font-semibold text-blue-700'
            : 'text-slate-400'
        }
      >
        {label}
      </span>
    </div>
  );

  const Input = ({
    lbl,
    type,
    val,
    ph,
    onChange,
  }: {
    lbl: string;
    type?: string;
    val: string;
    ph?: string;
    onChange: (v: string) => void;
  }) => (
    <div>
      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
        {lbl}
      </label>
      <input
        type={type || 'text'}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
      />
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ borderLeft: '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-lg">
              {I.map}
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                Affectation Prestataires
              </h2>
              <p className="text-blue-200/70 text-[11px] mt-0.5">
                Selectionnez des grappes et assignez les entrepreneurs par lot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            {I.close}
          </button>
        </div>

        {/* Steps */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-6 text-xs flex-shrink-0">
          <Step n={1} label="Selection grappes" done={cnt > 0} />
          <div className="flex-1 h-px bg-slate-200" />
          <Step n={2} label="Saisie prestataires" done={hasA} />
          <div className="flex-1 h-px bg-slate-200" />
          <Step n={3} label="Enregistrement" done={applied} emerald />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Grappe selection */}
          <section className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {I.circ1} Selectionner les grappes
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cnt === 0
                    ? 'Aucune grappe selectionnee'
                    : `${cnt} grappe${cnt > 1 ? 's' : ''} selectionnee${cnt > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSel(new Set(filtered.map((g) => g.key)));
                    setApplied(false);
                  }}
                  className="px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  Tout selectionner
                </button>
                <button
                  onClick={() => {
                    setSel(new Set());
                    setApplied(false);
                  }}
                  className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Vider
                </button>
              </div>
            </div>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                {I.search}
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer les grappes..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {filtered.map((g) => {
                const isSel = sel.has(g.key),
                  c = grappeColor(g.key);
                const hasP = LOT_KEYS.some(
                  (l) => !!(entrepreneurConfig[l]?.[g.key] as EntrepreneurData)?.entreprise
                );
                return (
                  <button
                    key={g.key}
                    onClick={() => toggle(g.key)}
                    className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-150 overflow-hidden ${
                      isSel
                        ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-100 scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                      style={{ background: c }}
                    />
                    <div className="flex items-center gap-2 mb-2 mt-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: c }}
                      />
                      <span
                        className={`text-[11px] font-bold ${isSel ? 'text-blue-800' : 'text-slate-700'}`}
                      >
                        {g.key.replace('_', ' G')}
                      </span>
                      {isSel && <span className="ml-auto text-blue-600 text-xs">{I.check}</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 mb-2">
                      {g.total} menages {I.dot} {g.pct}%
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${g.pct}%`, background: c }}
                      />
                    </div>
                    {hasP && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center text-[9px] text-emerald-600">
                        {I.check}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Lot tabs + form */}
          <section className="px-6 py-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              {I.circ2} Saisir les prestataires par lot
            </h3>

            {/* Tabs */}
            <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
              {(LOT_KEYS as LotKey[]).map((l) => {
                const m = LOT_META[l],
                  active = lot === l,
                  filled = rows[l].entreprise.trim() !== '';
                return (
                  <button
                    key={l}
                    onClick={() => setLot(l)}
                    className={`flex-1 flex flex-col items-center py-3 px-2 rounded-lg transition-all duration-200 ${active ? 'bg-white shadow-md' : 'hover:bg-white/50'}`}
                  >
                    <span className="text-xl mb-1">{m.icon}</span>
                    <span
                      className={`text-[11px] font-bold ${active ? m.color : 'text-slate-500'}`}
                    >
                      Lot {l}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">
                      {m.desc}
                    </span>
                    {filled && (
                      <span className="mt-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">
                        {I.check} Assigne
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Form for active lot */}
            {(() => {
              const m = LOT_META[lot],
                d = rows[lot];
              return (
                <div
                  className={`rounded-2xl border-2 ${m.bg} p-5 space-y-4`}
                  style={{ borderColor: 'transparent' }}
                >
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${m.bg} ${m.color} text-xs font-bold mb-2`}
                  >
                    {m.icon} Lot {lot} {I.dash} {m.desc}
                  </div>

                  {prestataires.length > 0 && (
                    <div className="p-3 bg-white/70 rounded-xl border border-white shadow-sm">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                        {I.cab} Choisir depuis la base prestataires
                      </label>
                      <select
                        value=""
                        onChange={(e) => {
                          const f = prestataires.find((p) => p.id === e.target.value);
                          if (f) {
                            setRows((prev) => ({
                              ...prev,
                              [lot]: {
                                entreprise: f.entreprise || '',
                                societe: f.societe || '',
                                telephone: f.telephone || '',
                                email: f.email || '',
                                adresse: f.adresse || '',
                              },
                            }));
                            setApplied(false);
                          }
                        }}
                        className="w-full px-3 py-2.5 text-xs border-2 border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 font-semibold text-slate-700 cursor-pointer hover:border-blue-300 transition-colors"
                      >
                        <option value="">
                          {I.dash} Selectionner un prestataire {I.dash}
                        </option>
                        {prestataires.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.entreprise}
                            {p.societe ? ` (${p.societe})` : ''}
                            {p.telephone ? ` ${I.dot} ${p.telephone}` : ''}
                          </option>
                        ))}
                      </select>
                      {d.entreprise && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <span className="text-emerald-500 text-sm">{I.check}</span>
                          <span className="text-xs font-semibold text-emerald-700">
                            {d.entreprise}
                          </span>
                          <button
                            onClick={() => clearL(lot)}
                            className="ml-auto text-emerald-400 hover:text-rose-500 transition-colors text-xs"
                          >
                            {I.close}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Ou saisir manuellement *
                      </label>
                      <Autocomplete
                        value={d.entreprise}
                        onChange={(v) => updField(lot, 'entreprise', v)}
                        suggestions={suggestions}
                        placeholder="Nom de l'entrepreneur..."
                      />
                    </div>
                    <Input
                      lbl="Societe"
                      val={d.societe}
                      onChange={(v) => updField(lot, 'societe', v)}
                      ph="Nom du responsable"
                    />
                    <Input
                      lbl="Telephone"
                      type="tel"
                      val={d.telephone}
                      onChange={(v) => updField(lot, 'telephone', v)}
                      ph="+221 XX XXX XX XX"
                    />
                    <Input
                      lbl="Email"
                      type="email"
                      val={d.email}
                      onChange={(v) => updField(lot, 'email', v)}
                      ph="email@exemple.com"
                    />
                    <Input
                      lbl="Adresse"
                      val={d.adresse}
                      onChange={(v) => updField(lot, 'adresse', v)}
                      ph="Adresse du prestataire"
                    />
                  </div>

                  {allP.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Copier depuis un prestataire existant
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allP.slice(0, 5).map((p, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setRows((prev) => ({ ...prev, [lot]: { ...p } as Row }));
                              setApplied(false);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                              {p.entreprise.charAt(0).toUpperCase()}
                            </span>
                            {p.entreprise.substring(0, 18)}
                            {p.entreprise.length > 18 ? I.ellipsis : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Preview */}
            {cnt > 0 && (
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Apercu {I.dash} sera applique a {cnt} grappe{cnt > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...sel].map((k) => {
                    const g = regionGrappes.find((gr) => gr.key === k);
                    return (
                      <span
                        key={k}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-700 shadow-sm"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: grappeColor(k) }}
                        />
                        {k.replace('_', ' G')}
                        {g && (
                          <span className="text-slate-400 font-normal">
                            {I.dot}
                            {g.total}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
          <div className="flex items-center gap-3">
            {applied && onSyncToAPI && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                {syncing ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  I.sat
                )}{' '}
                Sync API
              </button>
            )}
            <button
              onClick={handleApply}
              disabled={applying || cnt === 0 || !hasA}
              className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                applied
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-md'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {applying ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : applied ? (
                I.done
              ) : (
                I.save
              )}
              {applied ? 'Enregistre !' : `Appliquer a ${cnt} grappe${cnt > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

GrappeAssignmentPanel.displayName = 'GrappeAssignmentPanel';
export default GrappeAssignmentPanel;
