/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { Trash2, Search, FileText } from 'lucide-react';

interface MissionListSidebarProps {
  savedMissions: any[];
  currentMissionId: string | null;
  onLoadMission: (mission: any) => void;
  onDeleteMission: (id: string, orderNumber: string) => void;
  isCertifiedByWorkflow?: boolean;
}

type StatusFilter = 'all' | 'draft' | 'pending' | 'certified';

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  certified: { label: 'OFFICIELLE', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-500' },
  pending: { label: 'SOUMISE', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-500' },
  draft: { label: 'BROUILLON', dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-400' },
};

const hasOfficialOrderNumber = (mission: any) =>
  (mission.orderNumber && !mission.orderNumber.startsWith('TEMP-')) ||
  (mission.data?.orderNumber && !mission.data?.orderNumber.startsWith('TEMP-'));

const getMissionPrimaryLabel = (mission: any) => {
  if (hasOfficialOrderNumber(mission)) {
    return mission.orderNumber || mission.data?.orderNumber;
  }
  return mission.purpose || mission.title || 'Brouillon';
};

const getMissionSecondaryLabel = (mission: any) => {
  return mission.region || mission.purpose || mission.title || 'Destination à préciser';
};

const getMissionStatus = (m: any, isCurrentSelectedCertified?: boolean): keyof typeof STATUS_CONFIG => {
  const hasOfficialNumber = hasOfficialOrderNumber(m);
  const isCertified = m.isCertified || m.data?.isCertified || hasOfficialNumber || m.status === 'approuvee' || m.status === 'certified' || isCurrentSelectedCertified;
  
  if (isCertified) return 'certified';
  if (m.isSubmitted || m.data?.isSubmitted || m.status === 'soumise' || m.status === 'en_attente_validation') return 'pending';
  return 'draft';
};

export const MissionListSidebar: React.FC<MissionListSidebarProps> = ({
  savedMissions,
  currentMissionId,
  onLoadMission,
  onDeleteMission,
  isCertifiedByWorkflow = false,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const visibleMissions = savedMissions;

  const filteredMissions = useMemo(() => {
    return visibleMissions
      .filter((m) => {
        const isSelected = m.id === currentMissionId;
        const status = getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false);
        if (filter !== 'all' && status !== filter) return false;
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
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [visibleMissions, search, filter, currentMissionId, isCertifiedByWorkflow]);

  const counts = useMemo(
    () => ({
      all: visibleMissions.length,
      certified: visibleMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'certified';
      }).length,
      pending: visibleMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'pending';
      }).length,
      draft: visibleMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'draft';
      }).length,
    }),
    [visibleMissions, currentMissionId, isCertifiedByWorkflow]
  );

  const filterButtons: { key: StatusFilter; label: string; color: string; activeColor: string }[] =
    [
      {
        key: 'all',
        label: 'Tous',
        color: 'text-slate-400',
        activeColor: 'bg-slate-700 text-white',
      },
      {
        key: 'draft',
        label: 'BROUILLON',
        color: 'text-slate-400',
        activeColor: 'bg-slate-500 text-white',
      },
      {
        key: 'pending',
        label: 'SOUMISE',
        color: 'text-amber-400',
        activeColor: 'bg-amber-500 text-white',
      },
      {
        key: 'certified',
        label: 'OFFICIELLE',
        color: 'text-emerald-400',
        activeColor: 'bg-emerald-600 text-white',
      },
    ];

  return (
    <div className="w-full no-print space-y-2.5">

      {/* Barre de recherche compacte */}
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une mission…"
          className="w-full bg-slate-900/40 dark:bg-slate-800/60 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-[10px] font-semibold outline-none focus:ring-2 ring-indigo-500/30 placeholder-slate-500 transition-all text-white"
        />
      </div>

      {/* Filtres pills compacts */}
      <div className="flex gap-1 p-0.5 bg-slate-900/60 dark:bg-slate-800/40 rounded-lg border border-white/5">
        {filterButtons.map(({ key, activeColor }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 rounded-md py-1 text-[8px] font-black uppercase tracking-tight transition-all ${
              filter === key
                ? `${activeColor} shadow-sm`
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className="block text-[11px] font-black leading-none">{counts[key] || 0}</span>
            <span>{key === 'all' ? 'TOUS' : key === 'draft' ? 'DFT' : key === 'pending' ? 'ATT' : 'OFF'}</span>
          </button>
        ))}
      </div>

      {/* Liste ultra-compacte */}
      <div className="space-y-1 max-h-[75vh] overflow-y-auto custom-scrollbar">
        {filteredMissions.length === 0 && (
          <div className="text-center py-6 text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-white/5 rounded-xl">
            <FileText size={18} className="mx-auto mb-1.5 opacity-30" />
            <p className="text-[9px] font-black uppercase tracking-widest">Aucune mission</p>
          </div>
        )}

        {filteredMissions.map((m) => {
          const isActive = currentMissionId === m.id;
          const status = getMissionStatus(m, isActive ? isCertifiedByWorkflow : false);
          const cfg = STATUS_CONFIG[status];

          return (
            <div
              key={m.id}
              className="relative group"
            >
              <button
                onClick={() => onLoadMission(m)}
                className={`w-full cursor-pointer text-left px-2.5 py-2 rounded-xl border transition-all duration-150 flex items-center gap-2 overflow-hidden ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/30 dark:bg-slate-900/70 border-white/5 dark:border-white/4 hover:border-indigo-300/50 hover:bg-slate-800/50 dark:hover:bg-slate-800'
                }`}
              >
                {/* Dot statut */}
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : cfg.dot}`} />

                {/* Texte principal */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-black truncate leading-tight ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                    {getMissionPrimaryLabel(m)}
                  </p>
                  <p className={`text-[9px] truncate font-medium leading-tight mt-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                    {getMissionSecondaryLabel(m)}
                  </p>
                </div>

                {/* Badge statut discret */}
                <span className={`flex-shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : cfg.badge}`}>
                  {status === 'certified' ? '✓' : status === 'pending' ? '⏳' : '~'}
                </span>
              </button>

              {/* Bouton supprimer au hover */}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteMission(m.id, getMissionPrimaryLabel(m)); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                title="Supprimer"
              >
                <Trash2 size={9} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
