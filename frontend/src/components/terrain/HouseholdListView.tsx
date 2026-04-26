/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileDown, MapPin, Home } from 'lucide-react';
import type { Household } from '../../utils/types';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';

interface HouseholdListViewProps {
  households: Household[];
  isDarkMode: boolean;
  onSelectHousehold: (household: Household) => void;
}

// Individual row — memoized to avoid re-renders on parent updates
const HouseholdRow = React.memo(
  ({
    h,
    isDarkMode,
    onSelectHousehold,
  }: {
    h: Household;
    isDarkMode: boolean;
    onSelectHousehold: (h: Household) => void;
  }) => {
    const status = getHouseholdDerivedStatus(h);
    const statusClasses = getStatusTailwindClasses(status);
    const ownerName = 
      (typeof (h as any).owner === 'string' ? (h as any).owner : null) ||
      (h as any).owner?.name || 
      (h as any).name || 
      'Propriétaire inconnu';
    const location =
      (h as any).region || (h as any).departement || (h as any).village || 'Localisation inconnue';

    return (
      <div
        className={`flex items-center px-6 py-4 transition-colors border-b ${
          isDarkMode
            ? 'hover:bg-slate-800/50 border-slate-800/50'
            : 'hover:bg-slate-50 border-slate-100'
        }`}
      >
        {/* Icon */}
        <div
          className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border mr-4 ${
            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <Home size={14} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
        </div>

        {/* ID + Owner */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          >
            {(h as any).numeroordre || h.id}
          </p>
          <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {ownerName}
          </p>
        </div>

        {/* Location */}
        <div className="flex-1 min-w-0 px-4 hidden sm:block">
          <p
            className={`text-sm truncate flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
          >
            <MapPin size={10} className="flex-shrink-0 opacity-60" />
            {location}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0 px-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses}`}
          >
            {status}
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => onSelectHousehold(h)}
          className={`flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isDarkMode
              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          Voir
        </button>
      </div>
    );
  }
);

HouseholdRow.displayName = 'HouseholdRow';

export const HouseholdListView: React.FC<HouseholdListViewProps> = ({
  households,
  isDarkMode,
  onSelectHousehold,
}) => {
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
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menages_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [households]);

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`h-full w-full overflow-hidden flex flex-col rounded-3xl border shadow-lg ${
        isDarkMode ? 'bg-transparent border-none' : 'bg-white border-slate-200'
      }`}
    >
      {/* Region Summary */}
      {households.length > 0 && (
        <div className={`px-4 pt-4 pb-2 border-b overflow-x-auto ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex gap-4 min-w-max pb-2">
            {Object.entries(
              households.reduce((acc, h) => {
                const region = h.region || h.koboSync?.region || 'Inconnue';
                if (!acc[region]) acc[region] = { count: 0, villages: new Set<string>() };
                acc[region].count++;
                const village = h.village || h.koboSync?.village || h.grappeName || 'Sans village';
                acc[region].villages.add(village);
                return acc;
              }, {} as Record<string, { count: number; villages: Set<string> }>)
            ).map(([region, stats]) => (
              <div 
                key={region} 
                className={`p-4 rounded-[1.5rem] border shadow-sm flex flex-col gap-2 min-w-[220px] ${
                  isDarkMode ? 'bg-slate-800/80 border-white/5' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    Région
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${isDarkMode ? 'bg-slate-950 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {stats.count} ménages
                  </span>
                </div>
                <p className={`text-sm font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {region}
                </p>
                <div className="mt-1 pt-2 border-t border-white/5 space-y-1">
                  <p className={`text-[9px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {stats.villages.size} Villages (Grappes) :
                  </p>
                  <p className={`text-[10px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {Array.from(stats.villages).slice(0, 5).join(', ')}
                    {stats.villages.size > 5 && ` + ${stats.villages.size - 5} autres`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className={`p-4 flex-shrink-0 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500">
            Détails des Ménages
          </h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            {households.length.toLocaleString()} total
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isDarkMode
              ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          <FileDown size={14} /> Exporter CSV
        </button>
      </div>


      {/* List body — native CSS scroll, no external lib */}
      <div className="flex-1 overflow-y-auto">
        {households.length === 0 ? (
          <div
            className={`flex items-center justify-center h-full ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <div className="text-center py-16">
              <MapPin size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">Aucun ménage trouvé</p>
              <p className="text-sm mt-1">Modifiez vos filtres pour voir des résultats</p>
            </div>
          </div>
        ) : (
          households.map((h) => (
            <HouseholdRow
              key={h.id}
              h={h}
              isDarkMode={isDarkMode}
              onSelectHousehold={onSelectHousehold}
            />
          ))
        )}
      </div>
    </motion.div>
  );
};
