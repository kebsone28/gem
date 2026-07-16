/**
 * DossiersPrestataires.tsx — Dashboard for dossier tracking per prestataire and lot.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

// ── Unicode-safe labels ──────────────────────────────────────────────────────
const E = '\u{00E9}',
  GRAVE = '\u{00E8}';
type DossierStatut = 'incomplet' | 'en_cours' | 'complet' | 'archive';
const LOTS = ['A', 'B', 'C'] as const;
const STATUS_LBL: Record<string, string> = {
  incomplet: 'incomplet',
  en_cours: 'en cours',
  complet: 'complet',
  archive: `archiv${E}`,
};
const MSG = {
  NO_DATA: `Aucun dossier trouv${E}`,
  NO_FILTER: `Aucun dossier trouv${E} pour cette recherche`,
  ERR: `Erreur de chargement des dossiers`,
  EMPTY: `Aucun prestataire trouv${E} dans la base de donn${GRAVE}es`,
  CHARG: 'Chargement des dossiers...',
  SUB: 'Suivi des dossiers contractuels par prestataire et grappe',
  MENAGE: `m${E}nages`,
  GRAPPE: 'grappe',
  SEARCH: 'Rechercher par nom de prestataire...',
  LOT_ALL: 'Tous les lots',
  STATUT_ALL: 'Tous les statuts',
  CLEAR: 'Effacer',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface DossierInfo {
  id: string;
  prestataireNom: string;
  entreprise: string;
  societe: string;
  telephone: string;
  lot: string;
  statut: DossierStatut;
  grappesCount: number;
  grappesKeys: string[];
  totalMenages: number;
  menagesCompletes: number;
}
interface PrestataireGroup {
  prestataireNom: string;
  entreprise: string;
  societe: string;
  telephone: string;
  dossiers: DossierInfo[];
}

// ── Styling ──────────────────────────────────────────────────────────────────
const STYL: Record<DossierStatut, { c: string; bg: string; icon: React.ReactNode }> = {
  incomplet: {
    c: 'text-red-700',
    bg: 'bg-red-50 border border-red-200',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  en_cours: {
    c: 'text-amber-700',
    bg: 'bg-amber-50 border border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  complet: {
    c: 'text-emerald-700',
    bg: 'bg-emerald-50 border border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  archive: {
    c: 'text-slate-600',
    bg: 'bg-slate-100 border border-slate-200',
    icon: <FolderOpen className="w-3.5 h-3.5" />,
  },
};
const LOT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  A: { label: 'Lot A', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  B: {
    label: 'Lot B',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  C: { label: 'Lot C', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
};

// ── Data helpers ─────────────────────────────────────────────────────────────
function computeDossiers(
  prests: any[],
  grappes: any[],
  entries: Record<string, any>
): DossierInfo[] {
  const byRegion = new Map<string, any[]>();
  for (const g of grappes) {
    const rn = g.region?.name || 'Unknown';
    const list = byRegion.get(rn) || [];
    list.push(g);
    byRegion.set(rn, list);
  }
  const lotSt: Record<string, { t: number; d: number }> = {
    A: { t: 0, d: 0 },
    B: { t: 0, d: 0 },
    C: { t: 0, d: 0 },
  };
  for (const entry of Object.values(entries)) {
    for (const l of LOTS) {
      lotSt[l].t++;
      if (entry[l]?.status === 'fait') lotSt[l].d++;
    }
  }
  return prests.map((p) => {
    const lot = p.lot || 'A',
      region = p.region || '';
    const rg = byRegion.get(region) || [];
    const pct = (lotSt[lot]?.t || 0) > 0 ? (lotSt[lot]?.d || 0) / lotSt[lot].t : 0;
    let statut: DossierStatut = 'incomplet';
    if (pct >= 1) statut = 'complet';
    else if (pct > 0) statut = 'en_cours';
    const tm = rg.reduce((s: number, g: any) => s + (g.menageCount || 0), 0);
    return {
      id: String(p.id),
      prestataireNom: p.nom || p.entreprise || 'Inconnu',
      entreprise: p.entreprise || p.nom || '',
      societe: p.societe || '',
      telephone: p.telephone || '',
      lot,
      statut,
      grappesCount: rg.length,
      grappesKeys: rg.map((g: any) => g.grappeKey),
      totalMenages: tm,
      menagesCompletes: Math.round(pct * tm),
    };
  });
}

function groupByPrestataire(dossiers: DossierInfo[]): PrestataireGroup[] {
  const map = new Map<string, PrestataireGroup>();
  for (const d of dossiers) {
    const k = d.entreprise || d.prestataireNom;
    if (!map.has(k))
      map.set(k, {
        prestataireNom: d.prestataireNom,
        entreprise: d.entreprise,
        societe: d.societe,
        telephone: d.telephone,
        dossiers: [],
      });
    map.get(k)!.dossiers.push(d);
  }
  return Array.from(map.values()).sort((a, b) => a.prestataireNom.localeCompare(b.prestataireNom));
}

// ── Component ────────────────────────────────────────────────────────────────
const DossiersPrestataires: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [pR, gR, eR] = await Promise.all([
          apiClient.get('/carto-grappes/prestataires'),
          apiClient.get('/carto-grappes/grappes'),
          apiClient.get('/carto-grappes/entries'),
        ]);
        if (cancelled) return;
        const result = computeDossiers(pR.data || [], gR.data || [], eR.data || {});
        setDossiers(result);
        if (result.length === 0) toast(MSG.EMPTY, { icon: '\u{1F4ED}' });
      } catch {
        if (!cancelled) toast.error(MSG.ERR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dossiers.filter((d) => {
      if (q && !`${d.prestataireNom} ${d.entreprise} ${d.societe}`.toLowerCase().includes(q))
        return false;
      if (lotFilter && d.lot !== lotFilter) return false;
      if (statutFilter && d.statut !== statutFilter) return false;
      return true;
    });
  }, [dossiers, search, lotFilter, statutFilter]);

  const groups = useMemo(() => groupByPrestataire(filtered), [filtered]);
  const stats = useMemo(
    () => ({
      total: filtered.length,
      complets: filtered.filter((d) => d.statut === 'complet').length,
      enCours: filtered.filter((d) => d.statut === 'en_cours').length,
      incomplets: filtered.filter((d) => d.statut === 'incomplet').length,
    }),
    [filtered]
  );

  const onSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    []
  );
  const onLot = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setLotFilter(e.target.value),
    []
  );
  const onStatut = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setStatutFilter(e.target.value),
    []
  );
  const onClear = useCallback(() => {
    setSearch('');
    setLotFilter('');
    setStatutFilter('');
  }, []);
  const hasF = search || lotFilter || statutFilter;

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">{MSG.CHARG}</p>
        </div>
      </div>
    );

  const statCards = [
    {
      icon: <FileText className="w-5 h-5 text-indigo-600" />,
      label: 'Total dossiers',
      v: stats.total,
      bg: 'bg-indigo-50 border-indigo-200',
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      label: 'Complets',
      v: stats.complets,
      bg: 'bg-emerald-50 border-emerald-200',
    },
    {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      label: 'En cours',
      v: stats.enCours,
      bg: 'bg-amber-50 border-amber-200',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
      label: 'Incomplets',
      v: stats.incomplets,
      bg: 'bg-red-50 border-red-200',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Dossiers Prestataires</h1>
      </div>
      <p className="text-sm text-slate-500 -mt-4">{MSG.SUB}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                {s.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Filter className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={onSearch}
          placeholder={MSG.SEARCH}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <select
          value={lotFilter}
          onChange={onLot}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">{MSG.LOT_ALL}</option>
          {LOTS.map((l) => (
            <option key={l} value={l}>
              {LOT_META[l].label}
            </option>
          ))}
        </select>
        <select
          value={statutFilter}
          onChange={onStatut}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">{MSG.STATUT_ALL}</option>
          {(Object.keys(STATUS_LBL) as DossierStatut[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LBL[s]}
            </option>
          ))}
        </select>
        {hasF && (
          <button
            onClick={onClear}
            className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {MSG.CLEAR}
          </button>
        )}
      </div>

      {/* Content */}
      {groups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{hasF ? MSG.NO_FILTER : MSG.NO_DATA}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((grp) => (
            <div
              key={grp.entreprise}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-slate-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{grp.prestataireNom}</h3>
                  <p className="text-xs text-slate-500">
                    {grp.societe || grp.entreprise}
                    {grp.telephone ? ` \u2022 ${grp.telephone}` : ''}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {grp.dossiers.map((d) => {
                  const lm = LOT_META[d.lot] || LOT_META.A,
                    sm = STYL[d.statut];
                  return (
                    <div
                      key={`${d.id}-${d.lot}`}
                      className="px-5 py-3 flex flex-wrap items-center gap-3"
                    >
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${lm.bg} ${lm.color} border ${lm.border}`}
                      >
                        {lm.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${sm.bg} ${sm.c}`}
                      >
                        {sm.icon}
                        {STATUS_LBL[d.statut]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {d.menagesCompletes}/{d.totalMenages} {MSG.MENAGE}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <FileText className="w-3 h-3" />
                        {d.grappesCount} {MSG.GRAPPE}
                        {d.grappesCount > 1 ? 's' : ''}
                      </span>
                      {d.grappesKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-auto">
                          {d.grappesKeys.slice(0, 4).map((gk) => (
                            <span
                              key={gk}
                              className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 rounded"
                            >
                              {gk}
                            </span>
                          ))}
                          {d.grappesKeys.length > 4 && (
                            <span className="text-[10px] text-slate-400">
                              +{d.grappesKeys.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(DossiersPrestataires);
