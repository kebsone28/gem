/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { ChevronRight, Trash2, Search, Clock, CheckCircle2, FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface MissionListSidebarProps {
  savedMissions: any[];
  currentMissionId: string | null;
  onLoadMission: (mission: any) => void;
  onDeleteMission: (id: string, orderNumber: string) => void;
  isCertifiedByWorkflow?: boolean;
}

type StatusFilter = 'all' | 'draft' | 'pending' | 'certified';

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  certified: { label: 'SIGNÉE', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-500' },
  pending: { label: 'ATTENTE', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-500' },
  draft: { label: 'BROUILLON', dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-400' },
};

const getMissionStatus = (m: any, isCurrentSelectedCertified?: boolean): keyof typeof STATUS_CONFIG => {
  const hasOfficialNumber = (m.orderNumber && !m.orderNumber.startsWith('TEMP-')) || (m.data?.orderNumber && !m.data?.orderNumber.startsWith('TEMP-'));
  const isCertified = m.isCertified || m.data?.isCertified || hasOfficialNumber || m.status === 'approuvee' || m.status === 'certified' || isCurrentSelectedCertified;
  
  if (isCertified) return 'certified';
  if (m.isSubmitted || m.data?.isSubmitted || m.status === 'soumise') return 'pending';
  return 'draft';
};

export const MissionListSidebar: React.FC<MissionListSidebarProps> = ({
  savedMissions,
  currentMissionId,
  onLoadMission,
  onDeleteMission,
  isCertifiedByWorkflow = false,
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const role = user?.role?.toUpperCase() || '';
  const isMaster = role === 'ADMIN_PROQUELEC' || role === 'DIRECTEUR' || role === 'DG_PROQUELEC' || user?.email === 'admingem';

  const visibleMissions = useMemo(() => {
    if (isMaster) return savedMissions;
    return savedMissions.filter((m) => {
      // Vérification complète des champs possibles : par email, par ID (createdBy ou creatorId)
      const isCreator = !m.createdBy || 
                        m.createdBy === 'inconnu' || 
                        m.createdBy === user?.email || 
                        m.createdBy === user?.id || 
                        m.creatorId === user?.id;
      const isMember = m.members?.some((member: any) => member.name === user?.name);
      return isCreator || isMember;
    });
  }, [savedMissions, user, isMaster]);

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
            (m.region || '').toLowerCase().includes(q) ||
            (m.purpose || '').toLowerCase().includes(q)
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
        label: 'ATTENTE',
        color: 'text-amber-400',
        activeColor: 'bg-amber-500 text-white',
      },
      {
        key: 'certified',
        label: 'SIGNÉE',
        color: 'text-emerald-400',
        activeColor: 'bg-emerald-600 text-white',
      },
    ];

  return (
    <div className="w-full no-print space-y-3 sm:space-y-4">
      <h3 className="!text-[10px] sm:!text-[9px] font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 px-1 flex items-center gap-2">
        <FileText size={10} />
        Mes Missions
        <span className="ml-auto bg-indigo-500/20 text-indigo-400 text-[8px] font-black px-1.5 py-0.5 rounded-full">
          {counts.all}
        </span>
      </h3>

      {/* Barre de recherche */}
      <div className="relative">
        <Search
          size={11}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl pl-8 pr-3 py-2.5 text-[11px] sm:text-[10px] font-bold outline-none focus:ring-2 ring-indigo-500/20 placeholder-slate-400 transition-all"
        />
      </div>

      {/* Filtres status */}
      <div className="grid grid-cols-4 gap-1.5">
        {filterButtons.map(({ key, label, color, activeColor }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`min-w-0 rounded-xl py-1.5 text-[8px] sm:text-[7px] font-black uppercase tracking-tight transition-all flex flex-col items-center gap-0.5 ${
              filter === key
                ? activeColor
                : `bg-slate-100 dark:bg-white/5 ${color} hover:bg-slate-200 dark:hover:bg-white/10`
            }`}
          >
            <span className={`text-[10px] font-black leading-none ${filter === key ? 'text-white' : 'text-slate-400'}`}>
              {counts[key] || 0}
            </span>
            <span className="truncate w-full px-0.5 text-center">{label}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2 max-h-[70vh] lg:max-h-[1100px] overflow-y-auto custom-scrollbar pr-1">
        {filteredMissions.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-600 border border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
            <FileText size={24} className="mx-auto mb-2 opacity-30" />
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
              role="button"
              tabIndex={0}
              onClick={() => onLoadMission(m)}
              onKeyDown={(e) => e.key === 'Enter' && onLoadMission(m)}
              className={`w-full cursor-pointer text-left p-3 sm:p-3.5 rounded-2xl text-[10px] sm:text-[9px] font-bold uppercase tracking-[0.12em] sm:tracking-widest border transition-all duration-200 group flex flex-col gap-2 overflow-hidden relative ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-500/20 translate-x-1'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-indigo-400/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-black">
                  {m.orderNumber && !m.orderNumber.startsWith('TEMP-')
                    ? m.orderNumber
                    : m.purpose || 'Brouillon'}
                </span>
                <span
                  className={`flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[7px] font-black ${
                    isActive ? 'bg-white/20 text-white' : cfg.badge
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {status === 'certified' && !isActive && (
                  <CheckCircle2 size={9} className="text-emerald-500 flex-shrink-0" />
                )}
                {status === 'pending' && !isActive && (
                  <Clock size={9} className="text-amber-500 flex-shrink-0" />
                )}
                <span
                  className={`text-[10px] sm:text-[9px] truncate normal-case font-medium ${isActive ? 'text-white/70' : 'text-slate-500 dark:text-slate-500'}`}
                >
                  {m.region || (m.orderNumber && !m.orderNumber.startsWith('TEMP-') ? m.purpose : 'Destination à préciser')}
                </span>
              </div>

              {isActive && (
                <ChevronRight
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40"
                />
              )}

              {/* Delete button */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMission(m.id, m.orderNumber || 'Brouillon');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    onDeleteMission(m.id, m.orderNumber || 'Brouillon');
                  }
                }}
                className="absolute bottom-2 right-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10"
                title="Supprimer définitivement"
              >
                <Trash2 size={11} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
