/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, MapPin, X, CheckCircle2, Database } from 'lucide-react';

interface ClusterPanelData {
  id: string;
  name: string;
  count: number;
  type: string;
  bbox: [[number, number], [number, number]];
}

import { useTerrainUIStore } from '../../store/terrainUIStore';

interface Props {
  isDarkMode?: boolean;
  onClose: () => void;
  clusters: ClusterPanelData[];
  onSelectGrappe: (id: string | null, bbox?: [[number, number], [number, number]]) => void;
  isLoading?: boolean;
  progress?: { current: number; total: number } | null;
}

export function GrappeSelectorPanel({
  isDarkMode = true,
  onClose,
  clusters,
  onSelectGrappe,
  isLoading = false,
  progress = null,
}: Props) {
  const activeGrappeId = useTerrainUIStore((s) => s.activeGrappeId);
  const setActiveGrappeId = useTerrainUIStore((s) => s.setActiveGrappeId);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'carte' | 'liste'>('carte');
  const [limit, setLimit] = useState(50);

  const bg = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const subText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const filteredClusters = useMemo(() => {
    let list = [...clusters].sort((a, b) => b.count - a.count);
    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.id.toLowerCase().includes(search.toLowerCase())
      );
    }
    return list;
  }, [clusters, search]);

  const displayedClusters = useMemo(() => {
    return filteredClusters.slice(0, limit);
  }, [filteredClusters, limit]);

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`absolute top-[144px] left-3 right-3 md:top-16 md:right-4 md:left-auto z-[40] max-w-[calc(100vw-1.5rem)] md:w-80 rounded-[2rem] border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden max-h-[calc(100vh-220px)] md:max-h-[calc(100vh-120px)] ${bg}`}
    >
      <div
        className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl">
            <Database size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${text}`}>
              DONNÉES
            </h3>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${subText}`}>
              {isLoading ? 'Analyse...' : `${clusters.length} secteurs`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-xl hover:bg-slate-500/10 ${subText}`}
        >
          <X size={18} />
        </button>
      </div>

      {/* Real Progress Bar */}
      {isLoading && (
        <div className="px-5 pt-4">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                    {progress ? 'Synchronisation spatiale...' : 'Initialisation...'}
                </span>
                <span className="text-[9px] font-black text-indigo-400">
                    {progress ? `${progressPercent}%` : ''}
                </span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress ? progressPercent : 10}%` }}
                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                />
            </div>
        </div>
      )}

      {/* Tabs like in the screenshot */}
      <div className="px-5 pt-4">
        <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
            <button 
                onClick={() => setActiveTab('carte')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'carte' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Carte
            </button>
            <button 
                onClick={() => setActiveTab('liste')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'liste' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Liste
            </button>
        </div>
      </div>

      <div className="p-4">
        <input
          type="text"
          placeholder="Chercher (Village, Région...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full px-4 py-2.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
            isDarkMode
              ? 'bg-slate-950/50 border-slate-800 text-white placeholder-slate-600'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2 custom-scrollbar">
        {activeTab === 'carte' ? (
          <>
            {/* Reset button */}
            <button
              onClick={() => onSelectGrappe(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                activeGrappeId === null
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : isDarkMode
                    ? 'bg-slate-950/30 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activeGrappeId === null ? 'bg-white/20' : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
              >
                <MapPin size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest">
                  Vue Globale
                </p>
                <p className={`text-[9px] font-bold uppercase tracking-tighter opacity-60`}>Tout le territoire</p>
              </div>
              {activeGrappeId === null && <CheckCircle2 size={16} />}
            </button>

            {/* Loading Skeletons */}
            {isLoading && clusters.length === 0 && (
              <div className="space-y-3 mt-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-full h-16 rounded-2xl border animate-pulse ${isDarkMode ? 'border-slate-800 bg-slate-800/20' : 'border-slate-100 bg-slate-50'}`}
                  />
                ))}
              </div>
            )}

            {/* Individual Clusters */}
            {displayedClusters.map((c) => {
                const isActive = activeGrappeId === c.id;
                const color = (c as any).color || '#6366F1';

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveGrappeId(c.id);
                      onSelectGrappe(c.id, c.bbox);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all group ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : isDarkMode
                          ? 'bg-slate-950/30 border-slate-800 hover:border-slate-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className="w-1.5 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-tight truncate">
                        {c.name}
                      </p>
                      <p className={`text-[9px] font-bold uppercase tracking-widest opacity-60`}>
                        {c.count} ménages
                      </p>
                    </div>
                    {isActive && <CheckCircle2 size={16} />}
                  </button>
                );
              })}
          </>
        ) : (
          <div className="space-y-3">
             <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Résumé des Grappes</p>
                <div className="flex justify-between items-end">
                    <span className="text-2xl font-black text-white">{clusters.length}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Villages identifiés</span>
                </div>
             </div>
             
             <div className="space-y-1">
                {filteredClusters.slice(0, 100).map((c, i) => (
                    <div 
                        key={c.id} 
                        className={`flex justify-between items-center p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-600 w-4">{i + 1}</span>
                            <span className="text-[10px] font-black uppercase tracking-tight text-slate-300 truncate max-w-[140px]">{c.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-400">{c.count}</span>
                    </div>
                ))}
             </div>
          </div>
        )}

        {filteredClusters.length > limit && activeTab === 'carte' && (
          <button 
              onClick={() => setLimit(prev => prev + 50)}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
          >
              Charger plus de villages...
          </button>
        )}
      </div>
    </motion.div>
  );
}
