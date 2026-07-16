/**
 * GrappeAssignmentPanel.tsx
 * Panneau premium d'affectation de prestataires à des grappes sélectionnées sur la carte.
 * Fonctionnalités :
 *  - Sélection multi-grappe interactive sur la carte SVG
 *  - Attribution Lot A / B / C par grappe ou en masse
 *  - Auto-complétion à partir des prestataires existants dans entrepreneurConfig
 *  - Sauvegarde instantanée dans entrepreneurConfig + sync API optionnel
 */

import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import type {
  LotKey, EntrepreneurConfig, EntrepreneurData, GrappeSummary, Prestataire,
} from '../types';
import { LOT_KEYS, GRAPPE_COLORS } from '../constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrappeAssignmentPanelProps {
  /** Toutes les grappes disponibles avec leur résumé statistique */
  regionGrappes: GrappeSummary[];
  /** Configuration prestataire courante */
  entrepreneurConfig: EntrepreneurConfig;
  /** Callback de sauvegarde — reçoit la config mise à jour */
  onUpdateConfig: (config: EntrepreneurConfig) => void;
  /** Sync optionnel vers API */
  onSyncToAPI?: () => Promise<void>;
  /** Grappe pré-sélectionnée (depuis la carte) */
  initialGrappeKey?: string | null;
  /** Lot pré-sélectionné (depuis la carte GPS) */
  initialLot?: LotKey;
  /** Liste des prestataires enregistrés */
  prestataires?: Prestataire[];
  /** Fermeture du panneau */
  onClose: () => void;
}

interface AssignmentRow {
  lot: LotKey;
  entreprise: string;
  societe: string;
  telephone: string;
  email: string;
  adresse: string;
}

const LOT_META: Record<LotKey, { label: string; color: string; bg: string; ring: string; icon: string; desc: string }> = {
  A: { label: 'Lot A', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-400', icon: '🔧', desc: 'Pré-câblage & coffrets' },
  B: { label: 'Lot B', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-400', icon: '⚡', desc: 'Installation intérieure' },
  C: { label: 'Lot C', color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-400', icon: '🔌', desc: 'Raccordement abonnés' },
};

const EMPTY_ENT: AssignmentRow = {
  lot: 'A', entreprise: '', societe: '', telephone: '', email: '', adresse: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractKnownPrestataires(config: EntrepreneurConfig): EntrepreneurData[] {
  const seen = new Set<string>();
  const result: EntrepreneurData[] = [];
  for (const lot of LOT_KEYS) {
    const cfg = config[lot] || {};
    const add = (d: EntrepreneurData | undefined | null) => {
      if (!d?.entreprise) return;
      const key = `${d.entreprise}|${d.telephone}`;
      if (!seen.has(key)) { seen.add(key); result.push(d); }
    };
    if (cfg.__global) add(cfg.__global as EntrepreneurData);
    if (cfg.__groupes) {
      for (const g of (cfg.__groupes as any[])) add(g);
    }
    for (const [k, v] of Object.entries(cfg)) {
      if (!k.startsWith('__')) add(v as EntrepreneurData);
    }
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const LotBadge: React.FC<{ lot: LotKey; active: boolean; onClick: () => void }> = ({ lot, active, onClick }) => {
  const m = LOT_META[lot];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
        active
          ? `${m.bg} ${m.color} border-current shadow-sm scale-105`
          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
      }`}
    >
      <span>{m.icon}</span>
      {m.label}
    </button>
  );
};

interface AutocompleteInputProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value, onChange, suggestions, placeholder = '', className = '',
}) => {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () => suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value).slice(0, 6),
    [suggestions, value],
  );
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors ${className}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {filtered.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => { onChange(s); setOpen(false); }}
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

// ─── Main Component ───────────────────────────────────────────────────────────

const GrappeAssignmentPanel: React.FC<GrappeAssignmentPanelProps> = ({
  regionGrappes, entrepreneurConfig, onUpdateConfig, onSyncToAPI, initialGrappeKey, initialLot, prestataires = [], onClose,
}) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedGrappes, setSelectedGrappes] = useState<Set<string>>(
    () => new Set(initialGrappeKey ? [initialGrappeKey] : []),
  );
  const [activeLot, setActiveLot] = useState<LotKey>(initialLot || 'A');
  const [assignments, setAssignments] = useState<Record<LotKey, Omit<AssignmentRow, 'lot'>>>({
    A: { entreprise: '', societe: '', telephone: '', email: '', adresse: '' },
    B: { entreprise: '', societe: '', telephone: '', email: '', adresse: '' },
    C: { entreprise: '', societe: '', telephone: '', email: '', adresse: '' },
  });
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchGrappe, setSearchGrappe] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Known prestataires for autocomplete ────────────────────────────────────
  const knownPrestataires = useMemo(() => extractKnownPrestataires(entrepreneurConfig), [entrepreneurConfig]);
  
  // Include prestataires from database in suggestions
  const dbPrestataires = useMemo(() => prestataires.map(p => ({
    entreprise: p.entreprise || p.nom || '',
    societe: p.societe || '',
    telephone: p.telephone || '',
    email: p.email || '',
    adresse: p.adresse || '',
  })), [prestataires]);
  
  const allPrestataires = useMemo(() => {
    const map = new Map<string, EntrepreneurData>();
    // Add known prestataires from config
    knownPrestataires.forEach(p => {
      if (p.entreprise) map.set(p.entreprise, p);
    });
    // Add database prestataires (override if exists)
    dbPrestataires.forEach(p => {
      if (p.entreprise) map.set(p.entreprise, p);
    });
    return Array.from(map.values());
  }, [knownPrestataires, dbPrestataires]);
  
  const entrepriseSuggestions = useMemo(() => allPrestataires.map(p => p.entreprise).filter(Boolean), [allPrestataires]);

  // Auto-fill from known prestataires when entreprise is selected
  const handleEntrepriseChange = useCallback((lot: LotKey, val: string) => {
    setAssignments(prev => {
      const found = allPrestataires.find(p => p.entreprise === val);
      return {
        ...prev,
        [lot]: {
          entreprise: val,
          societe: found?.societe || prev[lot].societe,
          telephone: found?.telephone || prev[lot].telephone,
          email: found?.email || prev[lot].email,
          adresse: found?.adresse || prev[lot].adresse,
        },
      };
    });
  }, [allPrestataires]);

  // Load current prestataire for first selected grappe
  useEffect(() => {
    if (!initialGrappeKey) return;
    for (const lot of LOT_KEYS) {
      const existing = (entrepreneurConfig[lot] || {})[initialGrappeKey] as EntrepreneurData | undefined;
      if (existing?.entreprise) {
        setAssignments(prev => ({
          ...prev,
          [lot]: {
            entreprise: existing.entreprise || '',
            societe: existing.societe || '',
            telephone: existing.telephone || '',
            email: existing.email || '',
            adresse: existing.adresse || '',
          },
        }));
      }
    }
  }, [initialGrappeKey, entrepreneurConfig]);

  // ── Grappe selection ───────────────────────────────────────────────────────
  const toggleGrappe = useCallback((key: string) => {
    setSelectedGrappes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setApplied(false);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedGrappes(new Set(regionGrappes.filter(g => g.total > 0).map(g => g.key)));
    setApplied(false);
  }, [regionGrappes]);

  const clearAll = useCallback(() => {
    setSelectedGrappes(new Set());
    setApplied(false);
  }, []);

  // ── Apply assignments ──────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    if (selectedGrappes.size === 0) return;
    setApplying(true);
    try {
      const newConfig: EntrepreneurConfig = {
        A: { ...entrepreneurConfig.A },
        B: { ...entrepreneurConfig.B },
        C: { ...entrepreneurConfig.C },
      };
      for (const grappeKey of selectedGrappes) {
        for (const lot of LOT_KEYS) {
          const { entreprise, societe, telephone, email, adresse } = assignments[lot];
          if (!entreprise.trim()) continue; // Skip empty
          newConfig[lot] = {
            ...newConfig[lot],
            [grappeKey]: { entreprise, societe, telephone, email, adresse },
          };
        }
      }
      onUpdateConfig(newConfig);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }, [selectedGrappes, assignments, entrepreneurConfig, onUpdateConfig]);

  const handleSync = useCallback(async () => {
    if (!onSyncToAPI) return;
    setSyncing(true);
    try {
      await onSyncToAPI();
    } finally {
      setSyncing(false);
    }
  }, [onSyncToAPI]);

  // ── Filtered grappes ───────────────────────────────────────────────────────
  const filteredGrappes = useMemo(() =>
    regionGrappes.filter(g =>
      g.total > 0 &&
      (searchGrappe === '' || g.key.toLowerCase().includes(searchGrappe.toLowerCase()))
    ),
    [regionGrappes, searchGrappe],
  );

  const selectedCount = selectedGrappes.size;
  const hasAssignment = LOT_KEYS.some(l => assignments[l].entreprise.trim() !== '');

  // ── Keyboard close ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ borderLeft: '1px solid #e2e8f0' }}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-lg">🗺</div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">Affectation Prestataires</h2>
                <p className="text-blue-200/70 text-[11px] mt-0.5">Sélectionnez des grappes et assignez les entrepreneurs par lot</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        {/* ── Progress indicator ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-6 text-xs flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
            <span className={selectedCount > 0 ? 'font-semibold text-blue-700' : 'text-slate-400'}>Sélection grappes</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${hasAssignment ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
            <span className={hasAssignment ? 'font-semibold text-blue-700' : 'text-slate-400'}>Saisie prestataires</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${applied ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
            <span className={applied ? 'font-semibold text-emerald-700' : 'text-slate-400'}>Enregistrement</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── Section 1: Grappe Selection ── */}
          <section className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">① Sélectionner les grappes</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedCount === 0 ? 'Aucune grappe sélectionnée' : `${selectedCount} grappe${selectedCount > 1 ? 's' : ''} sélectionnée${selectedCount > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  Tout sélectionner
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Vider
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchGrappe}
                onChange={e => setSearchGrappe(e.target.value)}
                placeholder="Filtrer les grappes..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
              />
            </div>

            {/* Grappe grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {filteredGrappes.map(g => {
                const isSelected = selectedGrappes.has(g.key);
                const color = GRAPPE_COLORS[g.key] || '#5A6672';
                const pct = g.pct;
                const hasPresta = LOT_KEYS.some(l => !!(entrepreneurConfig[l]?.[g.key] as EntrepreneurData)?.entreprise);
                return (
                  <button
                    key={g.key}
                    onClick={() => toggleGrappe(g.key)}
                    className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-150 group overflow-hidden ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-100 scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Color accent */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                      style={{ background: color }}
                    />
                    <div className="flex items-center gap-2 mb-2 mt-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                        {g.key.replace('_', ' G')}
                      </span>
                      {isSelected && (
                        <span className="ml-auto text-blue-600 text-xs">✓</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mb-2">{g.total} ménages · {pct}%</div>

                    {/* Progress bar */}
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>

                    {/* Prestataire badge */}
                    {hasPresta && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center text-[9px] text-emerald-600">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Section 2: Lot Tabs + Assignment Forms ── */}
          <section className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">② Saisir les prestataires par lot</h3>
                <p className="text-xs text-slate-400 mt-0.5">Choisissez le lot puis saisissez les informations du prestataire</p>
              </div>
            </div>

            {/* Lot selector */}
            <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
              {LOT_KEYS.map(lot => {
                const m = LOT_META[lot];
                const isActive = activeLot === lot;
                const filled = assignments[lot].entreprise.trim() !== '';
                return (
                  <button
                    key={lot}
                    onClick={() => setActiveLot(lot)}
                    className={`flex-1 flex flex-col items-center py-3 px-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-md'
                        : 'hover:bg-white/50'
                    }`}
                  >
                    <span className="text-xl mb-1">{m.icon}</span>
                    <span className={`text-[11px] font-bold ${isActive ? m.color : 'text-slate-500'}`}>{m.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">{m.desc}</span>
                    {filled && (
                      <span className="mt-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">✓ Assigné</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active lot form */}
            {LOT_KEYS.map(lot => {
              const m = LOT_META[lot];
              if (lot !== activeLot) return null;
              const data = assignments[lot];
              const updateField = (field: keyof Omit<AssignmentRow, 'lot'>, val: string) => {
                if (field === 'entreprise') {
                  handleEntrepriseChange(lot, val);
                } else {
                  setAssignments(prev => ({ ...prev, [lot]: { ...prev[lot], [field]: val } }));
                }
                setApplied(false);
              };

              return (
                <div key={lot} className={`rounded-2xl border-2 ${m.bg} p-5 space-y-4`} style={{ borderColor: 'transparent' }}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${m.bg} ${m.color} text-xs font-bold mb-2`}>
                    <span>{m.icon}</span>
                    {m.label} — {m.desc}
                  </div>

                  {/* ── Database Select ── */}
                  {prestataires.length > 0 && (
                    <div className="p-3 bg-white/70 rounded-xl border border-white shadow-sm">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                        <span className="text-sm">🗄</span>
                        Choisir depuis la base prestataires
                      </label>
                      <select
                        value=""
                        onChange={e => {
                          const found = prestataires.find(p => p.id === e.target.value);
                          if (found) {
                            setAssignments(prev => ({
                              ...prev,
                              [lot]: {
                                entreprise: found.entreprise || '',
                                societe: found.societe || '',
                                telephone: found.telephone || '',
                                email: found.email || '',
                                adresse: found.adresse || '',
                              },
                            }));
                            setApplied(false);
                          }
                        }}
                        className="w-full px-3 py-2.5 text-xs border-2 border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 font-semibold text-slate-700 cursor-pointer hover:border-blue-300 transition-colors"
                      >
                        <option value="">— Sélectionner un prestataire —</option>
                        {prestataires.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.entreprise}{p.societe ? ` (${p.societe})` : ''}{p.telephone ? ` · ${p.telephone}` : ''}
                          </option>
                        ))}
                      </select>
                      {data.entreprise && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <span className="text-emerald-500 text-sm">✓</span>
                          <span className="text-xs font-semibold text-emerald-700">{data.entreprise}</span>
                          <button
                            onClick={() => {
                              setAssignments(prev => ({ ...prev, [lot]: { entreprise: '', societe: '', telephone: '', email: '', adresse: '' } }));
                              setApplied(false);
                            }}
                            className="ml-auto text-emerald-400 hover:text-rose-500 transition-colors text-xs"
                          >✕</button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Entreprise with autocomplete */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Ou saisir manuellement *
                      </label>
                      <AutocompleteInput
                        value={data.entreprise}
                        onChange={val => updateField('entreprise', val)}
                        suggestions={entrepriseSuggestions}
                        placeholder="Nom de l'entrepreneur..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Responsable</label>
                      <input
                        type="text"
                        value={data.societe}
                        onChange={e => updateField('societe', e.target.value)}
                        placeholder="Nom du responsable"
                        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Téléphone</label>
                      <input
                        type="tel"
                        value={data.telephone}
                        onChange={e => updateField('telephone', e.target.value)}
                        placeholder="+221 XX XXX XX XX"
                        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Email</label>
                      <input
                        type="email"
                        value={data.email}
                        onChange={e => updateField('email', e.target.value)}
                        placeholder="email@exemple.com"
                        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Adresse</label>
                      <input
                        type="text"
                        value={data.adresse}
                        onChange={e => updateField('adresse', e.target.value)}
                        placeholder="Adresse du prestataire"
                        className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                      />
                    </div>
                  </div>

                  {/* Quick copy from other lots */}
                  {knownPrestataires.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Copier depuis un prestataire existant</p>
                      <div className="flex flex-wrap gap-1.5">
                        {knownPrestataires.slice(0, 5).map((p, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setAssignments(prev => ({
                                ...prev,
                                [lot]: {
                                  entreprise: p.entreprise || '',
                                  societe: p.societe || '',
                                  telephone: p.telephone || '',
                                  email: p.email || '',
                                  adresse: p.adresse || '',
                                },
                              }));
                              setApplied(false);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                              {p.entreprise.charAt(0).toUpperCase()}
                            </span>
                            {p.entreprise.substring(0, 18)}{p.entreprise.length > 18 ? '…' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Selected grappes preview */}
            {selectedCount > 0 && (
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Aperçu — sera appliqué à {selectedCount} grappe{selectedCount > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...selectedGrappes].map(k => {
                    const g = regionGrappes.find(gr => gr.key === k);
                    const color = GRAPPE_COLORS[k] || '#5A6672';
                    return (
                      <span
                        key={k}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-700 shadow-sm"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        {k.replace('_', ' G')}
                        {g && <span className="text-slate-400 font-normal">·{g.total}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Footer Actions ── */}
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
                ) : '📡'}
                Sync API
              </button>
            )}

            <button
              onClick={handleApply}
              disabled={applying || selectedCount === 0 || !hasAssignment}
              className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                applied
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-md'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {applying ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : applied ? '✅' : '💾'}
              {applied ? 'Enregistré !' : `Appliquer à ${selectedCount} grappe${selectedCount > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

GrappeAssignmentPanel.displayName = 'GrappeAssignmentPanel';
export default GrappeAssignmentPanel;
