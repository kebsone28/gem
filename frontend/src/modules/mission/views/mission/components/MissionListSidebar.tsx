import { Trash2, Search, FileText, Calendar, MapPin, Clock, FileCheck, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useMemo } from 'react';

const START_TS = Date.now();

interface MissionListSidebarProps {
  savedMissions: any[];
  currentMissionId: string | null;
  onLoadMission: (mission: any) => void;
  onDeleteMission: (id: string, orderNumber: string) => void;
  isCertifiedByWorkflow?: boolean;
  role?: string;
  onPurgeAll?: () => Promise<void>;
}

type StatusFilter = 'all' | 'draft' | 'pending' | 'certified';

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; icon: any; bar: string }> = {
  certified: {
    label: 'OFFICIELLE',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20',
    icon: FileCheck,
    bar: 'bg-emerald-500',
  },
  pending: {
    label: 'SOUMISE',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/12 text-amber-400 border-amber-500/20',
    icon: Clock,
    bar: 'bg-amber-400',
  },
  draft: {
    label: 'BROUILLON',
    dot: 'bg-slate-600',
    badge: 'bg-slate-700/50 text-slate-500 border-white/8',
    icon: FileText,
    bar: 'bg-slate-600',
  },
};

const hasOfficialOrderNumber = (mission: any) =>
  (mission.orderNumber && !mission.orderNumber.startsWith('TEMP-')) ||
  (mission.data?.orderNumber && !mission.data?.orderNumber.startsWith('TEMP-'));

const getMissionPrimaryLabel = (mission: any) => {
  if (hasOfficialOrderNumber(mission)) return mission.orderNumber || mission.data?.orderNumber;
  return mission.purpose || mission.title || 'Brouillon';
};

const getMissionSecondaryLabel = (mission: any) =>
  mission.region || mission.purpose || mission.title || 'Destination à préciser';

const getMissionStatus = (m: any, isCurrentSelectedCertified?: boolean): keyof typeof STATUS_CONFIG => {
  const hasOfficialNumber = hasOfficialOrderNumber(m);
  const isCertified =
    m.isCertified || m.data?.isCertified || hasOfficialNumber ||
    m.status === 'approuvee' || m.status === 'certified' || isCurrentSelectedCertified;
  if (isCertified) return 'certified';
  if (m.isSubmitted || m.data?.isSubmitted || m.status === 'soumise' || m.status === 'en_attente_validation') return 'pending';
  return 'draft';
};

const formatDate = (d: any) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return null;
  }
};

export const MissionListSidebar: React.FC<MissionListSidebarProps> = ({
  savedMissions,
  currentMissionId,
  onLoadMission,
  onDeleteMission,
  isCertifiedByWorkflow = false,
  role,
  onPurgeAll,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedRegion, setSelectedRegion] = useState('Toutes');
  const [showFilters, setShowFilters] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const isAdmin = useMemo(() => (role || '').toUpperCase() === 'ADMIN_PROQUELEC', [role]);

  const regions = useMemo(() => {
    const r = new Set(['Toutes']);
    savedMissions.forEach((m) => {
      const region = m.region || m.data?.region;
      if (region) r.add(region);
    });
    return Array.from(r);
  }, [savedMissions]);

  const groupedMissions = useMemo(() => {
    const filtered = savedMissions
      .filter((m) => {
        const isSelected = m.id === currentMissionId;
        const status = getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false);
        const region = m.region || m.data?.region;
        if (filter !== 'all' && status !== filter) return false;
        if (selectedRegion !== 'Toutes' && region !== selectedRegion) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            (m.orderNumber || '').toLowerCase().includes(q) ||
            (m.data?.orderNumber || '').toLowerCase().includes(q) ||
            (m.region || '').toLowerCase().includes(q) ||
            (m.purpose || '').toLowerCase().includes(q) ||
            (m.title || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b: any) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });

    const groups: Record<string, any[]> = {};
    filtered.forEach((m) => {
      const date = new Date(m.updatedAt || m.createdAt || START_TS);
      const key = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  }, [savedMissions, search, filter, selectedRegion, currentMissionId, isCertifiedByWorkflow]);

  const counts = useMemo(
    () => ({
      all: savedMissions.length,
      certified: savedMissions.filter((m) => getMissionStatus(m, m.id === currentMissionId ? isCertifiedByWorkflow : false) === 'certified').length,
      pending:   savedMissions.filter((m) => getMissionStatus(m, m.id === currentMissionId ? isCertifiedByWorkflow : false) === 'pending').length,
      draft:     savedMissions.filter((m) => getMissionStatus(m, m.id === currentMissionId ? isCertifiedByWorkflow : false) === 'draft').length,
    }),
    [savedMissions, currentMissionId, isCertifiedByWorkflow]
  );

  const filterTabs: { key: StatusFilter; label: string; color: string; activeBg: string }[] = [
    { key: 'all',       label: 'Tous',       color: 'text-slate-400',   activeBg: 'bg-slate-700 text-white' },
    { key: 'draft',     label: 'DFT',        color: 'text-slate-500',   activeBg: 'bg-slate-600 text-white' },
    { key: 'pending',   label: 'ATT',        color: 'text-amber-500',   activeBg: 'bg-amber-500 text-white' },
    { key: 'certified', label: 'OFF',        color: 'text-emerald-500', activeBg: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="w-full no-print flex flex-col gap-3">

      {/* ── Search bar ── */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-8 pr-2.5 py-2 text-[11px] font-semibold outline-none focus:border-indigo-500/40 focus:bg-indigo-500/5 transition-all text-white placeholder:text-slate-700"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl border transition-all ${showFilters ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/[0.04] border-white/[0.06] text-slate-600 hover:text-slate-400'}`}
        >
          <Calendar size={13} />
        </button>
      </div>

      {/* ── Region filter ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
              <label className="text-[8px] font-black text-indigo-400/50 uppercase tracking-widest">Région</label>
              <div className="flex flex-wrap gap-1">
                {regions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRegion(r)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black transition-all ${
                      selectedRegion === r
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                        : 'bg-white/5 text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status filter tabs ── */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.05]">
        {filterTabs.map(({ key, label, activeBg }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex flex-col items-center justify-center rounded-lg py-1.5 transition-all text-[8px] font-black ${
              filter === key ? `${activeBg} shadow-md` : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <span className="text-[12px] font-black leading-none mb-0.5">{counts[key]}</span>
            <span className="tracking-widest opacity-80">{label.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ── Mission list ── */}
      <div className="flex-1 space-y-4 max-h-[62vh] overflow-y-auto custom-scrollbar pr-0.5">
        {Object.keys(groupedMissions).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-3">
              <FileText size={16} className="text-slate-700" />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Aucune mission</p>
          </div>
        ) : (
          Object.entries(groupedMissions).map(([group, missions]) => (
            <div key={group} className="space-y-1.5">
              {/* Group header */}
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em] capitalize">{group}</span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
              </div>

              {missions.map((m) => {
                const isActive = currentMissionId === m.id;
                const status = getMissionStatus(m, isActive ? isCertifiedByWorkflow : false);
                const cfg = STATUS_CONFIG[status];
                const date = formatDate(m.updatedAt || m.createdAt);

                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group relative"
                  >
                    <button
                      onClick={() => onLoadMission(m)}
                      className={`w-full text-left px-3 py-3 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                        isActive
                          ? 'bg-gradient-to-br from-indigo-600/90 to-indigo-700/80 border-indigo-400/40 shadow-lg shadow-indigo-600/20'
                          : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      {/* Active left accent */}
                      {isActive && (
                        <motion.div
                          layoutId="active-indicator"
                          className="absolute left-0 top-0 bottom-0 w-[3px] bg-white rounded-l-2xl"
                        />
                      )}

                      <div className="flex items-start gap-2.5">
                        {/* Status icon */}
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive ? 'bg-white/15' : 'bg-white/[0.04] border border-white/[0.06]'
                        }`}>
                          <cfg.icon size={12} className={isActive ? 'text-white' : cfg.badge.split(' ')[1]} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black truncate leading-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {getMissionPrimaryLabel(m)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={8} className={isActive ? 'text-white/40' : 'text-slate-700'} />
                            <p className={`text-[9px] truncate font-semibold ${isActive ? 'text-white/50' : 'text-slate-600'}`}>
                              {getMissionSecondaryLabel(m)}
                            </p>
                          </div>
                        </div>

                        {/* Date */}
                        {date && (
                          <span className={`text-[8px] font-bold shrink-0 mt-0.5 ${isActive ? 'text-white/40' : 'text-slate-700'}`}>
                            {date}
                          </span>
                        )}
                      </div>

                      {/* Timeline dots */}
                      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-white/[0.05]">
                        {[
                          { done: true, title: 'Créée' },
                          { done: m.isSubmitted || m.data?.isSubmitted || status !== 'draft', title: 'Soumise' },
                          { done: status === 'certified', title: 'Certifiée' },
                        ].map((step, i) => (
                          <React.Fragment key={i}>
                            <div
                              title={step.title}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                step.done
                                  ? isActive ? 'bg-white' : cfg.bar
                                  : 'bg-white/10'
                              }`}
                            />
                            {i < 2 && (
                              <div className={`h-px flex-1 ${step.done && isActive ? 'bg-white/20' : step.done ? 'bg-white/10' : 'bg-white/[0.04]'}`} />
                            )}
                          </React.Fragment>
                        ))}
                        <span className={`ml-auto text-[7px] font-black uppercase tracking-widest ${isActive ? 'text-white/30' : 'text-slate-800'}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMission(m.id, getMissionPrimaryLabel(m));
                      }}
                      className="absolute right-2.5 top-2.5 p-1.5 text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                    >
                      <Trash2 size={11} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* ── Admin purge ── */}
      {isAdmin && onPurgeAll && (
        <div className="pt-3 border-t border-white/[0.05]">
          <button
            disabled={isPurging}
            onClick={async () => {
              if (window.confirm('🚨 Purger TOUTES les missions du serveur ? Action irréversible.')) {
                setIsPurging(true);
                try { await onPurgeAll(); } finally { setIsPurging(false); }
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/8 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all group disabled:opacity-50"
          >
            <Trash2 size={12} className={isPurging ? 'animate-spin' : 'group-hover:scale-110 transition-transform'} />
            {isPurging ? 'Purge…' : 'Purger le Serveur'}
          </button>
          <p className="text-[8px] text-slate-800 text-center mt-1.5 font-bold tracking-tight">SUPER-ADMINISTRATEUR UNIQUEMENT</p>
        </div>
      )}
    </div>
  );
};
