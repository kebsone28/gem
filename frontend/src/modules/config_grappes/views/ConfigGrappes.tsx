import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings2,
  MapPin,
  Package,
  Users,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  RefreshCcw,
  Loader2,
  Search,
  ArrowLeft,
  Home,
  HardHat,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useProject } from '@contexts/ProjectContext';

/* ---- Types ---- */
interface GrappeRow {
  region: string;
  key: string;
  label: string;
  households: number;
  villages: number;
}
interface LotDef {
  key: string;
  title: string;
  description: string;
  active: boolean;
  grappesCount: number;
}
interface AssignationRow {
  grappeKey: string;
  region: string;
  lotKey: string;
  mode: 'individuel' | 'groupe' | 'global';
  prestataire: string;
}

/* ---- Constants ---- */
const RC: Record<string, { bg: string; text: string; dot: string }> = {
  Kaffrine: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  Tambacounda: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
};

const INIT_G: GrappeRow[] = [
  { region: 'Kaffrine', key: 'KAF_G001', label: 'Grappe 1', households: 42, villages: 3 },
  { region: 'Kaffrine', key: 'KAF_G002', label: 'Grappe 2', households: 38, villages: 2 },
  { region: 'Kaffrine', key: 'KAF_G003', label: 'Grappe 3', households: 45, villages: 4 },
  { region: 'Kaffrine', key: 'KAF_G004', label: 'Grappe 4', households: 40, villages: 3 },
  { region: 'Kaffrine', key: 'KAF_G005', label: 'Grappe 5', households: 36, villages: 2 },
  { region: 'Kaffrine', key: 'KAF_G006', label: 'Grappe 6', households: 44, villages: 3 },
  { region: 'Tambacounda', key: 'TAM_G001', label: 'Grappe 1', households: 50, villages: 4 },
  { region: 'Tambacounda', key: 'TAM_G002', label: 'Grappe 2', households: 47, villages: 3 },
  { region: 'Tambacounda', key: 'TAM_G003', label: 'Grappe 3', households: 53, villages: 5 },
];

const INIT_L: LotDef[] = [
  {
    key: 'A',
    title: 'Lot A — Pré-câblage',
    description: 'Pré-câblage des habitations pour le raccordement',
    active: true,
    grappesCount: 9,
  },
  {
    key: 'B',
    title: 'Lot B — Installation intérieure',
    description: 'Installation électrique intérieure des habitations',
    active: true,
    grappesCount: 9,
  },
  {
    key: 'C',
    title: 'Lot C — Raccordement',
    description: 'Raccordement au réseau électrique SENELEC',
    active: true,
    grappesCount: 9,
  },
];

const LOT_COLORS: Record<string, { card: string; icon: string; accent: string }> = {
  A: {
    card: 'border-cyan-500/20 bg-cyan-500/5',
    icon: 'text-cyan-400 bg-cyan-500/10',
    accent: 'text-cyan-400',
  },
  B: {
    card: 'border-violet-500/20 bg-violet-500/5',
    icon: 'text-violet-400 bg-violet-500/10',
    accent: 'text-violet-400',
  },
  C: {
    card: 'border-rose-500/20 bg-rose-500/5',
    icon: 'text-rose-400 bg-rose-500/10',
    accent: 'text-rose-400',
  },
};

const LOT_ICONS: Record<string, React.ReactNode> = {
  A: <Layers size={20} />,
  B: <Home size={20} />,
  C: <HardHat size={20} />,
};

const MODE_CLS: Record<string, string> = {
  individuel: 'bg-blue-500/20 text-blue-300',
  groupe: 'bg-violet-500/20 text-violet-300',
  global: 'bg-amber-500/20 text-amber-300',
};

const TABS = [
  { key: 'grappes' as const, label: 'Grappes', icon: <MapPin size={14} /> },
  { key: 'lots' as const, label: 'Lots', icon: <Package size={14} /> },
  { key: 'assignations' as const, label: 'Assignations', icon: <Users size={14} /> },
];

/* ---- Small helpers ---- */
function Toggle({ v, on }: { v: boolean; on: () => void }) {
  return (
    <button
      onClick={on}
      className={`relative w-11 h-6 rounded-full transition-colors ${v ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${v ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

function Badge({ n, cls }: { n: number | string; cls?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${cls || 'bg-slate-700 text-slate-300'}`}
    >
      {n}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  const c: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <div className={`rounded-xl border p-4 ${c[color]}`}>
      <div className="flex items-center gap-2 mb-2 opacity-80">{icon}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */
const ConfigGrappes: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useProject();
  const [tab, setTab] = useState<'grappes' | 'lots' | 'assignations'>('grappes');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grappes, setGrappes] = useState<GrappeRow[]>(INIT_G);
  const [lots, setLots] = useState<LotDef[]>(INIT_L);
  const [assignments, setAssignments] = useState<AssignationRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Kaffrine', 'Tambacounda']));

  /* Fetch data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [gR, lR, aR] = await Promise.allSettled([
          apiClient.get('/carto-grappes/grappes'),
          apiClient.get('/carto-grappes/lots'),
          apiClient.get('/carto-grappes/entrepreneurs'),
        ]);
        if (!cancelled) {
          if (gR.status === 'fulfilled' && gR.value.data?.grappes?.length)
            setGrappes(gR.value.data.grappes);
          if (lR.status === 'fulfilled' && lR.value.data?.lots?.length) setLots(lR.value.data.lots);
          if (aR.status === 'fulfilled' && aR.value.data?.assignments?.length)
            setAssignments(aR.value.data.assignments);
        }
      } catch {
        /* fallback to static data */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  /* Derived */
  const byRegion = useMemo(() => {
    const m = new Map<string, GrappeRow[]>();
    for (const g of grappes) {
      let list = m.get(g.region);
      if (!list) {
        list = [];
        m.set(g.region, list);
      }
      list.push(g);
    }
    return m;
  }, [grappes]);

  const filtered = useMemo(() => {
    if (!search) return byRegion;
    const q = search.toLowerCase();
    const m = new Map<string, GrappeRow[]>();
    for (const g of grappes) {
      if (
        g.key.toLowerCase().includes(q) ||
        g.region.toLowerCase().includes(q) ||
        g.label.toLowerCase().includes(q)
      ) {
        let list = m.get(g.region);
        if (!list) {
          list = [];
          m.set(g.region, list);
        }
        list.push(g);
      }
    }
    return m;
  }, [grappes, search, byRegion]);

  const totHH = useMemo(() => grappes.reduce((s, g) => s + g.households, 0), [grappes]);
  const totV = useMemo(() => grappes.reduce((s, g) => s + g.villages, 0), [grappes]);
  const activeLots = useMemo(() => lots.filter((l) => l.active).length, [lots]);

  /* Handlers */
  const toggleRegion = useCallback((r: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(r) ? n.delete(r) : n.add(r);
      return n;
    });
  }, []);

  const toggleLot = useCallback(
    (k: string) => {
      setLots((p) => p.map((l) => (l.key === k ? { ...l, active: !l.active } : l)));
      toast.success(
        `Lot ${k} ${lots.find((l) => l.key === k)?.active ? 'désactivé' : 'activé'}`
      );
    },
    [lots]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [gR, lR, aR] = await Promise.allSettled([
        apiClient.get('/carto-grappes/grappes'),
        apiClient.get('/carto-grappes/lots'),
        apiClient.get('/carto-grappes/entrepreneurs'),
      ]);
      if (gR.status === 'fulfilled' && gR.value.data?.grappes?.length)
        setGrappes(gR.value.data.grappes);
      if (lR.status === 'fulfilled' && lR.value.data?.lots?.length) setLots(lR.value.data.lots);
      if (aR.status === 'fulfilled' && aR.value.data?.assignments?.length)
        setAssignments(aR.value.data.assignments);
      toast.success('Données actualisées');
    } catch {
      toast.error("Échec de l'actualisation");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Loading / empty */
  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={40} className="text-indigo-400 animate-spin" />
      </div>
    );

  if (!activeProjectId)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Home size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">Aucun projet actif</p>
          <p className="text-xs text-slate-600 mt-1">
            Sélectionnez un projet pour configurer les grappes.
          </p>
        </div>
      </div>
    );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <Settings2 size={28} className="text-indigo-400" />
                <h1 className="text-2xl font-black text-white tracking-tight">Config Grappes</h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Configuration des grappes, lots et affectations entrepreneurs
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-semibold transition-all flex items-center gap-2 border border-white/5"
          >
            <RefreshCcw size={16} /> Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<MapPin size={18} />}
            label="Grappes"
            value={grappes.length}
            color="emerald"
          />
          <StatCard icon={<Home size={18} />} label="Ménages" value={totHH} color="blue" />
          <StatCard icon={<Layers size={18} />} label="Villages" value={totV} color="violet" />
          <StatCard
            icon={<HardHat size={18} />}
            label="Lots actifs"
            value={`${activeLots}/${lots.length}`}
            color="amber"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/5 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-[0.08em] transition-all ${
                tab === t.key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {t.icon} {t.label}
              {t.key === 'grappes' && <Badge n={grappes.length} />}
              {t.key === 'lots' && <Badge n={activeLots} cls="bg-amber-500/20 text-amber-300" />}
              {t.key === 'assignations' && <Badge n={assignments.length} />}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab !== 'lots' && (
          <div className="relative mb-4">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={
                tab === 'grappes' ? 'Rechercher une grappe...' : 'Rechercher une assignation...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900/80 border border-white/8 text-slate-200 placeholder:text-slate-600 text-sm font-medium focus:outline-none focus:border-indigo-500/40 transition-all"
            />
          </div>
        )}

        {/* Content */}
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-900/60">
          {tab === 'grappes' && (
            <SectionGrappes data={filtered} expanded={expanded} toggle={toggleRegion} />
          )}
          {tab === 'lots' && <SectionLots lots={lots} onToggle={toggleLot} />}
          {tab === 'assignations' && <SectionAssignments rows={assignments} search={search} />}
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-600">
          {grappes.length} grappes {'\u00B7'} {lots.length} lots {'\u00B7'} {assignments.length}{' '}
          assignations
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Section 1: Grappes                                                 */
/* ================================================================== */
function SectionGrappes({
  data,
  expanded,
  toggle,
}: {
  data: Map<string, GrappeRow[]>;
  expanded: Set<string>;
  toggle: (r: string) => void;
}) {
  return (
    <div className="divide-y divide-white/5">
      {Array.from(data.entries()).map(([region, rows]) => {
        const c = RC[region] || RC.Kaffrine;
        const isOpen = expanded.has(region);
        const hh = rows.reduce((s, r) => s + r.households, 0);
        return (
          <div key={region}>
            <button
              onClick={() => toggle(region)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={16} className="text-slate-500" />
              ) : (
                <ChevronRight size={16} className="text-slate-500" />
              )}
              <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
              <span className="text-sm font-bold text-white">{region}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
              >
                {rows.length} grappes
              </span>
              <span className="text-[10px] text-slate-500 ml-auto">
                {hh} ménages
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-5 py-2 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Clé
                      </th>
                      <th className="px-5 py-2 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Libellé
                      </th>
                      <th className="px-5 py-2 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Ménages
                      </th>
                      <th className="px-5 py-2 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Villages
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr
                        key={g.key}
                        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${c.bg}`}
                      >
                        <td className="px-5 py-3">
                          <span className={`text-xs font-mono font-bold ${c.text}`}>{g.key}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-300 font-medium">{g.label}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs font-bold text-white">{g.households}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-slate-400">{g.villages}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {data.size === 0 && (
        <div className="p-8 text-center text-sm text-slate-500">Aucune grappe trouvée</div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Section 2: Lots                                                    */
/* ================================================================== */
function SectionLots({ lots, onToggle }: { lots: LotDef[]; onToggle: (k: string) => void }) {
  return (
    <div className="p-5 space-y-4">
      {lots.map((l) => {
        const lc = LOT_COLORS[l.key] || LOT_COLORS.A;
        return (
          <div key={l.key} className={`rounded-xl border p-5 transition-all ${lc.card}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${lc.icon}`}>
                  {LOT_ICONS[l.key] || <Package size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{l.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{l.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-semibold text-slate-500">
                      {l.grappesCount} grappes
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-500'}`}
                    >
                      {l.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-semibold">
                  {l.active ? 'Activé' : 'Désactivé'}
                </span>
                <button
                  onClick={() => onToggle(l.key)}
                  className="transition-transform hover:scale-110"
                >
                  {l.active ? (
                    <ToggleRight size={32} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={32} className="text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Section 3: Assignations                                            */
/* ================================================================== */
function SectionAssignments({ rows, search }: { rows: AssignationRow[]; search: string }) {
  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (a) =>
        a.grappeKey.toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q) ||
        a.lotKey.toLowerCase().includes(q) ||
        a.prestataire.toLowerCase().includes(q) ||
        a.mode.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (filtered.length === 0)
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        {rows.length === 0
          ? 'Aucune assignation configurée'
          : 'Aucune assignation ne correspond à la recherche'}
      </div>
    );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/8">
          {['Région', 'Grappe', 'Lot', 'Mode', 'Prestataire'].map((h) => (
            <th
              key={h}
              className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.map((a, i) => {
          const rc = RC[a.region] || RC.Kaffrine;
          const lc = LOT_COLORS[a.lotKey] || LOT_COLORS.A;
          return (
            <tr
              key={`${a.grappeKey}-${a.lotKey}-${i}`}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rc.dot}`} />
                  <span className="text-xs text-slate-300 font-medium">{a.region}</span>
                </div>
              </td>
              <td className="px-5 py-3">
                <span className={`text-xs font-mono font-bold ${rc.text}`}>{a.grappeKey}</span>
              </td>
              <td className="px-5 py-3">
                <span className={`text-xs font-bold ${lc.accent}`}>Lot {a.lotKey}</span>
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${MODE_CLS[a.mode] || 'bg-slate-700 text-slate-400'}`}
                >
                  {a.mode}
                </span>
              </td>
              <td className="px-5 py-3">
                <span className="text-xs text-slate-300 font-medium">
                  {a.prestataire || <span className="text-slate-600 italic">Non assigné</span>}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default ConfigGrappes;
