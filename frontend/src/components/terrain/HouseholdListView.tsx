/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo } from 'react';
import { List } from 'react-window';
import type { RowComponentProps } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { motion } from 'framer-motion';
import { 
  FileDown, 
  MapPin, 
  Eye, 
  ArrowUpDown, 
  Zap,
  FileText,
  ShieldCheck,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { Household } from '../../utils/types';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';
import { useTerrainUIStore } from '../../store/terrainUIStore';
import * as ReportGen from '../../services/householdReportGenerator';

interface HouseholdListViewProps {
  households: Household[];
  isDarkMode: boolean;
  onSelectHousehold: (h: Household) => void;
  totalCount?: number;
  hasActiveFilters?: boolean;
  searchQuery?: string;
}

const ReportIndicator = React.memo(({ icon, active, title, onClick, color }: any) => {
    const colors: any = {
        blue: active ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-slate-800/50 text-slate-600 border-white/5',
        amber: active ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-slate-800/50 text-slate-600 border-white/5',
        sky: active ? 'bg-sky-500/20 text-sky-400 border-sky-500/20' : 'bg-slate-800/50 text-slate-600 border-white/5',
        violet: active ? 'bg-violet-500/20 text-violet-400 border-violet-500/20' : 'bg-slate-800/50 text-slate-600 border-white/5',
        emerald: active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-600 border-white/5',
    };

    return (
        <button 
            onClick={(_e) => { _e.stopPropagation(); if (active) onClick(); }}
            title={active ? `Télécharger ${title}` : `${title} non disponible`}
            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${colors[color]} ${active ? 'hover:scale-110 active:scale-95 shadow-sm' : 'opacity-40 grayscale cursor-not-allowed'}`}
        >
            {icon}
        </button>
    );
});
ReportIndicator.displayName = 'ReportIndicator';

const getReportState = (h: Household, status: string) => {
    const constructionData = (h as any).constructionData || {};
    const koboSync = (h as any).koboSync || {};

    return [
        {
            color: 'blue',
            title: 'Bon livraison',
            active: true,
            icon: <Download size={10} />,
            onClick: () => ReportGen.generateLivraisonPDF(h),
        },
        {
            color: 'amber',
            title: 'PV maçonnerie',
            active: Boolean(koboSync.maconOk || constructionData.macon),
            icon: <FileText size={10} />,
            onClick: () => ReportGen.generateMaconneriePDF(h),
        },
        {
            color: 'sky',
            title: 'Fiche réseau',
            active: Boolean(koboSync.reseauOk || constructionData.reseau),
            icon: <Zap size={10} />,
            onClick: () => ReportGen.generateBranchementPDF(h),
        },
        {
            color: 'violet',
            title: 'PV installation',
            active: Boolean(koboSync.interieurOk || constructionData.interieur),
            icon: <FileText size={10} />,
            onClick: () => ReportGen.generateInstallationPDF(h),
        },
        {
            color: 'emerald',
            title: 'Certificat conformité',
            active: Boolean(koboSync.controleOk || constructionData.audit || status.includes('Conforme')),
            icon: <ShieldCheck size={10} />,
            onClick: () => ReportGen.generateConformiteFinalPDF(h),
        },
    ];
};

const ReportStrip = React.memo(({ household, status, className = '' }: { household: Household; status: string; className?: string }) => (
    <div className={`items-center gap-1.5 ${className}`}>
        {getReportState(household, status).map((report) => (
            <ReportIndicator
                key={report.title}
                color={report.color}
                title={report.title}
                active={report.active}
                icon={report.icon}
                onClick={report.onClick}
            />
        ))}
    </div>
));
ReportStrip.displayName = 'ReportStrip';

// Extra props for Row
interface RowExtraProps {
    households: Household[];
    isDarkMode: boolean;
    onSelectHousehold: (h: Household) => void;
    setHighlightedLocation: (loc: [number, number] | null) => void;
}

const HouseholdRow = ({
    index,
    style,
    households,
    isDarkMode,
    onSelectHousehold,
    setHighlightedLocation
}: RowComponentProps<RowExtraProps>) => {
    const h = households[index];
    const status = getHouseholdDerivedStatus(h);
    const statusClasses = getStatusTailwindClasses(status);
    const ownerName = 
      (typeof (h as any).owner === 'string' ? (h as any).owner : null) ||
      (h as any).owner?.name || 
      (h as any).name || 
      'Propriétaire inconnu';
      
    return (
      <div
        // eslint-disable-next-line react/forbid-dom-props
        style={style}
        className={`group flex items-center px-4 sm:px-6 py-2 border-b transition-all ${
          isDarkMode
            ? 'border-slate-800/40 hover:bg-blue-600/5 bg-[#050F1F]'
            : 'border-slate-100 hover:bg-blue-50/50 bg-white'
        }`}
      >
        {/* Status Indicator */}
        <div className="w-10 flex-shrink-0 mr-4 flex justify-center">
            {status.includes('Conforme') ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={14} />
                </div>
            ) : status.includes('En attente') || status.includes('Non encore') ? (
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Clock size={14} />
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <AlertCircle size={14} />
                </div>
            )}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <p className={`text-[11px] sm:text-[12px] font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {ownerName}
          </p>
          <p className={`text-[9px] font-bold uppercase tracking-widest opacity-50 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            ID: {String((h as any).numeroordre || h.id || 'N/A')}
          </p>
          <ReportStrip household={h} status={status} className="mt-2 flex xl:hidden" />
        </div>

        <div className="hidden lg:flex flex-1 px-4 flex-col gap-0.5">
           <p className={`text-[9px] font-black uppercase tracking-wider truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
             {h.region || 'Sénégal'}
           </p>
           <p className={`text-[9px] font-bold truncate opacity-40 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
             {h.village || h.departement || 'Zone rurale'}
           </p>
        </div>

        <div className="w-32 flex-shrink-0 flex justify-center">
          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${statusClasses}`}>
            {status.replace('Non encore installée', 'En attente')}
          </span>
        </div>

        <ReportStrip household={h} status={status} className="hidden xl:flex px-6 flex-shrink-0 w-[180px] justify-center" />

        <div className="ml-auto pl-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedLocation(h.location?.coordinates as [number, number]);
              onSelectHousehold(h);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              isDarkMode
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <Eye size={12} /> 
            <span className="hidden sm:inline">Voir</span>
          </button>
        </div>
      </div>
    );
};

export const HouseholdListView: React.FC<HouseholdListViewProps> = ({
  households,
  isDarkMode,
  onSelectHousehold,
  totalCount,
  hasActiveFilters = false,
  searchQuery = '',
}) => {
  const [sortField, setSortField] = React.useState<'id' | 'name' | 'status' | 'region'>('id');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [showInlineReports, setShowInlineReports] = React.useState(false);
  const setHighlightedLocation = useTerrainUIStore((s: any) => s.setHighlightedLocation);
  const emptyState = useMemo(() => {
    const total = totalCount ?? households.length;
    if (total === 0) {
      return {
        title: 'Aucun ménage chargé',
        message:
          'Sélectionnez un projet actif, lancez la synchronisation Kobo ou importez les ménages depuis le Data Hub.',
      };
    }

    if (searchQuery.trim()) {
      return {
        title: 'Aucun résultat',
        message: `Aucun ménage ne correspond à "${searchQuery.trim()}". Effacez la recherche ou élargissez les filtres.`,
      };
    }

    if (hasActiveFilters) {
      return {
        title: 'Aucun ménage dans ce filtre',
        message:
          'Les ménages existent, mais le filtre équipe/statut ou la zone visible de la carte les masque.',
      };
    }

    return {
      title: 'Aucun ménage trouvé',
      message: 'Aucune donnée exploitable avec les paramètres actuels.',
    };
  }, [hasActiveFilters, households.length, searchQuery, totalCount]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1279px)');
    const sync = () => setShowInlineReports(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = ['N° Ordre', 'Propriétaire', 'Région', 'Statut', 'Lat', 'Lng'];
    const rows = households.map((h) => [
      (h as any).numeroordre || h.id,
      (h as any).owner?.name || (h as any).name || '',
      (h as any).region || (h as any).departement || '',
      getHouseholdDerivedStatus(h),
      h.location?.coordinates?.[1] ?? '',
      h.location?.coordinates?.[0] ?? '',
    ]);
    const csv = [headers, ...rows].map((r: any) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menages_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [households]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortOrder('asc');
    }
  };

  const sortedHouseholds = useMemo(() => {
    return [...households].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortField) {
            case 'id':
                valA = parseInt((a as any).numeroordre) || 0;
                valB = parseInt((b as any).numeroordre) || 0;
                break;
            case 'name': {
                const ownerA = (a as any).owner;
                const ownerB = (b as any).owner;
                valA = (typeof ownerA === 'object' ? (ownerA?.name ?? '') : (ownerA || (a as any).name || '')).toLowerCase();
                valB = (typeof ownerB === 'object' ? (ownerB?.name ?? '') : (ownerB || (b as any).name || '')).toLowerCase();
                break;
            }
            case 'status':
                valA = getHouseholdDerivedStatus(a).toLowerCase();
                valB = getHouseholdDerivedStatus(b).toLowerCase();
                break;
            case 'region':
                valA = (a.region || '').toLowerCase();
                valB = (b.region || '').toLowerCase();
                break;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
  }, [households, sortField, sortOrder]);

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-full w-full overflow-hidden flex flex-col rounded-3xl border shadow-lg ${
        isDarkMode ? 'bg-transparent border-none' : 'bg-white border-slate-200'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-4 sm:px-6 sm:py-5 flex-shrink-0 border-b flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
          <h3 className="min-w-0 text-[1.35rem] sm:text-xl font-black uppercase tracking-tight sm:tracking-tighter leading-none text-white">
            Ménages
          </h3>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
            isDarkMode 
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
              : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
            {households.length.toLocaleString()} AU TOTAL
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition-all shadow-lg active:scale-95 sm:w-auto sm:tracking-widest ${
            isDarkMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          <FileDown size={14} /> Exporter CSV
        </button>
      </div>

      {/* Column Headers */}
      <div className={`hidden sm:flex px-6 py-3 border-b items-center text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'bg-slate-900/20 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
         <div className="w-10 flex-shrink-0 mr-4"></div>
         <button onClick={() => toggleSort('name')} className="flex-1 flex-shrink-0 flex items-center gap-2 hover:text-blue-500 transition-colors">
            CLIENT <ArrowUpDown size={12} className={sortField === 'name' ? 'text-blue-500' : 'opacity-20'} />
         </button>
         <button onClick={() => toggleSort('region')} className="flex-1 px-4 flex items-center gap-2 hover:text-blue-500 transition-colors hidden lg:flex">
            ZONE <ArrowUpDown size={12} className={sortField === 'region' ? 'text-blue-500' : 'opacity-20'} />
         </button>
         <button onClick={() => toggleSort('status')} className="w-32 flex-shrink-0 flex items-center justify-center gap-2 hover:text-blue-500 transition-colors">
            STATUT <ArrowUpDown size={12} className={sortField === 'status' ? 'text-blue-500' : 'opacity-20'} />
         </button>
         <div className="hidden xl:block px-6 flex-shrink-0 w-[180px] text-center tracking-[0.3em] opacity-40">RAPPORTS</div>
         <div className="ml-auto px-6">DÉTAILS</div>
      </div>

      {/* List body — Virtualized with react-window */}
      <div className="flex-1 overflow-hidden">
        {sortedHouseholds.length === 0 ? (
          <div
            className={`flex items-center justify-center h-full ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <div className="text-center py-16">
              <MapPin size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">{emptyState.title}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed opacity-70">
                {emptyState.message}
              </p>
            </div>
          </div>
        ) : (
          <AutoSizer
            renderProp={({ height, width }: any) => (
              <List
                rowCount={sortedHouseholds.length}
                rowHeight={showInlineReports ? 96 : 72}
                rowComponent={HouseholdRow}
                rowProps={{
                  households: sortedHouseholds,
                  isDarkMode,
                  onSelectHousehold,
                  setHighlightedLocation
                }}
                className="custom-scrollbar"
                style={{ 
                    height: height || '100%', 
                    width: width || '100%' 
                }}
              />
            )}
          />
        )}
      </div>
    </motion.div>
  );
};
