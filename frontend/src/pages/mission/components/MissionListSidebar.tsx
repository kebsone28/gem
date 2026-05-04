import { Trash2, Search, FileText, Calendar, MapPin, ChevronRight, CheckCircle2, Clock, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MissionList from '../../../components/MissionList';

interface MissionListSidebarProps {
  savedMissions: any[];
  currentMissionId: string | null;
  onLoadMission: (mission: any) => void;
  onDeleteMission: (id: string, orderNumber: string) => void;
  isCertifiedByWorkflow?: boolean;
}

type StatusFilter = 'all' | 'draft' | 'pending' | 'certified';

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; icon: any }> = {
  certified: { label: 'OFFICIELLE', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-500', icon: FileCheck },
  pending: { label: 'SOUMISE', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-500', icon: Clock },
  draft: { label: 'BROUILLON', dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-400', icon: FileText },
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
  const [selectedRegion, setSelectedRegion] = useState('Toutes');
  const [showFilters, setShowFilters] = useState(false);

  const regions = useMemo(() => {
    const r = new Set(['Toutes']);
    savedMissions.forEach(m => {
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
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

    // Grouping by Month/Year for traceability and annual tracking
    const groups: Record<string, any[]> = {};
    filtered.forEach(m => {
      const date = new Date(m.updatedAt || m.createdAt || Date.now());
      const key = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  }, [savedMissions, search, filter, selectedRegion, currentMissionId, isCertifiedByWorkflow]);

  const counts = useMemo(
    () => ({
      all: savedMissions.length,
      certified: savedMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'certified';
      }).length,
      pending: savedMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'pending';
      }).length,
      draft: savedMissions.filter((m) => {
        const isSelected = m.id === currentMissionId;
        return getMissionStatus(m, isSelected ? isCertifiedByWorkflow : false) === 'draft';
      }).length,
    }),
    [savedMissions, currentMissionId, isCertifiedByWorkflow]
  );

  const filterButtons: { key: StatusFilter; label: string; activeColor: string }[] = [
    { key: 'all', label: 'TOUS', activeColor: 'bg-slate-700 text-white' },
    { key: 'draft', label: 'DFT', activeColor: 'bg-slate-500 text-white' },
    { key: 'pending', label: 'ATT', activeColor: 'bg-amber-500 text-white' },
    { key: 'certified', label: 'OFF', activeColor: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="w-full no-print space-y-4">
      {/* 📊 BARRE DE RECHERCHE & FILTRES */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold outline-none focus:ring-2 ring-indigo-500/20 transition-all text-white placeholder-slate-600"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition-all ${showFilters ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}
          >
            <Calendar size={14} />
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-2 px-1"
            >
              <div className="flex flex-col gap-1.5 p-2 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                <label className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest ml-1">Filtrer par Région</label>
                <div className="flex flex-wrap gap-1">
                  {regions.map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRegion(r)}
                      className={`px-2 py-1 rounded-md text-[9px] font-black transition-all ${selectedRegion === r ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900/50 text-slate-500 hover:text-slate-300'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1 p-1 bg-slate-900/80 rounded-xl border border-white/5 shadow-inner">
          {filterButtons.map(({ key, activeColor }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 flex flex-col items-center justify-center rounded-lg py-1.5 transition-all ${
                filter === key ? `${activeColor} shadow-lg` : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-[11px] font-black leading-none">{counts[key]}</span>
              <span className="text-[8px] font-bold tracking-tighter opacity-70 mt-0.5">{key === 'all' ? 'TOUS' : key.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 📜 LISTE GROUPÉE (SUIVI ANNUEL) */}
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        {Object.keys(groupedMissions).length === 0 ? (
          <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
            <FileText size={24} className="mx-auto mb-2 text-slate-700" />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Aucune mission trouvée</p>
          </div>
        ) : (
          Object.entries(groupedMissions).map(([group, missions]) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{group}</span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              
              <div className="space-y-1.5">
                {missions.map((m) => {
                  const isActive = currentMissionId === m.id;
                  const status = getMissionStatus(m, isActive ? isCertifiedByWorkflow : false);
                  const cfg = STATUS_CONFIG[status];

                  return (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative"
                    >
                      <button
                        onClick={() => onLoadMission(m)}
                        className={`w-full text-left px-3 py-3 rounded-2xl border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden ${
                          isActive
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-400 shadow-xl shadow-indigo-500/30 scale-[1.02] z-10'
                            : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : cfg.dot}`} />
                              <p className={`text-[11px] font-black truncate tracking-tight ${isActive ? 'text-white' : 'text-slate-200'}`}>
                                {getMissionPrimaryLabel(m)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={10} className={isActive ? 'text-white/40' : 'text-slate-500'} />
                                <p className={`text-[10px] font-bold truncate ${isActive ? 'text-white/60' : 'text-slate-500'}`}>
                                    {getMissionSecondaryLabel(m)}
                                </p>
                            </div>
                          </div>
                          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/10' : 'bg-slate-800/50'}`}>
                            <cfg.icon size={12} className={isActive ? 'text-white' : cfg.badge.split(' ')[1]} />
                          </div>
                        </div>

                        {/* 🔗 TRAÇABILITÉ (Timeline Dots) */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.03]">
                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/80' : 'bg-slate-700'}`} title="Création" />
                          <div className={`h-[1px] w-3 ${isActive ? 'bg-white/20' : 'bg-slate-800'}`} />
                          <div className={`w-1.5 h-1.5 rounded-full ${m.isSubmitted || m.data?.isSubmitted || status !== 'draft' ? (isActive ? 'bg-white' : 'bg-amber-400') : 'bg-slate-800'}`} title="Soumission" />
                          <div className={`h-[1px] w-3 ${isActive ? 'bg-white/20' : 'bg-slate-800'}`} />
                          <div className={`w-1.5 h-1.5 rounded-full ${status === 'certified' ? (isActive ? 'bg-white' : 'bg-emerald-400') : 'bg-slate-800'}`} title="Certification" />
                        </div>

                        {isActive && (
                          <motion.div 
                            layoutId="active-indicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-white"
                          />
                        )}
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteMission(m.id, getMissionPrimaryLabel(m)); }}
                        className="absolute right-3 top-3 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
